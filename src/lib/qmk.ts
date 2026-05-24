import JSZip from 'jszip';
import { ProjectSettings, PhysicalKey } from '@/types/keyboard';
import { generateViaJson } from './export';

/**
 * Generates a full QMK Firmware source code ZIP.
 */
export const generateQmkZip = async (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;
  const zip = new JSZip();
  const kbName = settings.name.replace(/\s+/g, '_').toLowerCase() || 'smidr_keyboard';
  
  // Create folder for keyboard
  const kbFolder = zip.folder(kbName);
  if (!kbFolder) return null;

  // 1. info.json
  const infoJson = {
    manufacturer: settings.manufacturer,
    keyboard_name: settings.name,
    maintainer: 'Smidr User',
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
      via: settings.features.via,
      vial: settings.features.vial
    },
    matrix_pins: {
      cols: settings.pins.cols,
      rows: settings.pins.rows
    },
    usb: {
      device_ver: '0.0.1',
      pid: (settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`).toUpperCase().startsWith('0X') 
        ? (settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`) 
        : `0x${(settings.pid || `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`)}`,
      vid: (settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`).toUpperCase().startsWith('0X') 
        ? (settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`) 
        : `0x${(settings.vid || `0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`)}`
    },
    layouts: {
      LAYOUT: {
        layout: keys.map(key => {
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
  kbFolder.file('info.json', JSON.stringify(infoJson, null, 2));

  // 2. config.h
  const configH = `/* Copyright 2026 Smidr User */
#pragma once

#include "config_common.h"

/* USB Device descriptor parameter */
#define DEVICE_VER 0x0001
#define PRODUCT ${settings.name}

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
#define RGBLED_NUM ${keys.length}
#define RGBLIGHT_ANIMATIONS
` : ''}
`;
  kbFolder.file('config.h', configH);

  // 3. rules.mk
  const rulesMk = `MCU = ${settings.hardware.mcu === 'rp2040' ? 'RP2040' : 'atmega32u4'}
BOOTLOADER = ${settings.hardware.mcu === 'rp2040' ? 'rp2040' : 'pro_micro'}

# Build Options
BOOTMAGIC_ENABLE = full
MOUSEKEY_ENABLE = yes
EXTRAKEY_ENABLE = yes
CONSOLE_ENABLE = no
COMMAND_ENABLE = no
NKRO_ENABLE = yes
BACKLIGHT_ENABLE = no
RGBLIGHT_ENABLE = ${settings.features.rgb ? 'yes' : 'no'}
ENCODER_ENABLE = ${settings.features.encoder ? 'yes' : 'no'}
VIA_ENABLE = ${settings.features.via ? 'yes' : 'no'}
VIAL_ENABLE = ${settings.features.vial ? 'yes' : 'no'}
`;
  kbFolder.file('rules.mk', rulesMk);

  // 4. [kb].h
  const kbH = `#pragma once
#include "quantum.h"

#define LAYOUT( \\
    ${keys.map((_, i) => `k${i}`).join(', ')} \\
) { \\
    { ${Array.from({ length: settings.matrix.rows }).map((_, r) => {
      return Array.from({ length: settings.matrix.cols }).map((_, c) => {
        const keyIndex = keys.findIndex(k => k.row === r && k.col === c);
        return keyIndex !== -1 ? `k${keyIndex}` : 'KC_NO';
      }).join(', ');
    }).join(' }, \\\\ \\n      { ')} } \\
}
`;
  kbFolder.file(`${kbName}.h`, kbH);

  // 5. keymaps/via/ (or vial/)
  const keymapType = settings.features.vial ? 'vial' : 'via';
  const viaFolder = kbFolder.folder('keymaps')?.folder(keymapType);
  if (viaFolder) {
    // via.json
    const viaJson = generateViaJson(state);
    viaFolder.file(`${keymapType}.json`, JSON.stringify(viaJson, null, 2));

    // keymap.c
    const viaJsonFull = generateViaJson(state);
    const keymapsArray = viaJsonFull.keymaps;
    
    let keymapC = `#include QMK_KEYBOARD_H

const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
`;

    keymapsArray.forEach((layer, i) => {
      keymapC += `  [${i}] = LAYOUT(\n    `;
      // We need to output keys in the order they appear in the LAYOUT macro
      keymapC += keys.map(key => {
        if (key.row !== undefined && key.col !== undefined) {
          return layer[key.row][key.col] || 'KC_TRNS';
        }
        return 'KC_TRNS';
      }).join(', ');
      keymapC += `\n  ),\n`;
    });
    keymapC += `};\n`;
    
    viaFolder.file('keymap.c', keymapC);

    // rules.mk for via/vial
    viaFolder.file('rules.mk', `${keymapType.toUpperCase()}_ENABLE = yes\n`);
  }

  return await zip.generateAsync({ type: 'blob' });
};
