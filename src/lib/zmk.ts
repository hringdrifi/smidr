import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { UniversalAction } from '@/types/actions';
import { actionToZmkSourceString, generateZmkTapDanceBehaviors } from './tap-dance-codegen';
import { actionToZmkSourceStringWithMacros, generateZmkMacroBehaviors } from './macro-codegen';
import { generateZmkComboBehaviors } from './combo-codegen';
import { sortKeys } from './sorting';
import { getDefaultZmkBoard, getZmkDevelopmentBoard, getZmkDevelopmentBoardInterconnect, getZmkHardwareTarget, ZmkTarget } from './mcu-presets';
import { getDirectLocalMatrixPosition, getDirectMatrixSide, getDirectSideDimensions, getFirmwareMatrixPosition, getLocalMatrixPosition, getMatrixDimensionsFromPositions, getMatrixFromPins, inferMatrixSideFromGeometry, isDirectPinMatrix, MatrixSide } from './matrix-utils';

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

const isNordicTarget = (target: ZmkTarget) => target === 'nrf52832' || target === 'nrf52840';

const getNordicSoc = (target: ZmkTarget) => target === 'nrf52832' ? 'NRF52832_QFAA' : 'NRF52840_QIAA';

const getCustomBoardDtsInclude = (target: ZmkTarget) => {
  if (target === 'nrf52832') return '#include <nordic/nrf52832_qfaa.dtsi>';
  if (target === 'nrf52840') return '#include <nordic/nrf52840_qiaa.dtsi>';
  return `#include <arm/rpi_pico/rp2040.dtsi>
#include <dt-bindings/pinctrl/rpi-pico-rp2040-pinctrl.h>`;
};

const parseZmkGpio = (pin: string, fallback: number, target: ZmkTarget) => {
  if (isNordicTarget(target)) {
    const match = pin.trim().match(/^P([01])\.(\d{1,2})$/i);
    if (match) {
      return { controller: `&gpio${match[1]}`, number: Number(match[2]) };
    }
  }

  return { controller: '&gpio0', number: parseGpioNumber(pin, fallback) };
};

const formatGpios = (pins: string[], target: ZmkTarget, flags: string, label: string) => {
  if (pins.length === 0) {
    return `<&gpio0 0 ${flags}> /* Please configure pins */`;
  }

  return pins.map((pin, index) => {
    const parsed = parseZmkGpio(pin, index, target);
    return `<${parsed.controller} ${parsed.number} ${flags}> /* ${label} ${index}: ${pin} */`;
  }).join('\n            , ');
};

const formatGpio = (pin: string | undefined, target: ZmkTarget, flags: string, fallback: number, label: string) => {
  if (!pin) {
    return `&gpio0 ${fallback} ${flags} /* Please configure ${label} */`;
  }

  const parsed = parseZmkGpio(pin, fallback, target);
  return `${parsed.controller} ${parsed.number} ${flags} /* ${label}: ${pin} */`;
};

const hasConfiguredPin = (pin: string | undefined) => !!pin?.trim();

const hasConfiguredPins = (pins: string[]) => pins.length > 0 && pins.every(hasConfiguredPin);

const hasCompleteEncoderPins = (encoder: NonNullable<ProjectSettings['encoders']>[number]) => (
  hasConfiguredPin(encoder.pinA) && hasConfiguredPin(encoder.pinB)
);

const hasCompleteTrackballPins = (trackball: NonNullable<ProjectSettings['trackballs']>[number]) => (
  hasConfiguredPin(trackball.sclk)
  && hasConfiguredPin(trackball.sdio)
  && hasConfiguredPin(trackball.cs)
  && hasConfiguredPin(trackball.motion)
);

const formatDirectInputGpios = (settings: ProjectSettings, keys: PhysicalKey[], target: ZmkTarget, side?: MatrixSide) => {
  const sourceKeys = side
    ? keys.filter(key => getDirectMatrixSide(settings, key, keys) === side)
    : keys;
  const matrix = side
    ? getDirectSideDimensions(settings, keys, side)
    : getMatrixDimensionsFromPositions(
      sourceKeys.map(key => getDirectLocalMatrixPosition(settings, key, keys)).filter((pos): pos is { row: number; col: number } => !!pos),
      settings.matrix
    );
  const pins = Array.from({ length: matrix.cols }, () => undefined as string | undefined);

  sourceKeys.forEach(key => {
    const pos = getDirectLocalMatrixPosition(settings, key, keys);
    if (!pos) return;
    pins[pos.col] = key.directPin;
  });

  return pins.map((pin, index) => {
    const parsed = pin ? parseZmkGpio(pin, index, target) : { controller: '&gpio0', number: index };
    return `<${parsed.controller} ${parsed.number} (GPIO_ACTIVE_LOW | GPIO_PULL_UP)> /* Direct ${index}: ${pin || 'Please configure pin'} */`;
  }).join('\n            , ');
};

