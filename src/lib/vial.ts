import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';

/**
 * Generates a full Vial-QMK firmware source code ZIP.
 * Tailored specifically for the forked vial-qmk repository rules and architecture.
 */
export const generateVialZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
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

  // 1. keyboard.json (vial-qmk compliant schema replacing info.json)
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
      via: true,  // Vial is built on top of VIA
    },
    matrix_pins: {
      cols: settings.pins.cols,
      rows: settings.pins.rows
    },
    usb: {
      device_version: '1.0.0',
      pid: (settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`).toUpperCase().startsWith('0X') 
        ? (settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`) 
        : `0x${(settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`)}`,
      vid: (settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`).toUpperCase().startsWith('0X') 
        ? (settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`) 
        : `0x${(settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`)}`
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
    }
  };
  kbFolder.file('keyboard.json', JSON.stringify(infoJson, null, 2));

  // 2. config.h (Keyboard level) - config_common.h is deprecated in modern QMK
  const configH = `/* Copyright 2026 Smidr User */
#pragma once

/* Matrix scanning */
#define MATRIX_ROWS ${settings.matrix.rows}
#define MATRIX_COLS ${settings.matrix.cols}

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

  // 3. rules.mk (Keyboard level) - Left completely empty as settings are managed via keyboard.json
  const rulesMk = `# Rules are managed through keyboard.json\n`;
  kbFolder.file('rules.mk', rulesMk);

  // Note: No [kbName].h or [kbName].c files are generated here, enabling QMK to automatically
  // auto-generate the keyboard header with the LAYOUT macro from keyboard.json.

  // 4. keymaps/vial/
  const vialFolder = kbFolder.folder('keymaps')?.folder('vial');
  if (vialFolder) {
    // vial.json (layout definition for the Vial app)
    const vialJson = generateViaJson({ settings, keys: validKeys });
    vialFolder.file('vial.json', JSON.stringify(vialJson, null, 2));

    // keymaps/vial/config.h (vialUID definition)
    const rawUid = settings.vialUid?.replace('0x', '') || '0000000000000000';
    const bytes: string[] = [];
    for (let i = 0; i < 16; i += 2) {
      bytes.push(`0x${rawUid.substring(i, i + 2).padStart(2, '0')}`);
    }
    const vialUidFormatted = `{ ${bytes.join(', ')} }`;
    
    const firstKey = validKeys[0];
    const lastKey = validKeys[validKeys.length - 1] || firstKey;
    const r1 = firstKey?.row ?? 0;
    const c1 = firstKey?.col ?? 0;
    const r2 = lastKey?.row ?? 0;
    const c2 = lastKey?.col ?? 0;

    const vialConfigH = `#pragma once

#define VIAL_KEYBOARD_UID ${vialUidFormatted}

#define VIAL_UNLOCK_COMBO_ROWS { ${r1}, ${r2} }
#define VIAL_UNLOCK_COMBO_COLS { ${c1}, ${c2} }
`;
    vialFolder.file('config.h', vialConfigH);

    // keymap.c
    const keymapsArray = vialJson.keymaps;
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
