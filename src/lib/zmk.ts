import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { actionToZmkSourceString, generateZmkTapDanceBehaviors } from './tap-dance-codegen';
import { actionToZmkSourceStringWithMacros, generateZmkMacroBehaviors } from './macro-codegen';
import { generateZmkComboBehaviors } from './combo-codegen';
import { sortKeys } from './sorting';
import { getDefaultZmkBoard, getZmkDevelopmentBoard, getZmkTarget, isZmkExportSupported, ZmkTarget } from './mcu-presets';
import { getLocalMatrixPosition, getMatrixFromPins, MatrixSide } from './matrix-utils';

const sanitizeIdentifier = (value: string, fallback: string) => {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) return fallback;
  return /^[a-z]/.test(cleaned) ? cleaned : `${fallback}_${cleaned}`;
};

const parseGpioNumber = (pin: string, fallback: number): number => {
  const match = pin.trim().match(/(?:GP|GPIO|P)?\s*(\d+)/i);
  return match ? Number(match[1]) : fallback;
};

const parseZmkGpio = (pin: string, fallback: number, target: ZmkTarget) => {
  if (target === 'nrf52840') {
    const match = pin.trim().match(/^P([01])\.(\d{1,2})$/i);
    if (match) {
      return { controller: `&gpio${match[1]}`, number: Number(match[2]) };
    }
  }

  return { controller: '&gpio0', number: parseGpioNumber(pin, fallback) };
};

const formatGpios = (pins: string[], target: ZmkTarget, flags: string, label: string) => {
  if (pins.length === 0) {
    return `&gpio0 0 ${flags} /* Please configure pins */`;
  }

  return pins.map((pin, index) => {
    const parsed = parseZmkGpio(pin, index, target);
    return `${parsed.controller} ${parsed.number} ${flags} /* ${label} ${index}: ${pin} */`;
  }).join('\n            , ');
};

const getZmkSplitTransport = (settings: ProjectSettings) => settings.zmk?.splitTransport || 'ble';

const getWiredSplitDevice = (settings: ProjectSettings) => settings.zmk?.wiredSplitDevice?.trim() || '&pro_micro_serial';

const getSidePins = (settings: ProjectSettings, side: MatrixSide) => {
  if (side === 'left') {
    return {
      rows: settings.pins.rows || [],
      cols: settings.pins.cols || [],
    };
  }

  return {
    rows: settings.pins.splitRows?.length ? settings.pins.splitRows : settings.pins.rows || [],
    cols: settings.pins.splitCols?.length ? settings.pins.splitCols : settings.pins.cols || [],
  };
};

const getZmkMatrixDimensions = (settings: ProjectSettings) => {
  if (!settings.features.split) {
    return getMatrixFromPins(settings.pins, false) || settings.matrix;
  }

  const left = getSidePins(settings, 'left');
  const right = getSidePins(settings, 'right');
  return {
    rows: Math.max(left.rows.length, right.rows.length, settings.matrix?.rows || 0),
    cols: left.cols.length + right.cols.length,
  };
};

const getZmkMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
) => {
  const local = getLocalMatrixPosition(settings, key, keys);
  if (!local) return undefined;
  if (!settings.features.split) return { row: local.row, col: local.col };

  const leftCols = getSidePins(settings, 'left').cols.length;
  return {
    row: local.row,
    col: local.side === 'right' ? local.col + leftCols : local.col,
  };
};

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getZmkMatrixDimensions(settings);

  return keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    const pos = getZmkMatrixPosition(settings, key, keys);
    if (!pos || pos.row < 0 || pos.col < 0) return false;
    if (pos.row >= matrix.rows || pos.col >= matrix.cols) return false;
    const firstIdx = keys.findIndex(k => {
      const other = getZmkMatrixPosition(settings, k, keys);
      return other?.row === pos.row && other?.col === pos.col;
    });
    return firstIdx === idx;
  });
};

const formatTransformMap = (settings: ProjectSettings, keys: PhysicalKey[], allKeys: PhysicalKey[]) => {
  let transformMapStr = '';
  for (let i = 0; i < keys.length; i += 10) {
    transformMapStr += (i > 0 ? '\n            ' : '') + keys.slice(i, i + 10).map(key => {
      const pos = getZmkMatrixPosition(settings, key, allKeys);
      return `RC(${pos?.row ?? 0},${pos?.col ?? 0})`;
    }).join(' ');
  }
  return transformMapStr;
};

