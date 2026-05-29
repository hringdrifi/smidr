import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';
import { getDefaultBootloader, getDefaultDevelopmentBoard, getQmkDevelopmentBoard, getQmkProcessor, getSplitSerialDriver } from './mcu-presets';

const getMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrixKeys = keys.filter(key => (
    key.row !== undefined &&
    key.col !== undefined &&
    key.row >= 0 &&
    key.col >= 0
  ));

  const keyRows = matrixKeys.length > 0 ? Math.max(...matrixKeys.map(key => key.row ?? 0)) + 1 : 0;
  const keyCols = matrixKeys.length > 0 ? Math.max(...matrixKeys.map(key => key.col ?? 0)) + 1 : 0;

  return {
    rows: Math.max(settings.matrix?.rows || 0, keyRows),
    cols: Math.max(settings.matrix?.cols || 0, keyCols),
  };
};

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, keys);

  return keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    if (key.row < 0 || key.col < 0) return false;
    if (key.row >= matrix.rows || key.col >= matrix.cols) return false;
    const firstIdx = keys.findIndex(k => k.row === key.row && k.col === key.col);
    return firstIdx === idx;
  });
};

const shouldUseMatrixMask = (settings: ProjectSettings) => {
  return settings.qmk?.matrixMasked === true;
};

const getBootmagicConfig = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  if (settings.qmk?.bootmagic?.enabled === false) {
    return { enabled: false };
  }

  const firstKey = validKeys[0];
  const row = Number.isInteger(settings.qmk?.bootmagic?.row)
    ? settings.qmk!.bootmagic!.row!
    : firstKey?.row ?? 0;
  const col = Number.isInteger(settings.qmk?.bootmagic?.col)
    ? settings.qmk!.bootmagic!.col!
    : firstKey?.col ?? 0;

  return {
    enabled: true,
    matrix: [row, col],
  };
};

const getVialUnlockCombo = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  const firstKey = validKeys[0];
  const lastKey = validKeys[validKeys.length - 1] || firstKey;
  const configuredKey1 = settings.vial?.unlockCombo?.key1;
  const configuredKey2 = settings.vial?.unlockCombo?.key2;

  return {
    key1: {
      row: Number.isInteger(configuredKey1?.row) ? configuredKey1!.row! : firstKey?.row ?? 0,
      col: Number.isInteger(configuredKey1?.col) ? configuredKey1!.col! : firstKey?.col ?? 0,
    },
    key2: {
      row: Number.isInteger(configuredKey2?.row) ? configuredKey2!.row! : lastKey?.row ?? 0,
      col: Number.isInteger(configuredKey2?.col) ? configuredKey2!.col! : lastKey?.col ?? 0,
    },
  };
};

const generateMatrixMaskC = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, validKeys);
  const rowMasks = Array.from({ length: matrix.rows }, () => BigInt(0));

  validKeys.forEach(key => {
    if (key.row === undefined || key.col === undefined) return;
    rowMasks[key.row] |= BigInt(1) << BigInt(key.col);
  });

  const rows = rowMasks.map(mask => `    (matrix_row_t)0x${mask.toString(16).toUpperCase()}ULL`).join(',\n');

  return `#include "quantum.h"

const matrix_row_t matrix_mask[MATRIX_ROWS] = {
${rows}
};
`;
};

const generateKeymapC = (validKeys: PhysicalKey[], keymapsArray: string[][][]) => {
  let keymapC = `#include QMK_KEYBOARD_H

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
`;

  keymapsArray.forEach((layer, i) => {
    keymapC += `  [${i}] = LAYOUT(\n    `;
    keymapC += validKeys.map(key => {
      if (key.row !== undefined && key.col !== undefined) {
        return layer[key.row][key.col] || 'KC_TRNS';
      }
      return 'KC_TRNS';
    }).join(', ');
    keymapC += `\n  ),\n`;
  });
  keymapC += `};\n`;

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
      encoder: settings.features.encoder,
      rgblight: settings.features.rgb,
      via: true,  // Vial is built on top of VIA
    },
    bootmagic,
    matrix_pins: {
      cols: settings.pins.cols,
      rows: settings.pins.rows
    },
    usb: {
      device_version: '1.0.0',
      vid: `0x${((settings.vendorProductId >>> 16) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
      pid: `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`
    },
    layouts: {
      LAYOUT: {
        layout: validKeys.map(key => {
          return {
            matrix: (key.row !== undefined && key.col !== undefined) ? [key.row, key.col] : [0, 0],
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
        matrix_pins: {
          right: {
            cols: settings.pins.splitCols && settings.pins.splitCols.length === settings.pins.cols.length 
              ? settings.pins.splitCols 
              : settings.pins.cols,
            rows: settings.pins.splitRows && settings.pins.splitRows.length === settings.pins.rows.length 
              ? settings.pins.splitRows 
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

/* Encoder pins */
${settings.features.encoder ? `
#define ENCODERS_PAD_A { ${settings.pins.encoderA || 'B0'} }
#define ENCODERS_PAD_B { ${settings.pins.encoderB || 'B1'} }
` : ''}

/* RGB settings */
${settings.features.rgb ? `
#define RGB_DI_PIN ${settings.pins.rgb || 'D3'}
#define RGBLED_NUM ${validKeys.length}
#define RGBLIGHT_ANIMATIONS
` : ''}
`;
  kbFolder.file('config.h', configH);

  // 3. rules.mk (Keyboard level)
  const rulesMk = `# Rules are managed through keyboard.json
${useMatrixMask ? 'MATRIX_MASKED = yes\n' : ''}`;
  kbFolder.file('rules.mk', rulesMk);

  // No [kbName].h is generated, allowing QMK to auto-generate the LAYOUT macro from keyboard.json.

  const firmwareViaJson = generateViaJson({ settings, keys: validKeys });
  const keymapC = generateKeymapC(validKeys, firmwareViaJson.keymaps);

  // 4. keymaps/default/
  const defaultFolder = kbFolder.folder('keymaps')?.folder('default');
  if (defaultFolder) {
    defaultFolder.file('keymap.c', keymapC);
    defaultFolder.file('rules.mk', `# Default keymap uses keyboard-level settings\n`);
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

    vialFolder.file('keymap.c', keymapC);

    // keymaps/vial/rules.mk (Enable Vial features specifically at the keymap level)
    const keymapRulesMk = `VIA_ENABLE = yes
VIAL_ENABLE = yes
LTO_ENABLE = yes
`;
    vialFolder.file('rules.mk', keymapRulesMk);
  }

  return await zip.generateAsync({ type: 'blob' });
};
