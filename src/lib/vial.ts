import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';
import { TapDanceEntry } from '@/types/actions';
import { generateQmkTapDanceC } from './tap-dance-codegen';
import { actionToQmkSourceString, generateQmkStaticMacroC } from './macro-codegen';
import { generateQmkComboC, hasConfiguredCombos } from './combo-codegen';
import { getDefaultBootloader, getDefaultDevelopmentBoard, getQmkDevelopmentBoard, getQmkProcessor, getSplitSerialDriver } from './mcu-presets';
import { getDirectLocalMatrixPosition, getDirectMatrixSide, getDirectSideDimensions, getFirmwareMatrixPosition, getMatrixDimensionsFromPositions, getQmkMatrixFromPins, isDirectPinMatrix, MatrixSide } from './matrix-utils';

const hasPins = (pins: string[] | undefined) => (pins?.filter(Boolean).length ?? 0) > 0;

const getMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrixKeys = isDirectPinMatrix(settings)
    ? keys
    : keys.filter(key => (
      key.row !== undefined &&
      key.col !== undefined &&
      key.row >= 0 &&
      key.col >= 0
    ));

  const positions = matrixKeys
    .map(key => getFirmwareMatrixPosition(settings, key, keys))
    .filter((pos): pos is { row: number; col: number } => !!pos);
  const pinMatrix = getQmkMatrixFromPins(settings.pins, settings.features.split);
  if (isDirectPinMatrix(settings)) {
    return getMatrixDimensionsFromPositions(positions, settings.matrix);
  }

  return {
    ...getMatrixDimensionsFromPositions(positions, {
      ...settings.matrix,
      rows: pinMatrix?.rows || settings.matrix?.rows || 0,
      cols: pinMatrix?.cols || settings.matrix?.cols || 0,
    }),
  };
};

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, keys);

  return keys.filter((key, idx) => {
    if (!isDirectPinMatrix(settings) && (key.row === undefined || key.col === undefined)) return false;
    const pos = getFirmwareMatrixPosition(settings, key, keys);
    if (!pos || pos.row < 0 || pos.col < 0) return false;
    if (pos.row >= matrix.rows || pos.col >= matrix.cols) return false;
    const firstIdx = keys.findIndex(k => {
      const other = getFirmwareMatrixPosition(settings, k, keys);
      return other?.row === pos.row && other?.col === pos.col;
    });
    return firstIdx === idx;
  });
};

const shouldUseMatrixMask = (settings: ProjectSettings) => {
  return settings.qmk?.matrixMasked === true;
};

const getRgbMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  settings.features.rgbMatrix
    ? keys.filter(key => Number.isInteger(key.ledIndex) && key.ledIndex! >= 0)
    : []
);

const getRgbMatrixLedCount = (keys: PhysicalKey[]) => (
  keys.length === 0 ? 0 : Math.max(...keys.map(key => key.ledIndex ?? -1)) + 1
);

const generateDirectPins = (settings: ProjectSettings, validKeys: PhysicalKey[], allKeys: PhysicalKey[], side?: MatrixSide) => {
  const sourceKeys = side
    ? validKeys.filter(key => getDirectMatrixSide(settings, key, allKeys) === side)
    : validKeys;
  const matrix = side
    ? getDirectSideDimensions(settings, allKeys, side)
    : getMatrixDimensions(settings, validKeys);
  const direct = Array.from({ length: matrix.rows }, () =>
    Array.from({ length: matrix.cols }, () => 'NO_PIN')
  );

  sourceKeys.forEach(key => {
    const pos = side
      ? getDirectLocalMatrixPosition(settings, key, allKeys)
      : getFirmwareMatrixPosition(settings, key, allKeys);
    if (!pos) return;
    direct[pos.row][pos.col] = key.directPin?.trim() || 'NO_PIN';
  });

  return direct;
};

const getConfiguredEncoders = (settings: ProjectSettings) => {
  return settings.encoders || [];
};

const getBootmagicConfig = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  if (settings.qmk?.bootmagic?.enabled === false) {
    return { enabled: false };
  }

  const firstKey = validKeys[0];
  const firstPos = firstKey ? getFirmwareMatrixPosition(settings, firstKey, validKeys) : undefined;
  const row = Number.isInteger(settings.qmk?.bootmagic?.row)
    ? settings.qmk!.bootmagic!.row!
    : firstPos?.row ?? firstKey?.row ?? 0;
  const col = Number.isInteger(settings.qmk?.bootmagic?.col)
    ? settings.qmk!.bootmagic!.col!
    : firstPos?.col ?? firstKey?.col ?? 0;

  return {
    enabled: true,
    matrix: [row, col],
  };
};

