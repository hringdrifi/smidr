import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { actionToZmkString } from './protocols/zmk-action-converter';
import { sortKeys } from './sorting';

/**
 * Generates a full standard ZMK config source code ZIP as a custom Board definition (architecture-based).
 */
export const generateZmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    if (key.row >= settings.pins.rows.length || key.col >= settings.pins.cols.length) return false;
    const firstIdx = keys.findIndex(k => k.row === key.row && k.col === key.col);
    return firstIdx === idx;
  });

  const sortedKeys = sortKeys(validKeys, 0.25);

  const zip = new JSZip();
  const kbName = settings.name.replace(/\s+/g, '_').toLowerCase() || 'smidr_keyboard';
  const vendorName = settings.manufacturer.replace(/\s+/g, '_').toLowerCase() || 'custom_vendor';
  
  // Determine target architecture and SoC name based on selected MCU
  const mcu = settings.hardware.mcu || 'rp2040';
  const isAtmega = mcu === 'atmega32u4';
  const arch = isAtmega ? 'avr' : 'arm';
  
  // ZMK configs are typically inside a config/ folder
  const configFolder = zip.folder('config');
  if (!configFolder) return null;

  // Board definitions in older ZMK are placed under boards/<arch>/<board_name>/
  const boardsFolder = zip.folder('boards');
  const archFolder = boardsFolder?.folder(arch);
  const boardFolder = archFolder?.folder(kbName);
  if (!boardFolder) return null;

  // 1. Kconfig.board
  const kconfigBoard = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config BOARD_${kbName.toUpperCase()}
    bool "${settings.name}"
    select SOC_${isAtmega ? 'ATMEGA32U4' : 'RP2040'}
`;
  boardFolder.file('Kconfig.board', kconfigBoard);

  // 2. Kconfig.defconfig
  const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if BOARD_${kbName.toUpperCase()}

config BOARD
    default "${kbName}"

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

endif
`;
  boardFolder.file('Kconfig.defconfig', kconfigDefconfig);

  // 3. [kbName]_defconfig
  const boardDefconfig = `CONFIG_GPIO=y
CONFIG_ZMK=y
CONFIG_USB=y
CONFIG_FLASH=y
${isAtmega ? 'CONFIG_BUILD_OUTPUT_HEX=y' : 'CONFIG_BUILD_OUTPUT_UF2=y\nCONFIG_RETAINED_MEM=y\nCONFIG_RETENTION=y\nCONFIG_RETENTION_BOOT_MODE=y'}
`;
  boardFolder.file(`${kbName}_defconfig`, boardDefconfig);

  // 4. [kbName].conf
  const keyboardConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# RGB features
${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y\nCONFIG_WS2812_STRIP=y\n` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
`;
  boardFolder.file(`${kbName}.conf`, keyboardConf);

  // 5. [kbName].dts
  // We construct the matrix transform map and pins
  let transformMapStr = '';
  for (let i = 0; i < sortedKeys.length; i += 10) {
    transformMapStr += (i > 0 ? '\n            ' : '') + sortedKeys.slice(i, i + 10).map(key => `RC(${key.row},${key.col})`).join(' ');
  }

  const rowPins = settings.pins.rows || [];
  const rowGpiosStr = rowPins.length > 0 
    ? rowPins.map((pin, i) => `${isAtmega ? '&gpioa' : '&pro_micro'} ${i} (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN) /* Row ${i}: ${pin} */`).join('\n            , ')
    : `${isAtmega ? '&gpioa' : '&pro_micro'} 0 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN) /* Please configure pins */`;

  const colPins = settings.pins.cols || [];
  const colGpiosStr = colPins.length > 0 
    ? colPins.map((pin, i) => `${isAtmega ? '&gpioa' : '&pro_micro'} ${i} GPIO_ACTIVE_HIGH /* Col ${i}: ${pin} */`).join('\n            , ')
    : `${isAtmega ? '&gpioa' : '&pro_micro'} 0 GPIO_ACTIVE_HIGH /* Please configure pins */`;

  const dtsInclude = isAtmega 
    ? '#include <atmel/atmega32u4.dtsi>'
    : `#include <raspberrypi/rpi_pico/rp2040.dtsi>
#include <arm/raspberrypi/rp2040-boot-mode-retention.dtsi>`;

  const dtsChosen = isAtmega
    ? `        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;`
    : `        zephyr,sram = &sram0;
        zephyr,flash = &flash0;
        zmk,kscan = &kscan0;
        zmk,matrix-transform = &default_transform;`;

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
        columns = <${settings.pins.cols.length}>;
        rows = <${settings.pins.rows.length}>;
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
  boardFolder.file(`${kbName}.dts`, keyboardDts);

  // 6. [kbName].zmk.yml (Metadata for ZMK CLI / ZMK Studio)
  const zmkYml = `file_format: "1"
id: ${kbName}
name: ${settings.name}
type: board
features:
  - keys
`;
  boardFolder.file(`${kbName}.zmk.yml`, zmkYml);

  // 7. [kbName].keymap
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
    keymap {
        compatible = "zmk,keymap";
`;

  for (let l = 0; l < layersCount; l++) {
    const layerBindings = sortedKeys.map(key => {
      const action = key.keymap?.[l] || { action: 'trans' };
      return actionToZmkString(action);
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

  // 8. README.md
  const readmeContent = `# ZMK Config for ${settings.name}

This directory structure has been automatically generated by **Smiðr** to compile ZMK firmware for your custom keyboard.

## Directory Structure
- \`config/${kbName}.keymap\`: Contains all keymap layers defined in Smiðr.
- \`boards/${arch}/${kbName}/\`: Contains custom architecture-based board definition files (\`.dts\`, \`Kconfig\`, and \`_defconfig\`).

## Setup and Compilation
To build ZMK firmware using this configuration:
1. Initialize or open your \`zmk-config\` repository.
2. Copy the \`config/\` and \`boards/\` directories from this exported folder directly into your \`zmk-config\` repository.
3. Configure your GitHub Actions \`build.yaml\` file to point to your new board:
   \`\`\`yaml
   include:
     - board: ${kbName}
   \`\`\`
4. Push the changes to GitHub and download the compiled firmware binary from the GitHub Actions tab!

## GPIO Matrix Pin Configuration
The \`${kbName}.dts\` file has been populated with a standard \`gpio-matrix\` configuration. 
Please verify the comments indicating which physical Smiðr pin corresponds to each entry and map them to your onboard MCU's actual GPIO pins as necessary.
`;
  zip.file('README.md', readmeContent);

  return await zip.generateAsync({ type: 'blob' });
};
