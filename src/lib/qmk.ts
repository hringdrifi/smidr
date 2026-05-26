import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';

/**
 * Generates a full standard QMK Firmware source code ZIP with VIA support.
 * Complies strictly with modern mainline QMK rules.
 */
export const generateQmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Filter only keys that have a valid, unique matrix position to prevent compiler errors
  const validKeys = keys.filter((key, idx) => {
    if (key.row === undefined || key.col === undefined) return false;
    if (key.row >= settings.matrix.rows || key.col >= settings.matrix.cols) return false;
    const firstIdx = keys.findIndex(k => k.row === key.row && k.col === key.col);
    return firstIdx === idx;
  });

  const zip = new JSZip();
  const kbName = settings.name.replace(/\s+/g, '_').toLowerCase() || 'smidr_keyboard';
  
  const kbFolder = zip.folder(kbName);
  if (!kbFolder) return null;

  // 1. keyboard.json (replaces info.json for modern data-driven QMK specifications)
  const infoJson = {
    manufacturer: settings.manufacturer,
    keyboard_name: settings.name,
    maintainer: 'Smidr User',
    processor: settings.hardware.mcu === 'rp2040' ? 'RP2040' : 'atmega32u4',
    bootloader: settings.hardware.mcu === 'rp2040' ? 'rp2040' : 'pro_micro',
    diode_direction: settings.hardware.diodeDirection,
    features: {
      bootmagic: true,
      command: false,
      console: false,
      extrakey: true,
      mousekey: true,
      nkro: true,
      encoder: settings.features.encoder,
      rgblight: settings.features.rgb,
      via: true
    },
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
            cols: settings.pins.cols,
            rows: settings.pins.rows
          }
        },
        transport: {
          serial: { pin: settings.pins.splitSerial || 'GP1' }
        }
      }
    } : {})
  };
  kbFolder.file('keyboard.json', JSON.stringify(infoJson, null, 2));

  // 2. config.h - config_common.h is deprecated in modern QMK
  const configH = `/* Copyright 2026 Smidr User */
#pragma once

/* Matrix scanning */
#define MATRIX_ROWS ${settings.matrix.rows}
#define MATRIX_COLS ${settings.matrix.cols}
${settings.features.split ? `
/* Split keyboard */
#define SPLIT_KEYBOARD
` : ''}
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

  // 3. rules.mk (keyboard level) - Left completely empty as settings are managed via keyboard.json
  const rulesMk = `# Rules are managed through keyboard.json\n`;
  kbFolder.file('rules.mk', rulesMk);

  // Note: No [kbName].h or [kbName].c files are generated here, enabling QMK to automatically
  // auto-generate the keyboard header with the LAYOUT macro from keyboard.json.

  // 4. keymaps/via/
  const viaFolder = kbFolder.folder('keymaps')?.folder('via');
  if (viaFolder) {
    const viaJson = generateViaJson({ settings, keys: validKeys });
    viaFolder.file('via.json', JSON.stringify(viaJson, null, 2));

    // keymap.c
    const keymapsArray = viaJson.keymaps;
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
    viaFolder.file('keymap.c', keymapC);

    // keymaps/via/rules.mk
    viaFolder.file('rules.mk', `VIA_ENABLE = yes\n`);
  }

  return await zip.generateAsync({ type: 'blob' });
};