const getVialUnlockCombo = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  const firstKey = validKeys[0];
  const lastKey = validKeys[validKeys.length - 1] || firstKey;
  const firstPos = firstKey ? getFirmwareMatrixPosition(settings, firstKey, validKeys) : undefined;
  const lastPos = lastKey ? getFirmwareMatrixPosition(settings, lastKey, validKeys) : undefined;
  const configuredKey1 = settings.vial?.unlockCombo?.key1;
  const configuredKey2 = settings.vial?.unlockCombo?.key2;

  return {
    key1: {
      row: Number.isInteger(configuredKey1?.row) ? configuredKey1!.row! : firstPos?.row ?? firstKey?.row ?? 0,
      col: Number.isInteger(configuredKey1?.col) ? configuredKey1!.col! : firstPos?.col ?? firstKey?.col ?? 0,
    },
    key2: {
      row: Number.isInteger(configuredKey2?.row) ? configuredKey2!.row! : lastPos?.row ?? lastKey?.row ?? 0,
      col: Number.isInteger(configuredKey2?.col) ? configuredKey2!.col! : lastPos?.col ?? lastKey?.col ?? 0,
    },
  };
};

const generateMatrixMaskC = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, validKeys);
  const rowMasks = Array.from({ length: matrix.rows }, () => BigInt(0));

  validKeys.forEach(key => {
    const pos = getFirmwareMatrixPosition(settings, key, validKeys);
    if (!pos) return;
    rowMasks[pos.row] |= BigInt(1) << BigInt(pos.col);
  });

  const rows = rowMasks.map(mask => `    (matrix_row_t)0x${mask.toString(16).toUpperCase()}ULL`).join(',\n');

  return `#include "quantum.h"

const matrix_row_t matrix_mask[MATRIX_ROWS] = {
${rows}
};
`;
};

const generateRgbMatrixConfigC = (settings: ProjectSettings, validKeys: PhysicalKey[], allKeys: PhysicalKey[]) => {
  const rgbKeys = getRgbMatrixKeys(settings, validKeys);
  const ledCount = getRgbMatrixLedCount(rgbKeys);
  if (ledCount === 0) return '';

  const matrix = getMatrixDimensions(settings, validKeys);
  const matrixRows = Array.from({ length: matrix.rows }, () =>
    Array.from({ length: matrix.cols }, () => 'NO_LED')
  );
  const positions = Array.from({ length: ledCount }, () => ({ x: 0, y: 0 }));
  const flags = Array.from({ length: ledCount }, () => 4);

  rgbKeys.forEach(key => {
    const ledIndex = key.ledIndex!;
    const pos = getFirmwareMatrixPosition(settings, key, allKeys);
    if (pos && pos.row >= 0 && pos.row < matrix.rows && pos.col >= 0 && pos.col < matrix.cols) {
      matrixRows[pos.row][pos.col] = String(ledIndex);
    }
    positions[ledIndex] = { x: key.ledX ?? 0, y: key.ledY ?? 0 };
    flags[ledIndex] = key.ledFlags ?? 4;
  });

  return `
#ifdef RGB_MATRIX_ENABLE
led_config_t g_led_config = {
  {
${matrixRows.map(row => `    { ${row.join(', ')} }`).join(',\n')}
  }, {
${positions.map(position => `    { ${position.x}, ${position.y} }`).join(',\n')}
  }, {
    ${flags.join(', ')}
  }
};
#endif
`;
};

const generateKeymapC = (validKeys: PhysicalKey[], layersCount: number, settings: ProjectSettings, tapDances: TapDanceEntry[] = []) => {
  const encoders = getConfiguredEncoders(settings);
  let keymapC = `#include QMK_KEYBOARD_H

${generateQmkTapDanceC(tapDances)}
${generateQmkStaticMacroC(settings.macros || [])}
${generateQmkComboC(settings.combos || [], settings.macros || [])}
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
`;

  for (let i = 0; i < layersCount; i++) {
    keymapC += `  [${i}] = LAYOUT(\n    `;
    keymapC += validKeys.map(key => {
      const action = key.keymap?.[i] || { action: 'trans' as const };
      return actionToQmkSourceString(action, settings.macros || []);
    }).join(', ');
    keymapC += `\n  ),\n`;
  }
  keymapC += `};\n`;

  if (encoders.length > 0) {
    keymapC += `
#if defined(ENCODER_MAP_ENABLE)
const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {
`;
    for (let i = 0; i < layersCount; i++) {
      const layerMaps = encoders.map(encoder => {
        const map = encoder.keymap?.[i];
        const ccw = actionToQmkSourceString(map?.counterClockwise || { action: 'tap', keycode: 'VOLD' }, settings.macros || []);
        const cw = actionToQmkSourceString(map?.clockwise || { action: 'tap', keycode: 'VOLU' }, settings.macros || []);
        return `ENCODER_CCW_CW(${ccw}, ${cw})`;
      }).join(', ');
      keymapC += `  [${i}] = { ${layerMaps} },\n`;
    }
    keymapC += `};
#endif
`;
  }

  keymapC += generateRgbMatrixConfigC(settings, validKeys, validKeys);

  return keymapC;
};

