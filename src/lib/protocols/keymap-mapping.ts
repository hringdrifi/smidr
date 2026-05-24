/**
 * Mapping between QMK/VIA numeric keycodes and Smiðr string codes.
 * This is a subset of common keycodes.
 */
export const HID_TO_QMK: Record<number, string> = {
  0x0000: 'KC_NO',
  0x0001: 'KC_TRNS',
  0x0004: 'KC_A',
  0x0005: 'KC_B',
  0x0006: 'KC_C',
  0x0007: 'KC_D',
  0x0008: 'KC_E',
  0x0009: 'KC_F',
  0x000A: 'KC_G',
  0x000B: 'KC_H',
  0x000C: 'KC_I',
  0x000D: 'KC_J',
  0x000E: 'KC_K',
  0x000F: 'KC_L',
  0x0010: 'KC_M',
  0x0011: 'KC_N',
  0x0012: 'KC_O',
  0x0013: 'KC_P',
  0x0014: 'KC_Q',
  0x0015: 'KC_R',
  0x0016: 'KC_S',
  0x0017: 'KC_T',
  0x0018: 'KC_U',
  0x0019: 'KC_V',
  0x001A: 'KC_W',
  0x001B: 'KC_X',
  0x001C: 'KC_Y',
  0x001D: 'KC_Z',
  0x001E: 'KC_1',
  0x001F: 'KC_2',
  0x0020: 'KC_3',
  0x0021: 'KC_4',
  0x0022: 'KC_5',
  0x0023: 'KC_6',
  0x0024: 'KC_7',
  0x0025: 'KC_8',
  0x0026: 'KC_9',
  0x0027: 'KC_0',
  0x0028: 'KC_ENT',
  0x0029: 'KC_ESC',
  0x002A: 'KC_BSPC',
  0x002B: 'KC_TAB',
  0x002C: 'KC_SPC',
  0x002D: 'KC_MINS',
  0x002E: 'KC_EQL',
  0x002F: 'KC_LBRC',
  0x0030: 'KC_RBRC',
  0x0031: 'KC_BSLS',
  0x0032: 'KC_NUHS',
  0x0033: 'KC_SCLN',
  0x0034: 'KC_QUOT',
  0x0035: 'KC_GRV',
  0x0036: 'KC_COMM',
  0x0037: 'KC_DOT',
  0x0038: 'KC_SLSH',
  0x0039: 'KC_CAPS',
  0x003A: 'KC_F1',
  0x003B: 'KC_F2',
  0x003C: 'KC_F3',
  0x003D: 'KC_F4',
  0x003E: 'KC_F5',
  0x003F: 'KC_F6',
  0x0040: 'KC_F7',
  0x0041: 'KC_F8',
  0x0042: 'KC_F9',
  0x0043: 'KC_F10',
  0x0044: 'KC_F11',
  0x0045: 'KC_F12',
  0x0046: 'KC_PSCR',
  0x0047: 'KC_SLCK',
  0x0048: 'KC_PAUS',
  0x0049: 'KC_INS',
  0x004A: 'KC_HOME',
  0x004B: 'KC_PGUP',
  0x004C: 'KC_DEL',
  0x004D: 'KC_END',
  0x004E: 'KC_PGDN',
  0x004F: 'KC_RGHT',
  0x0050: 'KC_LEFT',
  0x0051: 'KC_DOWN',
  0x0052: 'KC_UP',
  0x00E0: 'KC_LCTL',
  0x00E1: 'KC_LSFT',
  0x00E2: 'KC_LALT',
  0x00E3: 'KC_LGUI',
  0x00E4: 'KC_RCTL',
  0x00E5: 'KC_RSFT',
  0x00E6: 'KC_RALT',
  0x00E7: 'KC_RGUI',

  // Layers
  // MO(0) to MO(15)
  0x5200: 'MO(0)',
  0x5201: 'MO(1)',
  0x5202: 'MO(2)',
  0x5203: 'MO(3)',
  0x5204: 'MO(4)',
  0x5205: 'MO(5)',
  0x5206: 'MO(6)',
  0x5207: 'MO(7)',
  0x5208: 'MO(8)',
  0x5209: 'MO(9)',
  0x520A: 'MO(10)',
  0x520B: 'MO(11)',
  0x520C: 'MO(12)',
  0x520D: 'MO(13)',
  0x520E: 'MO(14)',
  0x520F: 'MO(15)',

  // TG(0) to TG(15)
  0x5210: 'TG(0)',
  0x5211: 'TG(1)',
  0x5212: 'TG(2)',
  0x5213: 'TG(3)',
  0x5214: 'TG(4)',
  0x5215: 'TG(5)',
  0x5216: 'TG(6)',
  0x5217: 'TG(7)',
  0x5218: 'TG(8)',
  0x5219: 'TG(9)',
  0x521A: 'TG(10)',
  0x521B: 'TG(11)',
  0x521C: 'TG(12)',
  0x521D: 'TG(13)',
  0x521E: 'TG(14)',
  0x521F: 'TG(15)',

  // TO(0) to TO(15)
  0x5220: 'TO(0)',
  0x5221: 'TO(1)',
  0x5222: 'TO(2)',
  0x5223: 'TO(3)',
  0x5224: 'TO(4)',
  0x5225: 'TO(5)',
  0x5226: 'TO(6)',
  0x5227: 'TO(7)',
  0x5228: 'TO(8)',
  0x5229: 'TO(9)',
  0x522A: 'TO(10)',
  0x522B: 'TO(11)',
  0x522C: 'TO(12)',
  0x522D: 'TO(13)',
  0x522E: 'TO(14)',
  0x522F: 'TO(15)',

  // TT(0) to TT(15)
  0x5230: 'TT(0)',
  0x5231: 'TT(1)',
  0x5232: 'TT(2)',
  0x5233: 'TT(3)',
  0x5234: 'TT(4)',
  0x5235: 'TT(5)',
  0x5236: 'TT(6)',
  0x5237: 'TT(7)',
  0x5238: 'TT(8)',
  0x5239: 'TT(9)',
  0x523A: 'TT(10)',
  0x523B: 'TT(11)',
  0x523C: 'TT(12)',
  0x523D: 'TT(13)',
  0x523E: 'TT(14)',
  0x523F: 'TT(15)',

  // DF(0) to DF(15)
  0x5240: 'DF(0)',
  0x5241: 'DF(1)',
  0x5242: 'DF(2)',
  0x5243: 'DF(3)',
  0x5244: 'DF(4)',
  0x5245: 'DF(5)',
  0x5246: 'DF(6)',
  0x5247: 'DF(7)',
  0x5248: 'DF(8)',
  0x5249: 'DF(9)',
  0x524A: 'DF(10)',
  0x524B: 'DF(11)',
  0x524C: 'DF(12)',
  0x524D: 'DF(13)',
  0x524E: 'DF(14)',
  0x524F: 'DF(15)',

  // OSL(0) to OSL(15)
  0x5250: 'OSL(0)',
  0x5251: 'OSL(1)',
  0x5252: 'OSL(2)',
  0x5253: 'OSL(3)',
  0x5254: 'OSL(4)',
  0x5255: 'OSL(5)',
  0x5256: 'OSL(6)',
  0x5257: 'OSL(7)',
  0x5258: 'OSL(8)',
  0x5259: 'OSL(9)',
  0x525A: 'OSL(10)',
  0x525B: 'OSL(11)',
  0x525C: 'OSL(12)',
  0x525D: 'OSL(13)',
  0x525E: 'OSL(14)',
  0x525F: 'OSL(15)',

  // PDF(0) to PDF(15)
  0x52E0: 'PDF(0)',
  0x52E1: 'PDF(1)',
  0x52E2: 'PDF(2)',
  0x52E3: 'PDF(3)',
  0x52E4: 'PDF(4)',
  0x52E5: 'PDF(5)',
  0x52E6: 'PDF(6)',
  0x52E7: 'PDF(7)',
  0x52E8: 'PDF(8)',
  0x52E9: 'PDF(9)',
  0x52EA: 'PDF(10)',
  0x52EB: 'PDF(11)',
  0x52EC: 'PDF(12)',
  0x52ED: 'PDF(13)',
  0x52EE: 'PDF(14)',
  0x52EF: 'PDF(15)',

  // Special/Vial layer functions
  0x7C7B: 'QK_LAYER_LOCK',
  0x5F10: 'FN_MO13',
  0x5F11: 'FN_MO23',
};