const hasCompleteDirectInputPins = (settings: ProjectSettings, keys: PhysicalKey[], side?: MatrixSide) => {
  const sourceKeys = side
    ? keys.filter(key => getDirectMatrixSide(settings, key, keys) === side)
    : keys;
  const matrix = side
    ? getDirectSideDimensions(settings, keys, side)
    : getMatrixDimensionsFromPositions(
      sourceKeys.map(key => getDirectLocalMatrixPosition(settings, key, keys)).filter((pos): pos is { row: number; col: number } => !!pos),
      settings.matrix
    );
  const pins = new Map<number, string | undefined>();

  sourceKeys.forEach(key => {
    const pos = getDirectLocalMatrixPosition(settings, key, keys);
    if (pos) pins.set(pos.col, key.directPin);
  });

  return matrix.cols > 0 && Array.from({ length: matrix.cols }, (_, index) => pins.get(index)).every(hasConfiguredPin);
};

const getZmkSplitTransport = (settings: ProjectSettings) => settings.zmk?.splitTransport || 'ble';

const getWiredSplitDevice = (settings: ProjectSettings) => settings.zmk?.wiredSplitDevice?.trim() || '&pro_micro_serial';

const getZmkLightingConfigSnippet = (settings: ProjectSettings) => `${settings.features.rgb ? `CONFIG_ZMK_RGB_UNDERGLOW=y
CONFIG_WS2812_STRIP=y` : '# CONFIG_ZMK_RGB_UNDERGLOW is not set'}
${settings.features.backlight ? 'CONFIG_ZMK_BACKLIGHT=y' : '# CONFIG_ZMK_BACKLIGHT is not set'}`;

const generateZmkBuildYaml = (entries: Array<{ board: string; shield?: string }>) => `include:
${entries.map(entry => `  - board: ${entry.board}${entry.shield ? `\n    shield: ${entry.shield}` : ''}`).join('\n')}
`;

const generateZmkBoardYaml = (boardName: string, vendorName: string, target: ZmkTarget) => `board:
  name: ${boardName}
  vendor: ${vendorName}
  socs:
    - name: ${target}
      variants:
        - name: zmk
`;

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

const getZmkMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[] = []) => {
  if (isDirectPinMatrix(settings)) {
    if (settings.features.split) {
      const left = getDirectSideDimensions(settings, keys, 'left');
      const right = getDirectSideDimensions(settings, keys, 'right');
      return {
        rows: Math.max(left.rows, right.rows),
        cols: left.cols + right.cols,
        wiring: settings.matrix?.wiring,
      };
    }
    const positions = keys
      .map(key => getFirmwareMatrixPosition(settings, key, keys))
      .filter((pos): pos is { row: number; col: number } => !!pos);
    return getMatrixDimensionsFromPositions(positions, settings.matrix);
  }
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
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>,
  keys: Array<Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>> = []
) => {
  if (isDirectPinMatrix(settings)) {
    const local = getDirectLocalMatrixPosition(settings, key, keys);
    if (!local) return undefined;
    if (!settings.features.split) return local;
    const side = getDirectMatrixSide(settings, key, keys);
    const leftCols = getDirectSideDimensions(settings, keys, 'left').cols;
    return {
      row: local.row,
      col: side === 'right' ? local.col + leftCols : local.col,
    };
  }
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
  const matrix = getZmkMatrixDimensions(settings, keys);

  return keys.filter((key, idx) => {
    if (!isDirectPinMatrix(settings) && (key.row === undefined || key.col === undefined)) return false;
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

const getEncoderKey = (settings: ProjectSettings, keys: PhysicalKey[], encoderIndex: number) => (
  keys.find(key => {
    if (key.encoderId) {
      return (settings.encoders || []).findIndex(encoder => encoder.id === key.encoderId) === encoderIndex;
    }
    return key.encoderIndex === encoderIndex;
  })
);

const getEncoderSide = (settings: ProjectSettings, keys: PhysicalKey[], encoderIndex: number): MatrixSide => {
  if (!settings.features.split) return 'left';
  const key = getEncoderKey(settings, keys, encoderIndex);
  if (!key) return 'left';
  return getLocalMatrixPosition(settings, key, keys)?.side || key.matrixSide || inferMatrixSideFromGeometry(key, keys);
};

const getEncoderConfigSnippet = (settings: ProjectSettings) => (
  (settings.encoders || []).some(hasCompleteEncoderPins)
    ? 'CONFIG_EC11=y\nCONFIG_EC11_TRIGGER_GLOBAL_THREAD=y\n'
    : ''
);

const getTrackballConfigSnippet = (settings: ProjectSettings) => (
  (settings.trackballs || []).some(hasCompleteTrackballPins)
    ? 'CONFIG_SPI=y\nCONFIG_INPUT=y\nCONFIG_ZMK_POINTING=y\nCONFIG_PMW3610_ALT=y\n'
    : ''
);

const getTrackballSide = (settings: ProjectSettings, keys: PhysicalKey[], index: number): MatrixSide => {
  const key = keys.find(item => item.trackballId
    ? (settings.trackballs || []).findIndex(trackball => trackball.id === item.trackballId) === index
    : item.trackballIndex === index);
  return !settings.features.split || !key ? 'left' : getLocalMatrixPosition(settings, key, keys)?.side || key.matrixSide || inferMatrixSideFromGeometry(key, keys);
};

const formatNordicPsel = (pin: string | undefined, fallback: number, signal: string) => {
  const match = pin?.trim().match(/^P([01])\.(\d{1,2})$/i);
  return `NRF_PSEL(${signal}, ${match?.[1] || 0}, ${match?.[2] || fallback})`;
};

const generateZmkTrackballNodes = (settings: ProjectSettings, keys: PhysicalKey[], target: ZmkTarget, side?: MatrixSide) => {
  const trackballs = (settings.trackballs || []).map((trackball, index) => ({ trackball, index }))
    .filter(item => hasCompleteTrackballPins(item.trackball))
    .filter(item => !side || getTrackballSide(settings, keys, item.index) === side);
  if (trackballs.length === 0) return '';
  return `${trackballs.map(({ trackball, index }) => `&pinctrl {
    smidr_pmw3610_spi${index}_default: smidr_pmw3610_spi${index}_default {
        group1 {
            psels = <${formatNordicPsel(trackball.sclk, index * 4, 'SPIM_SCK')}>, <${formatNordicPsel(trackball.sdio, index * 4 + 1, 'SPIM_MOSI')}>;
        };
    };
};

&spi${index} {
    status = "okay";
    pinctrl-0 = <&smidr_pmw3610_spi${index}_default>;
    pinctrl-names = "default";
    cs-gpios = <${formatGpio(trackball.cs, target, 'GPIO_ACTIVE_LOW', index * 4 + 2, `Trackball ${index} CS`)}>;
    trackball_${index}: pmw3610_${index} {
        compatible = "pixart,pmw3610-alt";
        reg = <0>;
        irq-gpios = <${formatGpio(trackball.motion, target, '(GPIO_ACTIVE_LOW | GPIO_PULL_UP)', index * 4 + 3, `Trackball ${index} MOTION`)}>;
        cpi = <${trackball.cpi || 1200}>;${trackball.swapXy ? '\n        swap-xy;' : ''}${trackball.invertX ? '\n        invert-x;' : ''}${trackball.invertY ? '\n        invert-y;' : ''}
    };
};`).join('\n\n')}`;
};

const generateZmkWestManifest = () => `manifest:
  remotes:
    - name: zmkfirmware
      url-base: https://github.com/zmkfirmware
    - name: badjeff
      url-base: https://github.com/badjeff
  projects:
    - name: zmk
      remote: zmkfirmware
      revision: main
      import: app/west.yml
    - name: zmk-pmw3610-driver
      remote: badjeff
      revision: zmk-0.4
  self:
    path: config
`;

const generateZmkEncoderNodes = (
  settings: ProjectSettings,
  zmkTarget: ZmkTarget,
  statusForEncoder: (index: number) => 'okay' | 'disabled',
) => {
  const encoders = (settings.encoders || []).map((encoder, index) => ({ encoder, index }))
    .filter(({ encoder }) => hasCompleteEncoderPins(encoder));
  if (encoders.length === 0) return '';

  return `${encoders.map(({ encoder, index }) => `    encoder_${index}: encoder_${index} {
        compatible = "alps,ec11";
        a-gpios = <${formatGpio(encoder.pinA, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_UP)', index * 2, `Encoder ${index} A`)}>;
        b-gpios = <${formatGpio(encoder.pinB, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_UP)', index * 2 + 1, `Encoder ${index} B`)}>;
        steps = <80>;
        status = "${statusForEncoder(index)}";
    };`).join('\n\n')}

    sensors: sensors {
        compatible = "zmk,keymap-sensors";
        sensors = <${encoders.map(({ index }) => `&encoder_${index}`).join(' ')}>;
        triggers-per-rotation = <20>;
    };
`;
};

const generateZmkEncoderStatusOverrides = (settings: ProjectSettings, keys: PhysicalKey[], side?: MatrixSide) => {
  const encoders = settings.encoders || [];
  if (encoders.length === 0) return '';

  const matching = encoders
    .map((_, index) => ({ index, side: getEncoderSide(settings, keys, index) }))
    .filter(({ index }) => hasCompleteEncoderPins(encoders[index]))
    .filter(item => !side || item.side === side);

  if (matching.length === 0) return '';

  return `\n${matching.map(({ index }) => `&encoder_${index} {
    status = "okay";
};`).join('\n\n')}
`;
};

const zmkActionForEncoder = (settings: ProjectSettings, action?: UniversalAction) => {
  const safeAction: UniversalAction = action || { action: 'trans' };
  return safeAction.action === 'td'
    ? actionToZmkSourceString(safeAction)
    : actionToZmkSourceStringWithMacros(safeAction, settings.macros || []);
};

const generateZmkEncoderBehaviors = (settings: ProjectSettings) => {
  const encoders = (settings.encoders || []).map((encoder, index) => ({ encoder, index }))
    .filter(({ encoder }) => hasCompleteEncoderPins(encoder));
  if (encoders.length === 0) return '';

  const layersCount = settings.layers || 4;
  const behaviors: string[] = [];
  for (let layer = 0; layer < layersCount; layer++) {
    encoders.forEach(({ encoder, index }) => {
      const clockwise = zmkActionForEncoder(settings, encoder.keymap?.[layer]?.clockwise);
      const counterClockwise = zmkActionForEncoder(settings, encoder.keymap?.[layer]?.counterClockwise);
      behaviors.push(`        smidr_encoder_${index}_layer_${layer}: smidr_encoder_${index}_layer_${layer} {
            compatible = "zmk,behavior-sensor-rotate";
            #sensor-binding-cells = <0>;
            bindings = <${clockwise}>, <${counterClockwise}>;
        };`);
    });
  }

  return `    smidr_encoder_behaviors {
${behaviors.join('\n\n')}
    };

`;
};

const generateZmkEncoderSensorBindings = (settings: ProjectSettings, layer: number) => {
  const encoders = (settings.encoders || []).map((encoder, index) => ({ encoder, index }))
    .filter(({ encoder }) => hasCompleteEncoderPins(encoder));
  if (encoders.length === 0) return '';

  return `
            sensor-bindings = <
                ${encoders.map(({ index }) => `&smidr_encoder_${index}_layer_${layer}`).join(' ')}
            >;`;
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
#include <dt-bindings/zmk/backlight.h>
#include <dt-bindings/zmk/mouse.h>

/ {
${generateZmkTapDanceBehaviors(settings.tapDances || [])}
${generateZmkMacroBehaviors(settings.macros || [])}
${generateZmkComboBehaviors(settings.combos || [], sortedKeys, settings.macros || [])}
${generateZmkEncoderBehaviors(settings)}
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
            >;${generateZmkEncoderSensorBindings(settings, l)}
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

  const matrix = getZmkMatrixDimensions(settings, keys);
  const leftPins = getSidePins(settings, 'left');
  const rightPins = getSidePins(settings, 'right');
  const useDirectPins = isDirectPinMatrix(settings);
  const leftDirectPins = useDirectPins ? formatDirectInputGpios(settings, keys, zmkTarget, 'left') : '';
  const rightDirectPins = useDirectPins ? formatDirectInputGpios(settings, keys, zmkTarget, 'right') : '';
  const leftDirectCols = useDirectPins ? getDirectSideDimensions(settings, keys, 'left').cols : 0;
  const leftRows = formatGpios(leftPins.rows, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Left row');
  const leftCols = formatGpios(leftPins.cols, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Left col');
  const rightRows = formatGpios(rightPins.rows, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Right row');
  const rightCols = formatGpios(rightPins.cols, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Right col');
  const leftKscanEnabled = useDirectPins
    ? hasCompleteDirectInputPins(settings, keys, 'left')
    : hasConfiguredPins(leftPins.rows) && hasConfiguredPins(leftPins.cols);
  const rightKscanEnabled = useDirectPins
    ? hasCompleteDirectInputPins(settings, keys, 'right')
    : hasConfiguredPins(rightPins.rows) && hasConfiguredPins(rightPins.cols);
  const transformMapStr = formatTransformMap(settings, sortedKeys, keys);
  const leftShield = `${kbName}_left`;
  const rightShield = `${kbName}_right`;
  const requiredInterconnect = getZmkDevelopmentBoardInterconnect(settings.hardware.board);
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
        compatible = "${useDirectPins ? 'zmk,kscan-gpio-direct' : 'zmk,kscan-gpio-matrix'}";
${useDirectPins ? '' : `        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";`}
        wakeup-source;
    };
${generateZmkEncoderNodes(settings, zmkTarget, () => 'disabled')}
${wiredSplitNode}
};
`;
  shieldsFolder.file(`${kbName}.dtsi`, sharedDtsi);

  const leftOverlay = `#include "${kbName}.dtsi"

&kscan0 {
${leftKscanEnabled ? (useDirectPins ? `    input-gpios
        = ${leftDirectPins}
        ;` : `    row-gpios
        = ${leftRows}
        ;

    col-gpios
        = ${leftCols}
        ;`) : '    status = "disabled";'}
};
${generateZmkEncoderStatusOverrides(settings, keys, 'left')}
${generateZmkTrackballNodes(settings, keys, zmkTarget, 'left')}
`;
  shieldsFolder.file(`${leftShield}.overlay`, leftOverlay);

  const rightOverlay = `#include "${kbName}.dtsi"

&default_transform {
    col-offset = <${useDirectPins ? leftDirectCols : leftPins.cols.length}>;
};

&kscan0 {
${rightKscanEnabled ? (useDirectPins ? `    input-gpios
        = ${rightDirectPins}
        ;` : `    row-gpios
        = ${rightRows}
        ;

    col-gpios
        = ${rightCols}
        ;`) : '    status = "disabled";'}
};
${generateZmkEncoderStatusOverrides(settings, keys, 'right')}
${generateZmkTrackballNodes(settings, keys, zmkTarget, 'right')}
`;
  shieldsFolder.file(`${rightShield}.overlay`, rightOverlay);

  const sharedConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# Lighting features
${getZmkLightingConfigSnippet(settings)}
${getEncoderConfigSnippet(settings)}${getTrackballConfigSnippet(settings)}
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
requires:
  - ${requiredInterconnect}
features:
  - keys
siblings:
  - ${leftShield}
  - ${rightShield}
`;
  shieldsFolder.file(`${kbName}.zmk.yml`, zmkYml);

  const keymap = generateKeymapDts(settings, sortedKeys, kbName);
  shieldsFolder.file(keymap.filename, keymap.content);
  zip.file('build.yaml', generateZmkBuildYaml([
    { board: boardName, shield: leftShield },
    { board: boardName, shield: rightShield },
  ]));

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
The shared \`${kbName}.dtsi\` file defines the full matrix transform. The right half overlay applies \`col-offset = <${useDirectPins ? leftDirectCols : leftPins.cols.length}>\` so local right-side matrix events map into the right side of the shared transform.
${splitTransport === 'wired' ? `\n## Wired Split\nThe shared \`${kbName}.dtsi\` file enables ZMK wired split using \`${wiredSplitDevice}\`. Verify this UART device exists for the selected board before building.\n` : ''}
`;
  zip.file('README.md', readmeContent);

  return true;
};

const generateSplitCustomBoardFiles = (
  zip: JSZip,
  settings: ProjectSettings,
  keys: PhysicalKey[],
  sortedKeys: PhysicalKey[],
  kbName: string,
  vendorName: string,
  zmkTarget: ZmkTarget,
) => {
  const arch = 'arm';
  const leftBoard = `${kbName}_left`;
  const rightBoard = `${kbName}_right`;
  const matrix = getZmkMatrixDimensions(settings, keys);
  const leftPins = getSidePins(settings, 'left');
  const rightPins = getSidePins(settings, 'right');
  const useDirectPins = isDirectPinMatrix(settings);
  const leftDirectCols = useDirectPins ? getDirectSideDimensions(settings, keys, 'left').cols : 0;
  const transformMapStr = formatTransformMap(settings, sortedKeys, keys);
  const splitTransport = getZmkSplitTransport(settings);
  const wiredSplitDevice = getWiredSplitDevice(settings);
  const processorSelect = isNordicTarget(zmkTarget) ? getNordicSoc(zmkTarget) : 'RP2040';
  const dtsInclude = getCustomBoardDtsInclude(zmkTarget);
  const dtsChosen = isNordicTarget(zmkTarget)
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
  const peripheralDts = isNordicTarget(zmkTarget) ? `
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

        code_partition: partition@${zmkTarget === 'nrf52832' ? '0' : '26000'} {
            label = "code_partition";
            reg = <${zmkTarget === 'nrf52832' ? '0x00000000 0x00078000' : '0x00026000 0x000d2000'}>;
        };

        storage_partition: partition@${zmkTarget === 'nrf52832' ? '78000' : 'f8000'} {
            label = "storage";
            reg = <${zmkTarget === 'nrf52832' ? '0x00078000 0x00008000' : '0x000f8000 0x00008000'}>;
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

  const makeBoard = (side: MatrixSide, boardName: string, sidePins: ReturnType<typeof getSidePins>) => {
    const boardFolder = zip.folder('boards')?.folder(arch)?.folder(boardName);
    if (!boardFolder) return;

    const rowGpios = formatGpios(sidePins.rows, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', `${side} row`);
    const colGpios = formatGpios(sidePins.cols, zmkTarget, 'GPIO_ACTIVE_HIGH', `${side} col`);
    const directGpios = useDirectPins ? formatDirectInputGpios(settings, keys, zmkTarget, side) : '';
    const kscanEnabled = useDirectPins
      ? hasCompleteDirectInputPins(settings, keys, side)
      : hasConfiguredPins(sidePins.rows) && hasConfiguredPins(sidePins.cols);
    const colOffset = side === 'right' ? `

&default_transform {
    col-offset = <${useDirectPins ? leftDirectCols : leftPins.cols.length}>;
};
` : '';
    const wiredSplitNode = splitTransport === 'wired' ? `
    wired_split {
        compatible = "zmk,wired-split";
        device = <${wiredSplitDevice}>;
    };
` : '';

    const kconfigBoard = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config BOARD_${boardName.toUpperCase()}
    bool "${settings.name} ${side}"
    select SOC_${processorSelect}
`;
    boardFolder.file('Kconfig.board', kconfigBoard);

    const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if BOARD_${boardName.toUpperCase()}

config BOARD
    default "${boardName}"

${side === 'left' ? `config ZMK_KEYBOARD_NAME
    default "${settings.name}"

config ZMK_SPLIT_ROLE_CENTRAL
    default y
` : ''}
config ZMK_SPLIT
    default y

${isNordicTarget(zmkTarget) ? `config ZMK_BLE
    default y

${zmkTarget === 'nrf52840' ? `config ZMK_USB
    default y
` : ''}
` : `config RP2_FLASH_W25Q080
    default y
`}
endif
`;
    boardFolder.file('Kconfig.defconfig', kconfigDefconfig);

    const boardDefconfig = `CONFIG_GPIO=y
CONFIG_ZMK=y
${zmkTarget !== 'nrf52832' ? 'CONFIG_USB=y\n' : ''}${isNordicTarget(zmkTarget) ? 'CONFIG_BT=y\nCONFIG_ZMK_BLE=y\n' : ''}
CONFIG_FLASH=y
CONFIG_SETTINGS=y
CONFIG_SETTINGS_NVS=y
${zmkTarget === 'rp2040' ? 'CONFIG_BUILD_OUTPUT_UF2=y' : 'CONFIG_BUILD_OUTPUT_HEX=y'}
CONFIG_PINCTRL=y
CONFIG_CLOCK_CONTROL=y
CONFIG_FLASH_PAGE_LAYOUT=y
${isNordicTarget(zmkTarget) ? 'CONFIG_NVS=y\nCONFIG_MPU_ALLOW_FLASH_WRITE=y\n' : ''}
CONFIG_RETAINED_MEM=y
CONFIG_RETENTION=y
CONFIG_RETENTION_BOOT_MODE=y
`;
    boardFolder.file(`${boardName}_defconfig`, boardDefconfig);

    const boardConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# Lighting features
${getZmkLightingConfigSnippet(settings)}
${getEncoderConfigSnippet(settings)}${getTrackballConfigSnippet(settings)}
${splitTransport === 'wired' ? '\nCONFIG_ZMK_SPLIT_BLE=n\nCONFIG_ZMK_SPLIT_WIRED=y\n' : ''}
`;
    boardFolder.file(`${boardName}.conf`, boardConf);

    const boardDts = `/dts-v1/;
${dtsInclude}
#include <dt-bindings/zmk/matrix_transform.h>

/ {
    model = "${settings.name} ${side}";
    compatible = "${vendorName},${boardName}";

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
${useDirectPins ? `        compatible = "zmk,kscan-gpio-direct";` : `        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";`}
        wakeup-source;

${kscanEnabled ? (useDirectPins ? `        input-gpios
            = ${directGpios}
            ;` : `        row-gpios
            = ${rowGpios}
            ;

        col-gpios
            = ${colGpios}
            ;`) : '        status = "disabled";'}
    };
${generateZmkEncoderNodes(settings, zmkTarget, index => getEncoderSide(settings, keys, index) === side ? 'okay' : 'disabled')}
${wiredSplitNode}
};
${generateZmkTrackballNodes(settings, keys, zmkTarget, side)}
${colOffset}

${peripheralDts}
`;
    boardFolder.file(`${boardName}.dts`, boardDts);
    boardFolder.file('board.yml', generateZmkBoardYaml(boardName, vendorName, zmkTarget));

    const zmkYml = `file_format: "1"
id: ${boardName}
name: "${settings.name} ${side}"
type: board
features:
  - keys
`;
    boardFolder.file(`${boardName}.zmk.yml`, zmkYml);
  };

  makeBoard('left', leftBoard, leftPins);
  makeBoard('right', rightBoard, rightPins);

  const configFolder = zip.folder('config');
  if (configFolder) {
    const keymap = generateKeymapDts(settings, sortedKeys, kbName);
    configFolder.file(keymap.filename, keymap.content);
  }
  zip.file('build.yaml', generateZmkBuildYaml([
    { board: leftBoard },
    { board: rightBoard },
  ]));

  const readmeContent = `# ZMK Config for ${settings.name}

This directory structure has been automatically generated by **Smidr** to compile ZMK ${splitTransport} split firmware for your custom keyboard.

## Directory Structure
- \`config/${kbName}.keymap\`: Contains all keymap layers defined in Smidr.
- \`boards/arm/${leftBoard}/\`: Contains the left custom board definition files.
- \`boards/arm/${rightBoard}/\`: Contains the right custom board definition files.

## Setup and Compilation
To build ZMK firmware using this configuration:
1. Initialize or open your \`zmk-config\` repository.
2. Copy the \`config/\` and \`boards/\` directories from this exported folder directly into your \`zmk-config\` repository.
3. Configure your GitHub Actions \`build.yaml\` file:
   \`\`\`yaml
   include:
     - board: ${leftBoard}
     - board: ${rightBoard}
   \`\`\`
4. Push the changes to GitHub and download the compiled firmware binaries from the GitHub Actions tab.

## Split Matrix
Both custom board DTS files define the full matrix transform. The right board applies \`col-offset = <${useDirectPins ? leftDirectCols : leftPins.cols.length}>\` so local right-side matrix events map into the right side of the shared transform.
${splitTransport === 'wired' ? `\n## Wired Split\nBoth board DTS files enable ZMK wired split using \`${wiredSplitDevice}\`. Verify this UART device exists on both generated boards before building.\n` : ''}
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
  
  const zmkTarget = getZmkHardwareTarget(settings.hardware);
  if (!zmkTarget) {
    throw new Error('ZMK export is currently implemented for RP2040 and nRF52 projects only.');
  }
  if ((settings.trackballs || []).some(hasCompleteTrackballPins) && !isNordicTarget(zmkTarget)) {
    throw new Error('PMW3610 trackball export currently requires an nRF52 target because the generated SPI pinctrl overlay uses Nordic pin bindings.');
  }

  const boardName = getZmkDevelopmentBoard(settings.hardware.board || getDefaultZmkBoard(settings.hardware.mcu));
  const requiredInterconnect = getZmkDevelopmentBoardInterconnect(settings.hardware.board || getDefaultZmkBoard(settings.hardware.mcu));

  if (settings.features.split) {
    if ((settings.trackballs || []).some(hasCompleteTrackballPins)) zip.folder('config')?.file('west.yml', generateZmkWestManifest());
    if (settings.hardware.controllerType === 'mcu') {
      if (getZmkSplitTransport(settings) === 'ble' && !isNordicTarget(zmkTarget)) {
        throw new Error('ZMK BLE split export currently requires an nRF52 MCU.');
      }
      generateSplitCustomBoardFiles(zip, settings, keys, sortedKeys, kbName, vendorName, zmkTarget);
      return await zip.generateAsync({ type: 'blob' });
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
  if ((settings.trackballs || []).some(hasCompleteTrackballPins)) configFolder.file('west.yml', generateZmkWestManifest());

  const transformMapStr = formatTransformMap(settings, sortedKeys, keys);
  const matrix = getZmkMatrixDimensions(settings, keys);
  const useDirectPins = isDirectPinMatrix(settings);

  const rowPins = settings.pins.rows || [];
  const rowGpiosStr = formatGpios(rowPins, zmkTarget, '(GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)', 'Row');

  const colPins = settings.pins.cols || [];
  const colGpiosStr = formatGpios(colPins, zmkTarget, 'GPIO_ACTIVE_HIGH', 'Col');
  const directGpiosStr = useDirectPins
    ? formatDirectInputGpios(settings, sortedKeys, zmkTarget)
    : '';
  const kscanEnabled = useDirectPins
    ? hasCompleteDirectInputPins(settings, sortedKeys)
    : hasConfiguredPins(rowPins) && hasConfiguredPins(colPins);

  if (settings.hardware.controllerType === 'mcu') {
    const arch = 'arm';
    const boardFolder = zip.folder('boards')?.folder(arch)?.folder(kbName);
    if (!boardFolder) return null;

    const kconfigBoard = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

config BOARD_${kbName.toUpperCase()}
    bool "${settings.name}"
    select SOC_${isNordicTarget(zmkTarget) ? getNordicSoc(zmkTarget) : 'RP2040'}
`;
    boardFolder.file('Kconfig.board', kconfigBoard);

    const kconfigDefconfig = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

if BOARD_${kbName.toUpperCase()}

config BOARD
    default "${kbName}"

config ZMK_KEYBOARD_NAME
    default "${settings.name}"

${isNordicTarget(zmkTarget) ? `config ZMK_BLE
    default y

${zmkTarget === 'nrf52840' ? `config ZMK_USB
    default y
` : ''}
` : `config RP2_FLASH_W25Q080
    default y
`}
endif
`;
    boardFolder.file('Kconfig.defconfig', kconfigDefconfig);

    const boardDefconfig = `CONFIG_GPIO=y
CONFIG_ZMK=y
${zmkTarget !== 'nrf52832' ? 'CONFIG_USB=y\n' : ''}${isNordicTarget(zmkTarget) ? 'CONFIG_BT=y\nCONFIG_ZMK_BLE=y\n' : ''}
CONFIG_FLASH=y
CONFIG_SETTINGS=y
CONFIG_SETTINGS_NVS=y
${zmkTarget === 'rp2040' ? 'CONFIG_BUILD_OUTPUT_UF2=y' : 'CONFIG_BUILD_OUTPUT_HEX=y'}
CONFIG_PINCTRL=y
CONFIG_CLOCK_CONTROL=y
CONFIG_FLASH_PAGE_LAYOUT=y
${isNordicTarget(zmkTarget) ? 'CONFIG_NVS=y\nCONFIG_MPU_ALLOW_FLASH_WRITE=y\n' : ''}
CONFIG_RETAINED_MEM=y
CONFIG_RETENTION=y
CONFIG_RETENTION_BOOT_MODE=y
`;
    boardFolder.file(`${kbName}_defconfig`, boardDefconfig);

    const keyboardConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# Lighting features
${getZmkLightingConfigSnippet(settings)}
${getEncoderConfigSnippet(settings)}
`;
    boardFolder.file(`${kbName}.conf`, keyboardConf);

    const dtsInclude = getCustomBoardDtsInclude(zmkTarget);

    const dtsChosen = isNordicTarget(zmkTarget)
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

    const peripheralDts = isNordicTarget(zmkTarget) ? `
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

        code_partition: partition@${zmkTarget === 'nrf52832' ? '0' : '26000'} {
            label = "code_partition";
            reg = <${zmkTarget === 'nrf52832' ? '0x00000000 0x00078000' : '0x00026000 0x000d2000'}>;
        };

        storage_partition: partition@${zmkTarget === 'nrf52832' ? '78000' : 'f8000'} {
            label = "storage";
            reg = <${zmkTarget === 'nrf52832' ? '0x00078000 0x00008000' : '0x000f8000 0x00008000'}>;
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
${useDirectPins ? `        compatible = "zmk,kscan-gpio-direct";${kscanEnabled ? `

        input-gpios
            = ${directGpiosStr}
            ;` : '\n        status = "disabled";'}` : `        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";

${kscanEnabled ? `        row-gpios
            = ${rowGpiosStr}
            ;

        col-gpios
            = ${colGpiosStr}
            ;` : '        status = "disabled";'}`}
    };
${generateZmkEncoderNodes(settings, zmkTarget, () => 'okay')}
};
${generateZmkTrackballNodes(settings, keys, zmkTarget)}

${peripheralDts}
`;
    boardFolder.file(`${kbName}.dts`, keyboardDts);
    boardFolder.file('board.yml', generateZmkBoardYaml(kbName, vendorName, zmkTarget));

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
${useDirectPins ? `        compatible = "zmk,kscan-gpio-direct";${kscanEnabled ? `

        input-gpios
            = ${directGpiosStr}
            ;` : '\n        status = "disabled";'}` : `        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "${settings.hardware.diodeDirection === 'ROW2COL' ? 'row2col' : 'col2row'}";

${kscanEnabled ? `        row-gpios
            = ${rowGpiosStr}
            ;

        col-gpios
            = ${colGpiosStr}
            ;` : '        status = "disabled";'}`}
    };
${generateZmkEncoderNodes(settings, zmkTarget, () => 'okay')}
};
${generateZmkTrackballNodes(settings, keys, zmkTarget)}
`;
    shieldsFolder.file(`${kbName}.overlay`, shieldOverlay);

    const shieldConf = `# Copyright (c) 2026 ${settings.manufacturer || 'Smidr User'}
# SPDX-License-Identifier: MIT

# Enable deep sleep support (uncomment to activate)
# CONFIG_ZMK_SLEEP=y

# Lighting features
${getZmkLightingConfigSnippet(settings)}
${getEncoderConfigSnippet(settings)}${getTrackballConfigSnippet(settings)}
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
requires:
  - ${requiredInterconnect}
features:
  - keys
`;
    shieldsFolder.file(`${kbName}.zmk.yml`, zmkYml);
  }
  zip.file('build.yaml', generateZmkBuildYaml(
    settings.hardware.controllerType === 'mcu'
      ? [{ board: kbName }]
      : [{ board: boardName, shield: kbName }]
  ));

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
#include <dt-bindings/zmk/backlight.h>
#include <dt-bindings/zmk/mouse.h>

/ {
${generateZmkTapDanceBehaviors(settings.tapDances || [])}
${generateZmkMacroBehaviors(settings.macros || [])}
${generateZmkComboBehaviors(settings.combos || [], sortedKeys, settings.macros || [])}
${generateZmkEncoderBehaviors(settings)}
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
            >;${generateZmkEncoderSensorBindings(settings, l)}
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
