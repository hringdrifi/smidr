// src/lib/keycodes.ts

export type KeycodeCategory = 'Basic' | 'ISO/JIS' | 'Layers' | 'Media' | 'Macro' | 'Backlight' | 'Special';

export interface Keycode {
  code: string;
  label: string;
  category: KeycodeCategory;
  description?: string;
  row?: number;
  width?: number;
  spacer?: number;
  w2?: number;
  h2?: number;
  x2?: number;
  y2?: number;
}

export const VIAL_TABS: KeycodeCategory[] = ['Basic', 'ISO/JIS', 'Layers', 'Media', 'Macro', 'Backlight', 'Special'];

export const KEYCODES: Keycode[] = [
  // ==========================================
  // --- BASIC (ANSI Full Layout) ---
  // ==========================================
  // Row 0
  { code: 'transparent', label: '▽', category: 'Basic', row: 0, description: 'Passes through the keycode of the layer below (Transparent)' },
  { code: 'ESC', label: 'Esc', category: 'Basic', row: 0, spacer: 0.25 },
  { code: 'F1', label: 'F1', category: 'Basic', row: 0, spacer: 1.0 },
  { code: 'F2', label: 'F2', category: 'Basic', row: 0 },
  { code: 'F3', label: 'F3', category: 'Basic', row: 0 },
  { code: 'F4', label: 'F4', category: 'Basic', row: 0 },
  { code: 'F5', label: 'F5', category: 'Basic', row: 0, spacer: 0.5 },
  { code: 'F6', label: 'F6', category: 'Basic', row: 0 },
  { code: 'F7', label: 'F7', category: 'Basic', row: 0 },
  { code: 'F8', label: 'F8', category: 'Basic', row: 0 },
  { code: 'F9', label: 'F9', category: 'Basic', row: 0, spacer: 0.5 },
  { code: 'F10', label: 'F10', category: 'Basic', row: 0 },
  { code: 'F11', label: 'F11', category: 'Basic', row: 0 },
  { code: 'F12', label: 'F12', category: 'Basic', row: 0 },
  { code: 'PSCR', label: 'PrtSc', category: 'Basic', row: 0, spacer: 0.25 },
  { code: 'SCRL', label: 'ScrLk', category: 'Basic', row: 0 },
  { code: 'PAUS', label: 'Pause', category: 'Basic', row: 0 },

  // Row 1
  { code: 'none', label: 'None', category: 'Basic', row: 1, description: 'Disables the key (No action)' },
  { code: 'GRV', label: '~\n`', category: 'Basic', row: 1, spacer: 0.25 },
  { code: '1', label: '!\n1', category: 'Basic', row: 1 },
  { code: '2', label: '@\n2', category: 'Basic', row: 1 },
  { code: '3', label: '#\n3', category: 'Basic', row: 1 },
  { code: '4', label: '$\n4', category: 'Basic', row: 1 },
  { code: '5', label: '%\n5', category: 'Basic', row: 1 },
  { code: '6', label: '^\n6', category: 'Basic', row: 1 },
  { code: '7', label: '&\n7', category: 'Basic', row: 1 },
  { code: '8', label: '*\n8', category: 'Basic', row: 1 },
  { code: '9', label: '(\n9', category: 'Basic', row: 1 },
  { code: '0', label: ')\n0', category: 'Basic', row: 1 },
  { code: 'MINS', label: '_\n-', category: 'Basic', row: 1 },
  { code: 'EQL', label: '+\n=', category: 'Basic', row: 1 },
  { code: 'BSPC', label: 'Bksp', category: 'Basic', row: 1, width: 2.0 },
  { code: 'INS', label: 'Ins', category: 'Basic', row: 1, spacer: 0.25 },
  { code: 'HOME', label: 'Home', category: 'Basic', row: 1 },
  { code: 'PGUP', label: 'PgUp', category: 'Basic', row: 1 },
  { code: 'NLCK', label: 'Num', category: 'Basic', row: 1, spacer: 0.25 },
  { code: 'PSLS', label: '/', category: 'Basic', row: 1 },
  { code: 'PAST', label: '*', category: 'Basic', row: 1 },
  { code: 'PMNS', label: '-', category: 'Basic', row: 1 },

  // Row 2
  { code: 'any', label: 'Any', category: 'Basic', row: 2, description: 'Passes a raw protocol-specific keycode or behavior through' },
  { code: 'TAB', label: 'Tab', category: 'Basic', row: 2, width: 1.5, spacer: 0.25 },
  ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(k => ({ code: k, label: k, category: 'Basic' as const, row: 2 })),
  { code: 'LBRC', label: '{\n[', category: 'Basic', row: 2 },
  { code: 'RBRC', label: '}\n]', category: 'Basic', row: 2 },
  { code: 'BSLS', label: '|\n\\', category: 'Basic', row: 2, width: 1.5 },
  { code: 'DEL', label: 'Del', category: 'Basic', row: 2, spacer: 0.25 },
  { code: 'END', label: 'End', category: 'Basic', row: 2 },
  { code: 'PGDN', label: 'PgDn', category: 'Basic', row: 2 },
  { code: 'P7', label: '7', category: 'Basic', row: 2, spacer: 0.25 },
  { code: 'P8', label: '8', category: 'Basic', row: 2 },
  { code: 'P9', label: '9', category: 'Basic', row: 2 },
  { code: 'PPLS', label: '+', category: 'Basic', row: 2 },

  // Row 3
  { code: 'CAPS', label: 'Caps', category: 'Basic', row: 3, width: 1.75, spacer: 1.25 },
  ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(k => ({ code: k, label: k, category: 'Basic' as const, row: 3 })),
  { code: 'SCLN', label: ':\n;', category: 'Basic', row: 3 },
  { code: 'QUOT', label: '"\n\'', category: 'Basic', row: 3 },
  { code: 'ENT', label: 'Enter', category: 'Basic', row: 3, width: 2.25 },
  { code: 'P4', label: '4', category: 'Basic', row: 3, spacer: 3.5 },
  { code: 'P5', label: '5', category: 'Basic', row: 3 },
  { code: 'P6', label: '6', category: 'Basic', row: 3 },
  { code: 'PCMM', label: ',', category: 'Basic', row: 3 },

  // Row 4
  { code: 'LSFT', label: 'LShift', category: 'Basic', row: 4, width: 2.25, spacer: 1.25 },
  ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(k => ({ code: k, label: k, category: 'Basic' as const, row: 4 })),
  { code: 'COMM', label: '<\n,', category: 'Basic', row: 4 },
  { code: 'DOT', label: '>\n.', category: 'Basic', row: 4 },
  { code: 'SLSH', label: '?\n/', category: 'Basic', row: 4 },
  { code: 'RSFT', label: 'RShift', category: 'Basic', row: 4, width: 2.75 },
  { code: 'UP', label: '↑', category: 'Basic', row: 4, spacer: 1.25 },
  { code: 'P1', label: '1', category: 'Basic', row: 4, spacer: 1.25 },
  { code: 'P2', label: '2', category: 'Basic', row: 4 },
  { code: 'P3', label: '3', category: 'Basic', row: 4 },
  { code: 'PEQL', label: '=', category: 'Basic', row: 4 },

  // Row 5
  { code: 'LCTL', label: 'LCtrl', category: 'Basic', row: 5, width: 1.25, spacer: 1.25 },
  { code: 'LGUI', label: 'LGui', category: 'Basic', row: 5, width: 1.25 },
  { code: 'LALT', label: 'LAlt', category: 'Basic', row: 5, width: 1.25 },
  { code: 'SPC', label: 'Space', category: 'Basic', row: 5, width: 6.25 },
  { code: 'RALT', label: 'RAlt', category: 'Basic', row: 5, width: 1.25 },
  { code: 'RGUI', label: 'RGui', category: 'Basic', row: 5, width: 1.25 },
  { code: 'APP', label: 'Menu', category: 'Basic', row: 5, width: 1.25 },
  { code: 'RCTL', label: 'RCtrl', category: 'Basic', row: 5, width: 1.25 },
  { code: 'LEFT', label: '←', category: 'Basic', row: 5, spacer: 0.25 },
  { code: 'DOWN', label: '↓', category: 'Basic', row: 5 },
  { code: 'RIGHT', label: '→', category: 'Basic', row: 5 },
  { code: 'P0', label: '0', category: 'Basic', row: 5, width: 2.0, spacer: 0.25 },
  { code: 'PDOT', label: '.', category: 'Basic', row: 5 },
  { code: 'PENT', label: 'Num\nEnter', category: 'Basic', row: 5 },

  // ==========================================
  // --- ISO/JIS (JIS Full Layout) ---
  // ==========================================
  // Row 0
  { code: 'transparent', label: '▽', category: 'ISO/JIS', row: 0, description: 'Passes through the keycode of the layer below (Transparent)' },
  { code: 'ESC', label: 'Esc', category: 'ISO/JIS', row: 0, spacer: 0.25 },
  { code: 'F1', label: 'F1', category: 'ISO/JIS', row: 0, spacer: 1.0 },
  { code: 'F2', label: 'F2', category: 'ISO/JIS', row: 0 },
  { code: 'F3', label: 'F3', category: 'ISO/JIS', row: 0 },
  { code: 'F4', label: 'F4', category: 'ISO/JIS', row: 0 },
  { code: 'F5', label: 'F5', category: 'ISO/JIS', row: 0, spacer: 0.5 },
  { code: 'F6', label: 'F6', category: 'ISO/JIS', row: 0 },
  { code: 'F7', label: 'F7', category: 'ISO/JIS', row: 0 },
  { code: 'F8', label: 'F8', category: 'ISO/JIS', row: 0 },
  { code: 'F9', label: 'F9', category: 'ISO/JIS', row: 0, spacer: 0.5 },
  { code: 'F10', label: 'F10', category: 'ISO/JIS', row: 0 },
  { code: 'F11', label: 'F11', category: 'ISO/JIS', row: 0 },
  { code: 'F12', label: 'F12', category: 'ISO/JIS', row: 0 },
  { code: 'PSCR', label: 'PrtSc', category: 'ISO/JIS', row: 0, spacer: 0.25 },
  { code: 'SCRL', label: 'ScrLk', category: 'ISO/JIS', row: 0 },
  { code: 'PAUS', label: 'Pause', category: 'ISO/JIS', row: 0 },

  // Row 1
  { code: 'none', label: 'None', category: 'ISO/JIS', row: 1, description: 'Disables the key (No action)' },
  { code: 'GRV', label: '~\n`', category: 'ISO/JIS', row: 1, spacer: 0.25 },
  { code: '1', label: '!\n1', category: 'ISO/JIS', row: 1 },
  { code: '2', label: '@\n2', category: 'ISO/JIS', row: 1 },
  { code: '3', label: '#\n3', category: 'ISO/JIS', row: 1 },
  { code: '4', label: '$\n4', category: 'ISO/JIS', row: 1 },
  { code: '5', label: '%\n5', category: 'ISO/JIS', row: 1 },
  { code: '6', label: '^\n6', category: 'ISO/JIS', row: 1 },
  { code: '7', label: '&\n7', category: 'ISO/JIS', row: 1 },
  { code: '8', label: '*\n8', category: 'ISO/JIS', row: 1 },
  { code: '9', label: '(\n9', category: 'ISO/JIS', row: 1 },
  { code: '0', label: ')\n0', category: 'ISO/JIS', row: 1 },
  { code: 'MINS', label: '_\n-', category: 'ISO/JIS', row: 1 },
  { code: 'EQL', label: '+\n=', category: 'ISO/JIS', row: 1 },
  { code: 'YEN', label: '|\n¥', category: 'ISO/JIS', row: 1 },
  { code: 'BSPC', label: 'Bksp', category: 'ISO/JIS', row: 1, width: 1.0 },
  { code: 'INS', label: 'Ins', category: 'ISO/JIS', row: 1, spacer: 0.25 },
  { code: 'HOME', label: 'Home', category: 'ISO/JIS', row: 1 },
  { code: 'PGUP', label: 'PgUp', category: 'ISO/JIS', row: 1 },
  { code: 'NLCK', label: 'Num', category: 'ISO/JIS', row: 1, spacer: 0.25 },
  { code: 'PSLS', label: '/', category: 'ISO/JIS', row: 1 },
  { code: 'PAST', label: '*', category: 'ISO/JIS', row: 1 },
  { code: 'PMNS', label: '-', category: 'ISO/JIS', row: 1 },

  // Row 2
  { code: 'any', label: 'Any', category: 'ISO/JIS', row: 2, description: 'Passes a raw protocol-specific keycode or behavior through' },
  { code: 'TAB', label: 'Tab', category: 'ISO/JIS', row: 2, width: 1.5, spacer: 0.25 },
  ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(k => ({ code: k, label: k, category: 'ISO/JIS' as const, row: 2 })),
  { code: 'LBRC', label: '{\n[', category: 'ISO/JIS', row: 2 },
  { code: 'RBRC', label: '}\n]', category: 'ISO/JIS', row: 2 },
  { code: 'ENT', label: 'Enter', category: 'ISO/JIS', row: 2, width: 1.5, w2: 1.25, h2: 1, x2: -0.25, y2: 1 },
  { code: 'DEL', label: 'Del', category: 'ISO/JIS', row: 2, spacer: 0.25 },
  { code: 'END', label: 'End', category: 'ISO/JIS', row: 2 },
  { code: 'PGDN', label: 'PgDn', category: 'ISO/JIS', row: 2 },
  { code: 'P7', label: '7', category: 'ISO/JIS', row: 2, spacer: 0.25 },
  { code: 'P8', label: '8', category: 'ISO/JIS', row: 2 },
  { code: 'P9', label: '9', category: 'ISO/JIS', row: 2 },
  { code: 'PPLS', label: '+', category: 'ISO/JIS', row: 2 },

  // Row 3
  { code: 'CAPS', label: 'Caps', category: 'ISO/JIS', row: 3, width: 1.75, spacer: 1.25 },
  ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(k => ({ code: k, label: k, category: 'ISO/JIS' as const, row: 3 })),
  { code: 'SCLN', label: ':\n;', category: 'ISO/JIS', row: 3 },
  { code: 'QUOT', label: '"\n\'', category: 'ISO/JIS', row: 3 },
  { code: 'NUHS', label: '~\n#', category: 'ISO/JIS', row: 3 },
  { code: 'ISO_ENT_GHOST', label: '', category: 'ISO/JIS', row: 3, width: 1.25 }, // Placeholder to keep layout
  { code: 'P4', label: '4', category: 'ISO/JIS', row: 3, spacer: 3.5 },
  { code: 'P5', label: '5', category: 'ISO/JIS', row: 3 },
  { code: 'P6', label: '6', category: 'ISO/JIS', row: 3 },
  { code: 'PCMM', label: ',', category: 'ISO/JIS', row: 3 },

  // Row 4
  { code: 'LSFT', label: 'LShift', category: 'ISO/JIS', row: 4, width: 1.25, spacer: 1.25 },
  { code: 'NUBS', label: '\\', category: 'ISO/JIS', row: 4 },
  ...['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(k => ({ code: k, label: k, category: 'ISO/JIS' as const, row: 4 })),
  { code: 'COMM', label: ',', category: 'ISO/JIS', row: 4 },
  { code: 'DOT', label: '.', category: 'ISO/JIS', row: 4 },
  { code: 'SLSH', label: '/', category: 'ISO/JIS', row: 4 },
  { code: 'RO', label: '_\n¥', category: 'ISO/JIS', row: 4 },
  { code: 'RSFT', label: 'RShift', category: 'ISO/JIS', row: 4, width: 1.75 },
  { code: 'UP', label: '↑', category: 'ISO/JIS', row: 4, spacer: 1.25 },
  { code: 'P1', label: '1', category: 'ISO/JIS', row: 4, spacer: 1.25 },
  { code: 'P2', label: '2', category: 'ISO/JIS', row: 4 },
  { code: 'P3', label: '3', category: 'ISO/JIS', row: 4 },
  { code: 'PEQL', label: '=', category: 'ISO/JIS', row: 4 },

  // Row 5
  { code: 'LCTL', label: 'LCtrl', category: 'ISO/JIS', row: 5, width: 1.25, spacer: 1.25 },
  { code: 'LGUI', label: 'LGui', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'LALT', label: 'LAlt', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'MHEN', label: '無変換', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'SPC', label: 'Space', category: 'ISO/JIS', row: 5, width: 3.75 },
  { code: 'HENK', label: '変換', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'KANA', label: 'かな', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'RALT', label: 'RAlt', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'RGUI', label: 'RGui', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'RCTL', label: 'RCtrl', category: 'ISO/JIS', row: 5, width: 1.25 },
  { code: 'LEFT', label: '←', category: 'ISO/JIS', row: 5, spacer: 0.25 },
  { code: 'DOWN', label: '↓', category: 'ISO/JIS', row: 5 },
  { code: 'RIGHT', label: '→', category: 'ISO/JIS', row: 5 },
  { code: 'P0', label: '0', category: 'ISO/JIS', row: 5, width: 2.0, spacer: 0.25 },
  { code: 'PDOT', label: '.', category: 'ISO/JIS', row: 5 },
  { code: 'PENT', label: 'Num\nEnter', category: 'ISO/JIS', row: 5 },

  // --- Other Tabs ---

  { code: 'MNXT', label: 'Next', category: 'Media' },
  { code: 'MPRV', label: 'Prev', category: 'Media' },
  { code: 'MPLY', label: 'Play', category: 'Media' },
  { code: 'MSTP', label: 'Stop', category: 'Media', description: 'Stop Media playback' },
  { code: 'MUTE', label: 'Mute', category: 'Media' },
  { code: 'VOLU', label: 'Vol +', category: 'Media' },
  { code: 'VOLD', label: 'Vol -', category: 'Media' },
  { code: 'BRIU', label: 'Bri +', category: 'Media', description: 'Increase Screen Brightness' },
  { code: 'BRID', label: 'Bri -', category: 'Media', description: 'Decrease Screen Brightness' },
  { code: 'MOUSE_UP', label: 'Ms Up', category: 'Media' },
  { code: 'MOUSE_DOWN', label: 'Ms Dn', category: 'Media' },
  { code: 'MOUSE_LEFT', label: 'Ms Lt', category: 'Media' },
  { code: 'MOUSE_RIGHT', label: 'Ms Rt', category: 'Media' },
  { code: 'MOUSE_BTN1', label: 'Btn 1', category: 'Media' },
  { code: 'MOUSE_BTN2', label: 'Btn 2', category: 'Media' },
  { code: 'MOUSE_BTN3', label: 'Btn 3', category: 'Media' },
  { code: 'MOUSE_BTN4', label: 'Btn 4', category: 'Media' },
  { code: 'MOUSE_BTN5', label: 'Btn 5', category: 'Media' },

  ...Array.from({ length: 16 }, (_, i) => ({ code: `MACRO_${i}`, label: `M${i}`, category: 'Macro' as const })),

  { code: 'BL_TOGG', label: 'BL\nToggle', category: 'Backlight', description: 'Toggle keyboard backlight' },
  { code: 'BL_STEP', label: 'BL\nStep', category: 'Backlight', description: 'Cycle keyboard backlight levels' },
  { code: 'BL_UP', label: 'BL +', category: 'Backlight', description: 'Increase keyboard backlight level' },
  { code: 'BL_DOWN', label: 'BL -', category: 'Backlight', description: 'Decrease keyboard backlight level' },
  { code: 'BL_ON', label: 'BL On', category: 'Backlight', description: 'Turn keyboard backlight on' },
  { code: 'BL_OFF', label: 'BL Off', category: 'Backlight', description: 'Turn keyboard backlight off' },
  { code: 'RGB_TOG', label: 'RGB\nToggle', category: 'Backlight', description: 'Toggle RGB backlight' },
  { code: 'RGB_MOD', label: 'Mode +', category: 'Backlight', description: 'Cycle RGB backlight mode forward' },
  { code: 'RGB_RMOD', label: 'Mode -', category: 'Backlight', description: 'Cycle RGB backlight mode backward' },
  { code: 'RGB_VAI', label: 'Bright +', category: 'Backlight', description: 'Increase RGB backlight brightness' },
  { code: 'RGB_VAD', label: 'Bright -', category: 'Backlight', description: 'Decrease RGB backlight brightness' },
  { code: 'RGB_HUI', label: 'Hue +', category: 'Backlight', description: 'Increase RGB backlight hue' },
  { code: 'RGB_HUD', label: 'Hue -', category: 'Backlight', description: 'Decrease RGB backlight hue' },
  { code: 'RGB_SAI', label: 'Sat +', category: 'Backlight', description: 'Increase RGB backlight saturation' },
  { code: 'RGB_SAD', label: 'Sat -', category: 'Backlight', description: 'Decrease RGB backlight saturation' },
  { code: 'RGB_SPI', label: 'Speed +', category: 'Backlight', description: 'Increase RGB backlight effect speed' },
  { code: 'RGB_SPD', label: 'Speed -', category: 'Backlight', description: 'Decrease RGB backlight effect speed' },

  { code: 'transparent', label: '▽', category: 'Special', description: 'Passes through the keycode of the layer below (Transparent)' },
  { code: 'none', label: 'None', category: 'Special', description: 'Disables the key (No action)' },
  { code: 'BOOTLOADER', label: 'Reset', category: 'Special', description: 'Enters bootloader / system reset mode' },
  ...Array.from({ length: 12 }, (_, i) => ({ code: `F${13 + i}`, label: `F${13 + i}`, category: 'Special' as const })),
  { code: 'EISU', label: '英数', category: 'Special', description: 'Alphanumeric Toggle key for JIS keyboards' },
];