export const QMK_TO_HID: Record<string, number> = Object.entries(HID_TO_QMK).reduce((acc, [k, v]) => {
  acc[v] = parseInt(k);
  return acc;
}, {} as Record<string, number>);

export function decodeKeycode(value: number): string {
  // Simple mapping
  if (HID_TO_QMK[value]) return HID_TO_QMK[value];

  // Layer Functions
  if (value >= 0x5200 && value <= 0x520F) return `MO(${value - 0x5200})`;
  if (value >= 0x5210 && value <= 0x521F) return `TG(${value - 0x5210})`;
  if (value >= 0x5220 && value <= 0x522F) return `TO(${value - 0x5220})`;
  if (value >= 0x5230 && value <= 0x523F) return `TT(${value - 0x5230})`;
  if (value >= 0x5240 && value <= 0x524F) return `DF(${value - 0x5240})`;
  if (value >= 0x5250 && value <= 0x525F) return `OSL(${value - 0x5250})`;
  if (value >= 0x52E0 && value <= 0x52EF) return `PDF(${value - 0x52E0})`;

  // LT(layer, kc) -> 0x4000 range
  if (value >= 0x4000 && value <= 0x4FFF) {
    const layer = (value & 0x0F00) >> 8;
    const kc = value & 0x00FF;
    return `LT(${layer},${decodeKeycode(kc)})`;
  }

  // MT(mod, kc) -> 0x2000 - 0x3FFF range
  if (value >= 0x2000 && value <= 0x3FFF) {
    const mod = (value & 0x1F00) >> 8; // simplified
    const kc = value & 0x00FF;
    // MOD mapping needed for full accuracy
    return `MT(${mod},${decodeKeycode(kc)})`;
  }

  return `ANY(0x${value.toString(16).toUpperCase()})`;
}