const generateKeymapDts = (
  settings: ProjectSettings,
  sortedKeys: PhysicalKey[],
  kbName: string,
) => {
  const layersCount = settings.layers || 4;
  let keymapDts = `/*
 * Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
 * SPDX-License-Identifier: MIT
 */

#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>
#include <dt-bindings/zmk/bt.h>
#include <dt-bindings/zmk/outputs.h>
#include <dt-bindings/zmk/rgb.h>
#include <dt-bindings/zmk/mouse.h>

/ {
${generateZmkTapDanceBehaviors(settings.tapDances || [])}
${generateZmkMacroBehaviors(settings.macros || [])}
${generateZmkComboBehaviors(settings.combos || [], sortedKeys, settings.macros || [])}
    keymap {
        compatible = "zmk,keymap";
`;

  for (let l = 0; l < layersCount; l++) {
    const layerBindings = sortedKeys.map(key => {
      const action = key.keymap?.[l] || { action: 'trans' };
      return action.action === 'td'
        ? actionToZmkSourceString(action)
        : actionToZmkSourceStringWithMacros(action, settings.macros || []);
    });

    let layerBindingsStr = '';
    for (let i = 0; i < layerBindings.length; i += 10) {
      layerBindingsStr += (i > 0 ? '\n                ' : '') + layerBindings.slice(i, i + 10).join(' ');
    }

    keymapDts += `
        layer_${l} {
            bindings = <
                ${layerBindingsStr}
            >;
        };
`;
  }

  keymapDts += `    };
};
`;

  return { filename: `${kbName}.keymap`, content: keymapDts };
};

