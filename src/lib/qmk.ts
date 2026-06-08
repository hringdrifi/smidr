import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';
import { TapDanceEntry } from '@/types/actions';
import { generateQmkTapDanceC } from './tap-dance-codegen';
import { actionToQmkSourceString, generateQmkStaticMacroC } from './macro-codegen';
import { generateQmkComboC, hasConfiguredCombos } from './combo-codegen';
import { getDefaultBootloader, getDefaultDevelopmentBoard, getQmkDevelopmentBoard, getQmkProcessor, getSplitSerialDriver } from './mcu-presets';
import { getQmkMatrixFromPins, getQmkMatrixPosition } from './matrix-utils';

const hasPins = (pins: string[] | undefined) => (pins?.filter(Boolean).length ?? 0) > 0;

const getMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrixKeys = keys.filter(key => (
    key.row !== undefined &&
    key.col !== undefined &&
    key.row >= 0 &&
    key.col >= 0
  ));

  const positions = matrixKeys
    .map(key => getQmkMatrixPosition(settings, key, keys))
    .filter((pos): pos is { row: number; col: number } => !!pos);
  const keyRows = positions.length > 0 ? Math.max(...positions.map(pos => pos.row)) + 1 : 0;
  const keyCols = positions.length > 0 ? Math.max(...positions.map(pos => pos.col)) + 1 : 0;
  const pinMatrix = getQmkMatrixFromPins(settings.pins, settings.features.split);

  return {
    rows: Math.max(pinMatrix?.rows || settings.matrix?.rows || 0, keyRows),
    cols: Math.max(pinMatrix?.cols || settings.matrix?.cols || 0, keyCols),
  };
};

const getValidMatrixKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, keys);

  return keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    const pos = getQmkMatrixPosition(settings, key, keys);
    if (!pos || pos.row < 0 || pos.col < 0) return false;
    if (pos.row >= matrix.rows || pos.col >= matrix.cols) return false;
    const firstIdx = keys.findIndex(k => {
      const other = getQmkMatrixPosition(settings, k, keys);
      return other?.row === pos.row && other?.col === pos.col;
    });
    return firstIdx === idx;
  });
};

const shouldUseMatrixMask = (settings: ProjectSettings) => {
  return settings.qmk?.matrixMasked === true;
};

const getConfiguredEncoders = (settings: ProjectSettings) => {
  return settings.encoders || [];
};

const getBootmagicConfig = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  if (settings.qmk?.bootmagic?.enabled === false) {
    return { enabled: false };
  }

  const firstKey = validKeys[0];
  const firstPos = firstKey ? getQmkMatrixPosition(settings, firstKey, validKeys) : undefined;
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

const generateMatrixMaskC = (settings: ProjectSettings, validKeys: PhysicalKey[]) => {
  const matrix = getMatrixDimensions(settings, validKeys);
  const rowMasks = Array.from({ length: matrix.rows }, () => BigInt(0));

  validKeys.forEach(key => {
    const pos = getQmkMatrixPosition(settings, key, validKeys);
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

  return keymapC;
};

/**
 * Generates a full standard QMK Firmware source code ZIP with VIA support.
 * Complies strictly with modern mainline QMK rules.
 */
export const generateQmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = getValidMatrixKeys(settings, keys);
  if (validKeys.length === 0) {
    throw new Error('Cannot export QMK firmware: no keys have valid matrix row/col assignments.');
  }
  const useMatrixMask = shouldUseMatrixMask(settings);
  const bootmagic = getBootmagicConfig(settings, validKeys);
  const encoders = getConfiguredEncoders(settings);

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

  // 1. keyboard.json (replaces info.json for modern data-driven QMK specifications)
  const infoJson = {
    manufacturer: settings.manufacturer,
    keyboard_name: settings.name,
    maintainer: 'Smidr User',
    ...controllerJson,
    diode_direction: settings.hardware.diodeDirection,
    features: {
      command: false,
      console: false,
      extrakey: true,
      mousekey: true,
      nkro: true,
      encoder: encoders.length > 0,
      rgblight: settings.features.rgb
    },
    bootmagic,
    matrix_pins: {
      cols: settings.pins.cols,
      rows: settings.pins.rows,
      ...(useMatrixMask ? { masked: true } : {})
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
          const pos = getQmkMatrixPosition(settings, key, keys);
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
        matrix_pins: {
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

  // 2. config.h - config_common.h is deprecated in modern QMK
  const configH = `/* Copyright 2026 Smidr User */
#pragma once

/* RGB settings */
${settings.features.rgb ? `
#define WS2812_DI_PIN ${settings.pins.rgb || 'D3'}
#define RGBLED_NUM ${validKeys.length}
` : ''}
`;
  kbFolder.file('config.h', configH);

  // 3. rules.mk (keyboard level) - Left completely empty as settings are managed via keyboard.json
  const rulesMk = `# Rules are managed through keyboard.json\n`;
  kbFolder.file('rules.mk', rulesMk);

  // No [kbName].h is generated, allowing QMK to auto-generate the LAYOUT macro from keyboard.json.

  const keymapC = generateKeymapC(validKeys, settings.layers || 4, settings, settings.tapDances || []);
  const tapDanceRules = (settings.tapDances || []).length > 0 ? `TAP_DANCE_ENABLE = yes\n` : '';
  const comboRules = hasConfiguredCombos(settings.combos || []) ? `COMBO_ENABLE = yes\n` : '';
  const encoderMapRules = encoders.length > 0 ? `ENCODER_MAP_ENABLE = yes\n` : '';

  // 4. keymaps/default/
  const defaultFolder = kbFolder.folder('keymaps')?.folder('default');
  if (defaultFolder) {
    defaultFolder.file('keymap.c', keymapC);
    defaultFolder.file('rules.mk', `# Default keymap uses keyboard-level settings\n${encoderMapRules}${tapDanceRules}${comboRules}`);
  }

  // 5. keymaps/via/
  const viaFolder = kbFolder.folder('keymaps')?.folder('via');
  if (viaFolder) {
    const viaJson = generateViaJson({ settings, keys });
    viaFolder.file('via.json', JSON.stringify(viaJson, null, 2));
    viaFolder.file('keymap.c', keymapC);

    // keymaps/via/rules.mk
    viaFolder.file('rules.mk', `VIA_ENABLE = yes\n${encoderMapRules}${tapDanceRules}${comboRules}`);
  }

  return await zip.generateAsync({ type: 'blob' });
};