export function encodeKeycode(code: string): number {
  if (QMK_TO_HID[code]) return QMK_TO_HID[code];

  // MO(n)
  let match = code.match(/MO\((\d+)\)/);
  if (match) return 0x5200 + parseInt(match[1]);

  // TG(n)
  match = code.match(/TG\((\d+)\)/);
  if (match) return 0x5210 + parseInt(match[1]);

  // TO(n)
  match = code.match(/TO\((\d+)\)/);
  if (match) return 0x5220 + parseInt(match[1]);

  // TT(n)
  match = code.match(/TT\((\d+)\)/);
  if (match) return 0x5230 + parseInt(match[1]);

  // DF(n)
  match = code.match(/DF\((\d+)\)/);
  if (match) return 0x5240 + parseInt(match[1]);

  // OSL(n)
  match = code.match(/OSL\((\d+)\)/);
  if (match) return 0x5250 + parseInt(match[1]);

  // PDF(n)
  match = code.match(/PDF\((\d+)\)/);
  if (match) return 0x52E0 + parseInt(match[1]);

  // LT(layer, kc)
  match = code.match(/LT\((\d+)\s*,\s*([^)]+)\)/);
  if (match) {
    const layer = parseInt(match[1]);
    const kcStr = match[2];
    const kc = encodeKeycode(kcStr);
    return 0x4000 | ((layer & 0xF) << 8) | (kc & 0xFF);
  }

  // ANY(0x...)
  match = code.match(/ANY\(0x([0-9A-Fa-f]+)\)/);
  if (match) return parseInt(match[1], 16);

  return 0x0000;
}