const generateSplitShieldFiles = (
  zip: JSZip,
  settings: ProjectSettings,
  keys: PhysicalKey[],
  sortedKeys: PhysicalKey[],
  kbName: string,
  zmkTarget: ZmkTarget,
  boardName: string,
) => {
  const shieldsFolder = zip.folder('boards')?.folder('shields')?.folder(kbName);
  if (!shieldsFolder) return null;

  const matrix = getZmkMatrixDimensions(settings);
  const leftPins = getSidePins(settings, 'left');
  const rightPins = getSidePins(settings, 'right');
  const leftRows = formatGpios(leftPins.rows, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Left row');
  const leftCols = formatGpios(leftPins.cols, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Left col');
  const rightRows = formatGpios(rightPins.rows, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Right row');
  const rightCols = formatGpios(rightPins.cols, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Right col');
  const transformMapStr = formatTransformMap(settings, sortedKeys, keys);
  const leftShield = `${kbName}_left`;
  const rightShield = `${kbName}_right`;
  const splitTransport = getZmkSplitTransport(settings);
  const wiredSplitDevice = getWiredSplitDevice(settings);
  const wiredSplitNode = splitTransport === 'wired' ? `
    wired_split {
        compatible = "zmk,wired-split";
        device = <${wiredSplitDevice}>;
    };
` : '';

  const sharedDtsi = `#include <dt-bindings/zmk/matrix_transform.h>

/ {
    chosen {
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;
    };

    default_transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        columns = <${matrix.cols}>;
        rows = <${matrix.rows}>;
        map = <
            ${transformMapStr}
        >;
    };

    kscan0: kscan {
        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";
        wakeup-source;
    };
${wiredSplitNode}
};
`;
  shieldsFolder.file(`${kbName}.dtsi`, sharedDtsi);

  const leftOverlay = `#include "${kbName}.dtsi"

&kscan0 {
    row-gpios
        = ${leftRows}
        ;

    col-gpios
        = ${leftCols}
        ;
};
`;
  shieldsFolder.file(`${leftShield}.overlay`, leftOverlay);

  const rightOverlay = `#include "${kbName}.dtsi"

&default_transform {
    col-offset = <${leftPins.cols.length}>;
};

&kscan0 {
    row-gpios
        = ${rightRows}
        ;

    col-gpios
        = ${rightCols}
        ;
};
`;
  shieldsFolder.file(`${rightShield}.overlay`, rightOverlay);

  const sharedConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# RGB features
${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_WS2812_STRIP=y\n` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
${splitTransport === 'wired' ? '\nCONFIG_ZMK_SPLIT_BLE=n\nCONFIG_ZMK_SPLIT_WIRED=y\n' : ''}
`;
  shieldsFolder.file(`${kbName}.conf`, sharedConf);

  const kconfigShield = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config SHIELD_${leftShield.toUpperCase()}
    def_bool $(shields_list_contains,${leftShield})

config SHIELD_${rightShield.toUpperCase()}
    def_bool $(shields_list_contains,${rightShield})
`;
  shieldsFolder.file('Kconfig.shield', kconfigShield);

  const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if SHIELD_${leftShield.toUpperCase()}

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

config ZMK_SPLIT_ROLE_CENTRAL
    default y

endif

if SHIELD_${leftShield.toUpperCase()} || SHIELD_${rightShield.toUpperCase()}

config ZMK_SPLIT
    default y

endif
`;
  shieldsFolder.file('Kconfig.defconfig', kconfigDefconfig);

  const zmkYml = `file_format: "1"
id: ${kbName}
name: "${settings.name}"
type: shield
requires: [${zmkTarget === 'nrf52840' ? 'nice_nano' : 'xiao'}]
features:
  - keys
siblings:
  - ${leftShield}
  - ${rightShield}
`;
  shieldsFolder.file(`${kbName}.zmk.yml`, zmkYml);

  const keymap = generateKeymapDts(settings, sortedKeys, kbName);
  shieldsFolder.file(keymap.filename, keymap.content);

  const readmeContent = `# ZMK Config for ${settings.name}

This directory structure has been automatically generated by **Smidr** to compile ZMK ${splitTransport} split firmware for your custom keyboard.

## Directory Structure
- \`boards/shields/${kbName}/\`: Contains the split shield overlays, shared DTSI, metadata, Kconfig files, and default keymap.

## Setup and Compilation
To build ZMK firmware using this configuration:
1. Initialize or open your \`zmk-config\` repository.
2. Copy the \`boards/\` directory from this exported folder directly into your \`zmk-config\` repository.
3. Configure your GitHub Actions \`build.yaml\` file:
   \`\`\`yaml
   include:
     - board: ${boardName}
       shield: ${leftShield}
     - board: ${boardName}
       shield: ${rightShield}
   \`\`\`
4. Push the changes to GitHub and download the compiled firmware binaries from the GitHub Actions tab.

## Split Matrix
The shared \`${kbName}.dtsi\` file defines the full matrix transform. The right half overlay applies \`col-offset = <${leftPins.cols.length}>\` so local right-side matrix events map into the right side of the shared transform.
${splitTransport === 'wired' ? `\n## Wired Split\nThe shared \`${kbName}.dtsi\` file enables ZMK wired split using \`${wiredSplitDevice}\`. Verify this UART device exists for the selected board before building.\n` : ''}
`;
  zip.file('README.md', readmeContent);

  return true;
};

/**
 * Generates a full standard ZMK config source code ZIP as a custom Board definition (architecture-based).
 */
export const generateZmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = getValidMatrixKeys(settings, keys);

  const sortedKeys = sortKeys(validKeys, 0.25);

  const zip = new JSZip();
  const kbName = sanitizeIdentifier(settings.name, 'smidr_keyboard');
  const vendorName = sanitizeIdentifier(settings.manufacturer, 'custom_vendor');
  
  if (!isZmkExportSupported(settings.hardware.mcu)) {
    throw new Error('ZMK export is currently implemented for RP2040 and nRF52840 projects only.');
  }

  const zmkTarget = getZmkTarget(settings.hardware.mcu) || 'rp2040';
  const boardName = getZmkDevelopmentBoard(settings.hardware.board || getDefaultZmkBoard(settings.hardware.mcu));

  if (settings.features.split) {
    if (settings.hardware.controllerType === 'mcu') {
      throw new Error('ZMK split export currently supports development-board shield projects only.');
    }
    if (getZmkSplitTransport(settings) === 'ble' && zmkTarget !== 'nrf52840') {
      throw new Error('ZMK split export currently requires an nRF52840 BLE-capable development board.');
    }
    generateSplitShieldFiles(zip, settings, keys, sortedKeys, kbName, zmkTarget, boardName);
    return await zip.generateAsync({ type: 'blob' });
  }
  
  // ZMK configs are typically inside a config/ folder
  const configFolder = zip.folder('config');
  if (!configFolder) return null;

  const transformMapStr = formatTransformMap(settings, sortedKeys, keys);
  const matrix = getZmkMatrixDimensions(settings);

  const rowPins = settings.pins.rows || [];
  const rowGpiosStr = formatGpios(rowPins, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Row');

  const colPins = settings.pins.cols || [];
  const colGpiosStr = formatGpios(colPins, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Col');

  if (settings.hardware.controllerType === 'mcu') {
    const arch = 'arm';
    const boardFolder = zip.folder('boards')?.folder(arch)?.folder(kbName);
    if (!boardFolder) return null;

    const kconfigBoard = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config BOARD_${kbName.toUpperCase()}
    bool "${settings.name}"
    select SOC_${zmkTarget === 'nrf52840' ? 'NRF52840_QIAA' : 'RP2040'}
`;
    boardFolder.file('Kconfig.board', kconfigBoard);

    const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if BOARD_${kbName.toUpperCase()}

config BOARD
    default "${kbName}"

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

${zmkTarget === 'nrf52840' ? `config ZMK_BLE
    default y

config ZMK_USB
    default y
` : `config RP2_FLASH_W25Q080
    default y
`}
endif
`;
    boardFolder.file('Kconfig.defconfig', kconfigDefconfig);

    const boardDefconfig = `CONFIG_GPIO=y
CONFIG_ZMK=y
CONFIG_USB=y
${zmkTarget === 'nrf52840' ? 'CONFIG_BT=y\nCONFIG_ZMK_BLE=y\n' : ''}
CONFIG_FLASH=y
CONFIG_SETTINGS=y
CONFIG_SETTINGS_NVS=y
CONFIG_BUILD_OUTPUT_UF2=y
CONFIG_PINCTRL=y
CONFIG_CLOCK_CONTROL=y
CONFIG_FLASH_PAGE_LAYOUT=y
${zmkTarget === 'nrf52840' ? 'CONFIG_NVS=y\nCONFIG_MPU_ALLOW_FLASH_WRITE=y\n' : ''}
CONFIG_RETAINED_MEM=y
CONFIG_RETENTION=y
CONFIG_RETENTION_BOOT_MODE=y
`;
    boardFolder.file(`${kbName}_defconfig`, boardDefconfig);

    const keyboardConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# RGB features
${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_WS2812_STRIP=y\n` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
`;
    boardFolder.file(`${kbName}.conf`, keyboardConf);

    const dtsInclude = zmkTarget === 'nrf52840'
      ? '#include <nordic/nrf52840_qiaa.dtsi>'
      : `#include <arm/rpi_pico/rp2040.dtsi>
#include <dt-bindings/pinctrl/rpi-pico-rp2040-pinctrl.h>`;

    const dtsChosen = zmkTarget === 'nrf52840'
      ? `        zephyr,sram = &sram0;
        zephyr,flash = &flash0;
        zephyr,code-partition = &code_partition;
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;`
      : `        zephyr,sram = &sram0;
        zephyr,flash = &flash0;
        zephyr,flash-controller = &ssi;
        zephyr,code-partition = &code_partition;
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;`;

    const peripheralDts = zmkTarget === 'nrf52840' ? `
&gpio0 {
    status = "okay";
};

&gpio1 {
    status = "okay";
};

&flash0 {
    partitions {
        compatible = "fixed-partitions";
        #address-cells = <1>;
        #size-cells = <1>;

        code_partition: partition@26000 {
            label = "code_partition";
            reg = <0x00026000 0x000d2000>;
        };

        storage_partition: partition@f8000 {
            label = "storage";
            reg = <0x000f8000 0x00008000>;
        };
    };
};
` : `
&gpio0 {
    status = "okay";
};

&ssi {
    status = "okay";
};

&flash0 {
    status = "okay";
    reg = <0x10000000 0x1000000>;

    partitions {
        compatible = "fixed-partitions";
        #address-cells = <1>;
        #size-cells = <1>;

        code_partition: partition@100 {
            label = "code_partition";
            reg = <0x100 0xf7f000>;
            read-only;
        };

        storage_partition: partition@f80000 {
            label = "storage";
            reg = <0xf80000 0x80000>;
        };
    };
};
`;

    const keyboardDts = `/dts-v1/;
${dtsInclude}
#include <dt-bindings/zmk/matrix_transform.h>

/ {
    model = "${settings.name}";
    compatible = "${vendorName},${kbName}";

    chosen {
${dtsChosen}
    };

    default_transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        columns = <${matrix.cols}>;
        rows = <${matrix.rows}>;
        map = <
            ${transformMapStr}
        >;
    };

    kscan0: kscan {
        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";

        row-gpios
            = ${rowGpiosStr}
            ;

        col-gpios
            = ${colGpiosStr}
            ;
    };
};

${peripheralDts}
`;
    boardFolder.file(`${kbName}.dts`, keyboardDts);

    const zmkYml = `file_format: "1"
id: ${kbName}
name: "${settings.name}"
type: board
features:
  - keys
`;
    boardFolder.file(`${kbName}.zmk.yml`, zmkYml);
  } else {
    const shieldsFolder = zip.folder('boards')?.folder('shields')?.folder(kbName);
    if (!shieldsFolder) return null;

    const shieldOverlay = `#include <dt-bindings/zmk/matrix_transform.h>

/ {
    model = "${settings.name}";
    compatible = "${vendorName},${kbName}";

    chosen {
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;
    };

    default_transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        columns = <${matrix.cols}>;
        rows = <${matrix.rows}>;
        map = <
            ${transformMapStr}
        >;
    };

    kscan0: kscan {
        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";

        row-gpios
            = ${rowGpiosStr}
            ;

        col-gpios
            = ${colGpiosStr}
            ;
    };
};
`;
    shieldsFolder.file(`${kbName}.overlay`, shieldOverlay);

    const shieldConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# RGB features
${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_WS2812_STRIP=y\n` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
`;
    shieldsFolder.file(`${kbName}.conf`, shieldConf);

    const kconfigShield = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config SHIELD_${kbName.toUpperCase()}
    def_bool $(shields_list_contains,${kbName})
`;
    shieldsFolder.file('Kconfig.shield', kconfigShield);

    const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if SHIELD_${kbName.toUpperCase()}

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

endif
`;
    shieldsFolder.file('Kconfig.defconfig', kconfigDefconfig);

    const zmkYml = `file_format: "1"
id: ${kbName}
name: "${settings.name}"
type: shield
requires: [${zmkTarget === 'nrf52840' ? 'nice_nano' : 'xiao'}]
features:
  - keys
`;
    shieldsFolder.file(`${kbName}.zmk.yml`, zmkYml);
  }

  const layersCount = settings.layers || 4;
  let keymapDts = `/*
 * Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
 * SPDX-License-Identifier: MIT
 */

#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>
#include <dt-bindings/zmk/bt.h>
#include <dt-bindings/zmk/outputs.h>
#include <dt-bindings/zmk/rgb.h>
#include <dt-bindings/zmk/mouse.h>

/ {
${generateZmkTapDanceBehaviors(settings.tapDances || [])}
${generateZmkMacroBehaviors(settings.macros || [])}
${generateZmkComboBehaviors(settings.combos || [], sortedKeys, settings.macros || [])}
    keymap {
        compatible = "zmk,keymap";
`;

  for (let l = 0; l < layersCount; l++) {
    const layerBindings = sortedKeys.map(key => {
      const action = key.keymap?.[l] || { action: 'trans' };
      return action.action === 'td'
        ? actionToZmkSourceString(action)
        : actionToZmkSourceStringWithMacros(action, settings.macros || []);
    });

    let layerBindingsStr = '';
    for (let i = 0; i < layerBindings.length; i += 10) {
      layerBindingsStr += (i > 0 ? '\n                ' : '') + layerBindings.slice(i, i + 10).join(' ');
    }

    keymapDts += `
        layer_${l} {
            bindings = <
                ${layerBindingsStr}
            >;
        };
`;
  }

  keymapDts += `    };
};
`;
  configFolder.file(`${kbName}.keymap`, keymapDts);

  const usesCustomBoard = settings.hardware.controllerType === 'mcu';
  const structureLine = usesCustomBoard
    ? `- \`boards/arm/${kbName}/\`: Contains the custom board definition files.`
    : `- \`boards/shields/${kbName}/\`: Contains the shield overlay, config, metadata, and Kconfig files.`;
  const buildExample = usesCustomBoard
    ? `     - board: ${kbName}`
    : `     - board: ${boardName}
       shield: ${kbName}`;
  const gpioFile = usesCustomBoard ? `${kbName}.dts` : `${kbName}.overlay`;
  const gpioKind = usesCustomBoard ? 'custom board' : 'shield';

  // 8. README.md
  const readmeContent = `# ZMK Config for ${settings.name}

This directory structure has been automatically generated by **Smidr** to compile ZMK firmware for your custom keyboard.

## Directory Structure
- \`config/${kbName}.keymap\`: Contains all keymap layers defined in Smidr.
${structureLine}

## Setup and Compilation
To build ZMK firmware using this configuration:
1. Initialize or open your \`zmk-config\` repository.
2. Copy the \`config/\` and \`boards/\` directories from this exported folder directly into your \`zmk-config\` repository.
3. Configure your GitHub Actions \`build.yaml\` file:
   \`\`\`yaml
   include:
${buildExample}
   \`\`\`
4. Push the changes to GitHub and download the compiled firmware binary from the GitHub Actions tab!

## GPIO Matrix Pin Configuration
The \`${gpioFile}\` file has been populated with a standard \`gpio-matrix\` ${gpioKind} configuration.
For RP2040 boards, Smidr converts pin names like \`GP2\` or \`GPIO2\` to \`&gpio0 2\`.
For nRF52840 boards, Smidr converts pin names like \`P0.06\` and \`P1.02\` to \`&gpio0 6\` and \`&gpio1 2\`.
Please verify the generated GPIO numbers before flashing.
`;
  zip.file('README.md', readmeContent);

  return await zip.generateAsync({ type: 'blob' });
};