const generateRandomVialUid = () => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  if (bytes.every(byte => byte === 0)) {
    bytes[0] = 1;
  }

  return Array.from(bytes, byte => byte.toString(16).toUpperCase().padStart(2, '0')).join('');
};

const normalizeVialUid = (uid?: string) => {
  const clean = (uid || '').replace(/^0x/i, '').replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (/^[0-9A-F]{16}$/.test(clean) && clean !== '0000000000000000') {
    return clean;
  }
  return generateRandomVialUid();
};

const formatVialUid = (uid: string) => {
  const bytes: string[] = [];
  for (let i = uid.length - 2; i >= 0; i -= 2) {
    bytes.push(`0x${uid.substring(i, i + 2).padStart(2, '0')}`);
  }
  return `{ ${bytes.join(', ')} }`;
};

/**
 * Generates a full Vial-QMK firmware source code ZIP.
 * Tailored specifically for the forked vial-qmk repository rules and architecture.
 */
export const generateVialZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = getValidMatrixKeys(settings, keys);
  if (validKeys.length === 0) {
    throw new Error('Cannot export Vial firmware: no keys have valid matrix row/col assignments.');
  }
  const useMatrixMask = shouldUseMatrixMask(settings);
  const bootmagic = getBootmagicConfig(settings, validKeys);
  const encoders = getConfiguredEncoders(settings);
  const useDirectPins = isDirectPinMatrix(settings);
  const rgbMatrixKeys = getRgbMatrixKeys(settings, validKeys);
  const rgbMatrixLedCount = getRgbMatrixLedCount(rgbMatrixKeys);

  const zip = new JSZip();
  const kbName = settings.name.replace(/\s+/g, '_').toLowerCase() || 'smidr_keyboard';
  const processor = getQmkProcessor(settings.hardware.mcu);
  const bootloader = settings.hardware.bootloader || getDefaultBootloader(processor);
  const developmentBoard = getQmkDevelopmentBoard(settings.hardware.board || getDefaultDevelopmentBoard(settings.hardware.mcu));
  const controllerJson = settings.hardware.controllerType === 'mcu'
    ? { processor, bootloader }
    : { development_board: developmentBoard };
  
  const kbFolder = zip.folder(kbName);
  if (!kbFolder) return null;

  // 1. keyboard.json (vial-qmk compliant schema replacing info.json)
  const infoJson = {
    manufacturer: settings.manufacturer,
    keyboard_name: settings.name,
    maintainer: 'Smidr User',
    ...controllerJson,
    diode_direction: settings.hardware.diodeDirection,
    features: {
      command: false,
      console: false,
      extrakey: false,
      mousekey: false,
      nkro: true,
      encoder: encoders.length > 0,
      rgblight: settings.features.rgb,
      backlight: settings.features.backlight === true,
      rgb_matrix: settings.features.rgbMatrix === true && rgbMatrixLedCount > 0,
      via: true,  // Vial is built on top of VIA
    },
    ...(settings.features.backlight ? {
      backlight: {
        pin: settings.pins.backlight || 'D4',
        levels: 5,
      },
    } : {}),
    bootmagic,
    matrix_pins: useDirectPins
      ? { direct: generateDirectPins(settings, validKeys, keys, settings.features.split ? 'left' : undefined) }
      : {
        cols: settings.pins.cols,
        rows: settings.pins.rows
      },
    ...(encoders.length > 0 ? {
      encoder: {
        rotary: encoders.map(encoder => ({
          pin_a: encoder.pinA || 'B0',
          pin_b: encoder.pinB || 'B1',
        })),
      },
    } : {}),
    usb: {
      device_version: '1.0.0',
      vid: `0x${((settings.vendorProductId >>> 16) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
      pid: `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
    },
    layouts: {
      LAYOUT: {
        layout: validKeys.map(key => {
          const pos = getFirmwareMatrixPosition(settings, key, keys);
          return {
            matrix: pos ? [pos.row, pos.col] : [0, 0],
            x: key.x,
            y: key.y,
            w: key.w,
            h: key.h
          };
        })
      }
    },
    ...(settings.features.split ? {
      split: {
        enabled: true,
        matrix_pins: useDirectPins
          ? {
            right: {
              direct: generateDirectPins(settings, validKeys, keys, 'right'),
            }
          }
          : {
            right: {
              cols: hasPins(settings.pins.splitCols)
                ? settings.pins.splitCols || []
                : settings.pins.cols,
              rows: hasPins(settings.pins.splitRows)
                ? settings.pins.splitRows || []
                : settings.pins.rows
            }
          },
        transport: {
          protocol: 'serial'
        },
        serial: {
          driver: getSplitSerialDriver(processor),
          pin: settings.pins.splitSerial || 'GP1'
        }
      }
    } : {})
  };
  kbFolder.file('keyboard.json', JSON.stringify(infoJson, null, 2));
  if (useMatrixMask) {
    kbFolder.file(`${kbName}.c`, generateMatrixMaskC(settings, validKeys));
  }

  // 2. config.h (Keyboard level) - config_common.h is deprecated in modern QMK
  const configH = `/* Copyright 2026 Smidr User */
#pragma once
${useMatrixMask ? '\n#define MATRIX_MASKED\n' : ''}

/* RGB settings */
${(settings.features.rgb || settings.features.rgbMatrix) ? `
#define WS2812_DI_PIN ${settings.pins.rgb || 'D3'}
` : ''}
${settings.features.rgb ? `
#define RGBLED_NUM ${validKeys.length}
` : ''}
${settings.features.rgbMatrix && rgbMatrixLedCount > 0 ? `
#define RGB_MATRIX_LED_COUNT ${rgbMatrixLedCount}
#define RGB_MATRIX_MAXIMUM_BRIGHTNESS 150
` : ''}
${settings.features.backlight ? `
/* Backlight settings */
#define BACKLIGHT_PIN ${settings.pins.backlight || 'D4'}
#define BACKLIGHT_LEVELS 5
` : ''}
`;
  kbFolder.file('config.h', configH);

  // 3. rules.mk (Keyboard level)
  const rulesMk = `# Rules are managed through keyboard.json
${useMatrixMask ? 'MATRIX_MASKED = yes\n' : ''}`;
  kbFolder.file('rules.mk', rulesMk);

  // No [kbName].h is generated, allowing QMK to auto-generate the LAYOUT macro from keyboard.json.

  const keymapC = generateKeymapC(validKeys, settings.layers || 4, settings, settings.tapDances || []);
  const vialKeymapC = generateKeymapC(validKeys, settings.layers || 4, settings, []);
  const tapDanceRules = (settings.tapDances || []).length > 0 ? `TAP_DANCE_ENABLE = yes\n` : '';
  const comboRules = hasConfiguredCombos(settings.combos || []) ? `COMBO_ENABLE = yes\n` : '';
  const encoderMapRules = encoders.length > 0 ? `ENCODER_MAP_ENABLE = yes\n` : '';

  // 4. keymaps/default/
  const defaultFolder = kbFolder.folder('keymaps')?.folder('default');
  if (defaultFolder) {
    defaultFolder.file('keymap.c', keymapC);
    defaultFolder.file('rules.mk', `# Default keymap uses keyboard-level settings\n${encoderMapRules}${tapDanceRules}${comboRules}`);
  }

  // 5. keymaps/vial/
  const vialFolder = kbFolder.folder('keymaps')?.folder('vial');
  if (vialFolder) {
    // vial.json (layout definition for the Vial app)
    const vialJson = generateViaJson({ settings, keys });
    vialFolder.file('vial.json', JSON.stringify(vialJson, null, 2));

    // keymaps/vial/config.h (vialUID definition)
    const rawUid = normalizeVialUid(settings.vialUid);
    const vialUidFormatted = formatVialUid(rawUid);
    const unlockCombo = getVialUnlockCombo(settings, validKeys);
    const r1 = unlockCombo.key1.row;
    const c1 = unlockCombo.key1.col;
    const r2 = unlockCombo.key2.row;
    const c2 = unlockCombo.key2.col;

    const vialConfigH = `#pragma once

#define VIAL_KEYBOARD_UID ${vialUidFormatted}

#define VIAL_UNLOCK_COMBO_ROWS { ${r1}, ${r2} }
#define VIAL_UNLOCK_COMBO_COLS { ${c1}, ${c2} }
`;
    vialFolder.file('config.h', vialConfigH);

    vialFolder.file('keymap.c', vialKeymapC);

    // keymaps/vial/rules.mk (Enable Vial features specifically at the keymap level)
    const keymapRulesMk = `VIA_ENABLE = yes
VIAL_ENABLE = yes
LTO_ENABLE = yes
${tapDanceRules}
${comboRules}
${encoderMapRules}
`;
    vialFolder.file('rules.mk', keymapRulesMk);
  }

  return await zip.generateAsync({ type: 'blob' });
};
