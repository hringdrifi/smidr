import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';
import { TapDanceEntry } from '@/types/actions';
import { generateQmkTapDanceC } from './tap-dance-codegen';
import { actionToQmkSourceString, generateQmkStaticMacroC } from './macro-codegen';
import { generateQmkComboC, hasConfiguredCombos } from './combo-codegen';
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

const generateKeymapC = (validKeys: PhysicalKey[], layersCount: number, settings: ProjectSettings, tapDances: TapDanceEntry[] = []) => {
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
      encoder: settings.features.encoder,
      rgblight: settings.features.rgb
    },
    bootmagic,
    matrix_pins: {
      cols: settings.pins.cols,
      rows: settings.pins.rows,
      ...(useMatrixMask ? { masked: true } : {})
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

  // 2. config.h - config_common.h is deprecated in modern QMK
  const configH = `/* Copyright 2026 Smidr User */
#pragma once

/* Encoder pins */
${settings.features.encoder ? `
#define ENCODERS_PAD_A { ${settings.pins.encoderA || 'B0'} }
#define ENCODERS_PAD_B { ${settings.pins.encoderB || 'B1'} }
` : ''}

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

  // 4. keymaps/default/
  const defaultFolder = kbFolder.folder('keymaps')?.folder('default');
  if (defaultFolder) {
    defaultFolder.file('keymap.c', keymapC);
    defaultFolder.file('rules.mk', `# Default keymap uses keyboard-level settings\n${tapDanceRules}${comboRules}`);
  }

  // 5. keymaps/via/
  const viaFolder = kbFolder.folder('keymaps')?.folder('via');
  if (viaFolder) {
    const viaJson = generateViaJson({ settings, keys });
    viaFolder.file('via.json', JSON.stringify(viaJson, null, 2));
    viaFolder.file('keymap.c', keymapC);

    // keymaps/via/rules.mk
    viaFolder.file('rules.mk', `VIA_ENABLE = yes\n${tapDanceRules}${comboRules}`);
  }

  return await zip.generateAsync({ type: 'blob' });
};
