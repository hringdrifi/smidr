import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';

export interface KeyMapEntry {
  qmk: string;
  hid: number;
}

// 記号類も完全に KC_ を取り除いたQMK定数短縮名でマッピング
export const KEY_MAP: Record<UniversalKey, KeyMapEntry> = {
  // Letters
  "A": { qmk: "KC_A", hid: 0x0004 },
  "B": { qmk: "KC_B", hid: 0x0005 },
  "C": { qmk: "KC_C", hid: 0x0006 },
  "D": { qmk: "KC_D", hid: 0x0007 },
  "E": { qmk: "KC_E", hid: 0x0008 },
  "F": { qmk: "KC_F", hid: 0x0009 },
  "G": { qmk: "KC_G", hid: 0x000A },
  "H": { qmk: "KC_H", hid: 0x000B },
  "I": { qmk: "KC_I", hid: 0x000C },
  "J": { qmk: "KC_J", hid: 0x000D },
  "K": { qmk: "KC_K", hid: 0x000E },
  "L": { qmk: "KC_L", hid: 0x000F },
  "M": { qmk: "KC_M", hid: 0x0010 },
  "N": { qmk: "KC_N", hid: 0x0011 },
  "O": { qmk: "KC_O", hid: 0x0012 },
  "P": { qmk: "KC_P", hid: 0x0013 },
  "Q": { qmk: "KC_Q", hid: 0x0014 },
  "R": { qmk: "KC_R", hid: 0x0015 },
  "S": { qmk: "KC_S", hid: 0x0016 },
  "T": { qmk: "KC_T", hid: 0x0017 },
  "U": { qmk: "KC_U", hid: 0x0018 },
  "V": { qmk: "KC_V", hid: 0x0019 },
  "W": { qmk: "KC_W", hid: 0x001A },
  "X": { qmk: "KC_X", hid: 0x001B },
  "Y": { qmk: "KC_Y", hid: 0x001C },
  "Z": { qmk: "KC_Z", hid: 0x001D },

  // Numbers
  "1": { qmk: "KC_1", hid: 0x001E },
  "2": { qmk: "KC_2", hid: 0x001F },
  "3": { qmk: "KC_3", hid: 0x0020 },
  "4": { qmk: "KC_4", hid: 0x0021 },
  "5": { qmk: "KC_5", hid: 0x0022 },
  "6": { qmk: "KC_6", hid: 0x0023 },
  "7": { qmk: "KC_7", hid: 0x0024 },
  "8": { qmk: "KC_8", hid: 0x0025 },
  "9": { qmk: "KC_9", hid: 0x0026 },
  "0": { qmk: "KC_0", hid: 0x0027 },

  // Function keys
  "F1": { qmk: "KC_F1", hid: 0x003A },
  "F2": { qmk: "KC_F2", hid: 0x003B },
  "F3": { qmk: "KC_F3", hid: 0x003C },
  "F4": { qmk: "KC_F4", hid: 0x003D },
  "F5": { qmk: "KC_F5", hid: 0x003E },
  "F6": { qmk: "KC_F6", hid: 0x003F },
  "F7": { qmk: "KC_F7", hid: 0x0040 },
  "F8": { qmk: "KC_F8", hid: 0x0041 },
  "F9": { qmk: "KC_F9", hid: 0x0042 },
  "F10": { qmk: "KC_F10", hid: 0x0043 },
  "F11": { qmk: "KC_F11", hid: 0x0044 },
  "F12": { qmk: "KC_F12", hid: 0x0045 },
  "F13": { qmk: "KC_F13", hid: 0x0068 },
  "F14": { qmk: "KC_F14", hid: 0x0069 },
  "F15": { qmk: "KC_F15", hid: 0x006A },
  "F16": { qmk: "KC_F16", hid: 0x006B },
  "F17": { qmk: "KC_F17", hid: 0x006C },
  "F18": { qmk: "KC_F18", hid: 0x006D },
  "F19": { qmk: "KC_F19", hid: 0x006E },
  "F20": { qmk: "KC_F20", hid: 0x006F },
  "F21": { qmk: "KC_F21", hid: 0x0070 },
  "F22": { qmk: "KC_F22", hid: 0x0071 },
  "F23": { qmk: "KC_F23", hid: 0x0072 },
  "F24": { qmk: "KC_F24", hid: 0x0073 },

  // Control keys
  "ESC": { qmk: "KC_ESC", hid: 0x0029 },
  "TAB": { qmk: "KC_TAB", hid: 0x002B },
  "CAPS": { qmk: "KC_CAPS", hid: 0x0039 },
  "ENT": { qmk: "KC_ENT", hid: 0x0028 },
  "BSPC": { qmk: "KC_BSPC", hid: 0x002A },
  "SPC": { qmk: "KC_SPC", hid: 0x002C },

  // Symbols (KC_ を完全に除いたQMK定数短縮名)
  "MINS": { qmk: "KC_MINS", hid: 0x002D },
  "EQL": { qmk: "KC_EQL", hid: 0x002E },
  "LBRC": { qmk: "KC_LBRC", hid: 0x002F },
  "RBRC": { qmk: "KC_RBRC", hid: 0x0030 },
  "BSLS": { qmk: "KC_BSLS", hid: 0x0031 },
  "SCLN": { qmk: "KC_SCLN", hid: 0x0033 },
  "QUOT": { qmk: "KC_QUOT", hid: 0x0034 },
  "GRV": { qmk: "KC_GRV", hid: 0x0035 },
  "COMM": { qmk: "KC_COMM", hid: 0x0036 },
  "DOT": { qmk: "KC_DOT", hid: 0x0037 },
  "SLSH": { qmk: "KC_SLSH", hid: 0x0038 },
  "NUHS": { qmk: "KC_NUHS", hid: 0x0032 },
  "NUBS": { qmk: "KC_NUBS", hid: 0x0031 },

  // JIS Japanese Keycodes
  "YEN": { qmk: "KC_INT3", hid: 0x0089 },
  "RO": { qmk: "KC_INT1", hid: 0x0087 },
  "MHEN": { qmk: "KC_MHEN", hid: 0x008B },
  "HENK": { qmk: "KC_HENK", hid: 0x008A },
  "KANA": { qmk: "KC_KANA", hid: 0x0088 },
  "EISU": { qmk: "KC_LNG2", hid: 0x0091 },

  // Navigations
  "UP": { qmk: "KC_UP", hid: 0x0052 },
  "DOWN": { qmk: "KC_DOWN", hid: 0x0051 },
  "LEFT": { qmk: "KC_LEFT", hid: 0x0050 },
  "RIGHT": { qmk: "KC_RGHT", hid: 0x004F },
  "INS": { qmk: "KC_INS", hid: 0x0049 },
  "DEL": { qmk: "KC_DEL", hid: 0x004C },
  "HOME": { qmk: "KC_HOME", hid: 0x004A },
  "END": { qmk: "KC_END", hid: 0x004D },
  "PGUP": { qmk: "KC_PGUP", hid: 0x004B },
  "PGDN": { qmk: "KC_PGDN", hid: 0x004E },

  // Lock keys
  "NLCK": { qmk: "KC_NLCK", hid: 0x0053 },
  "SCRL": { qmk: "KC_SCRL", hid: 0x0047 },
  "PSCR": { qmk: "KC_PSCR", hid: 0x0046 },
  "PAUS": { qmk: "KC_PAUS", hid: 0x0048 },

  // Modifiers
  "LCTL": { qmk: "KC_LCTL", hid: 0x00E0 },
  "LSFT": { qmk: "KC_LSFT", hid: 0x00E1 },
  "LALT": { qmk: "KC_LALT", hid: 0x00E2 },
  "LGUI": { qmk: "KC_LGUI", hid: 0x00E3 },
  "RCTL": { qmk: "KC_RCTL", hid: 0x00E4 },
  "RSFT": { qmk: "KC_RSFT", hid: 0x00E5 },
  "RALT": { qmk: "KC_RALT", hid: 0x00E6 },
  "RGUI": { qmk: "KC_RGUI", hid: 0x00E7 },

  // Media / Consumer
  "MPLY": { qmk: "KC_MPLY", hid: 0x00CD },
  "MSTP": { qmk: "KC_MSTP", hid: 0x00CC },
  "MNXT": { qmk: "KC_MNXT", hid: 0x00B5 },
  "MPRV": { qmk: "KC_MPRV", hid: 0x00B6 },
  "VOLU": { qmk: "KC_VOLU", hid: 0x00B9 },
  "VOLD": { qmk: "KC_VOLD", hid: 0x00BA },
  "MUTE": { qmk: "KC_MUTE", hid: 0x00E2 },
  "BRIU": { qmk: "KC_BRIU", hid: 0x006F },
  "BRID": { qmk: "KC_BRID", hid: 0x0070 },

  // Lighting
  "UG_TOGG": { qmk: "UG_TOGG", hid: 0x7820 },
  "UG_NEXT": { qmk: "UG_NEXT", hid: 0x7821 },
  "UG_PREV": { qmk: "UG_PREV", hid: 0x7822 },
  "UG_VALU": { qmk: "UG_VALU", hid: 0x7827 },
  "UG_VALD": { qmk: "UG_VALD", hid: 0x7828 },
  "UG_HUEU": { qmk: "UG_HUEU", hid: 0x7823 },
  "UG_HUED": { qmk: "UG_HUED", hid: 0x7824 },
  "UG_SATU": { qmk: "UG_SATU", hid: 0x7825 },
  "UG_SATD": { qmk: "UG_SATD", hid: 0x7826 },
  "UG_SPDU": { qmk: "UG_SPDU", hid: 0x7829 },
  "UG_SPDD": { qmk: "UG_SPDD", hid: 0x782A },
  "BL_ON": { qmk: "BL_ON", hid: 0x7800 },
  "BL_OFF": { qmk: "BL_OFF", hid: 0x7801 },
  "BL_TOGG": { qmk: "BL_TOGG", hid: 0x7802 },
  "BL_DOWN": { qmk: "BL_DOWN", hid: 0x7803 },
  "BL_UP": { qmk: "BL_UP", hid: 0x7804 },
  "BL_STEP": { qmk: "BL_STEP", hid: 0x7805 },
  "BL_BRTG": { qmk: "BL_BRTG", hid: 0x7806 },
  "LM_ON": { qmk: "LM_ON", hid: 0x7810 },
  "LM_OFF": { qmk: "LM_OFF", hid: 0x7811 },
  "LM_TOGG": { qmk: "LM_TOGG", hid: 0x7812 },
  "LM_NEXT": { qmk: "LM_NEXT", hid: 0x7813 },
  "LM_PREV": { qmk: "LM_PREV", hid: 0x7814 },
  "LM_BRIU": { qmk: "LM_BRIU", hid: 0x7815 },
  "LM_BRID": { qmk: "LM_BRID", hid: 0x7816 },
  "LM_SPDU": { qmk: "LM_SPDU", hid: 0x7817 },
  "LM_SPDD": { qmk: "LM_SPDD", hid: 0x7818 },
  "LM_FLGN": { qmk: "LM_FLGN", hid: 0x7819 },
  "LM_FLGP": { qmk: "LM_FLGP", hid: 0x781A },
  "RM_ON": { qmk: "RM_ON", hid: 0x7840 },
  "RM_OFF": { qmk: "RM_OFF", hid: 0x7841 },
  "RM_TOGG": { qmk: "RM_TOGG", hid: 0x7842 },
  "RM_NEXT": { qmk: "RM_NEXT", hid: 0x7843 },
  "RM_PREV": { qmk: "RM_PREV", hid: 0x7844 },
  "RM_HUEU": { qmk: "RM_HUEU", hid: 0x7845 },
  "RM_HUED": { qmk: "RM_HUED", hid: 0x7846 },
  "RM_SATU": { qmk: "RM_SATU", hid: 0x7847 },
  "RM_SATD": { qmk: "RM_SATD", hid: 0x7848 },
  "RM_VALU": { qmk: "RM_VALU", hid: 0x7849 },
  "RM_VALD": { qmk: "RM_VALD", hid: 0x784A },
  "RM_SPDU": { qmk: "RM_SPDU", hid: 0x784B },
  "RM_SPDD": { qmk: "RM_SPDD", hid: 0x784C },
  "RM_FLGN": { qmk: "RM_FLGN", hid: 0x784D },
  "RM_FLGP": { qmk: "RM_FLGP", hid: 0x784E },

  // Mouse Keys
  "MOUSE_UP": { qmk: "KC_MS_U", hid: 0x00F0 },
  "MOUSE_DOWN": { qmk: "KC_MS_D", hid: 0x00F1 },
  "MOUSE_LEFT": { qmk: "KC_MS_L", hid: 0x00F2 },
  "MOUSE_RIGHT": { qmk: "KC_MS_R", hid: 0x00F3 },
  "MOUSE_BTN1": { qmk: "KC_BTN1", hid: 0x00F4 },
  "MOUSE_BTN2": { qmk: "KC_BTN2", hid: 0x00F5 },
  "MOUSE_BTN3": { qmk: "KC_BTN3", hid: 0x00F6 },
  "MOUSE_BTN4": { qmk: "KC_BTN4", hid: 0x00F7 },
  "MOUSE_BTN5": { qmk: "KC_BTN5", hid: 0x00F8 },

  // System
  "BOOTLOADER": { qmk: "QK_BOOT", hid: 0x7C00 },
  "SYSTEM_RESET": { qmk: "QK_BOOT", hid: 0x7C00 },
  "TRNS": { qmk: "KC_TRNS", hid: 0x0001 },
  "NO": { qmk: "KC_NO", hid: 0x0000 }
};

// Reversing mappings for rapid lookup
export const QMK_TO_UNIVERSAL: Record<string, UniversalKey> = Object.entries(KEY_MAP).reduce((acc, [k, v]) => {
  if (!acc[v.qmk]) acc[v.qmk] = k as UniversalKey;
  return acc;
}, {} as Record<string, UniversalKey>);

export const HID_TO_UNIVERSAL: Record<number, UniversalKey> = Object.entries(KEY_MAP).reduce((acc, [k, v]) => {
  if (!acc[v.hid]) acc[v.hid] = k as UniversalKey;
  return acc;
}, {} as Record<number, UniversalKey>);

// QMK Modifier Bit Masks used in MT/mod_tap dynamic keys
export const MODIFIER_MASKS: Record<Modifier, number> = {
  "LCTL": 0x01,
  "LSFT": 0x02,
  "LALT": 0x04,
  "LGUI": 0x08,
  "RCTL": 0x11,
  "RSFT": 0x12,
  "RALT": 0x14,
  "RGUI": 0x18
};

// Decodes standard 16-bit QMK keycodes into the unified UniversalAction AST
export function viaCodeToAction(value: number): UniversalAction {
  // Transparent (Pass-through)
  if (value === 0x0001) return { action: 'trans' };
  
  // None (No Action)
  if (value === 0x0000) return { action: 'none' };

  // Ordinary modifier + key combo -> 0x0100 - 0x1FFF range (QK_MODS)
  if (value >= 0x0100 && value <= 0x1FFF) {
    const modBits = (value & 0x1F00) >> 8;
    const innerHid = value & 0x00FF;
    
    // Parse individual modifier flags
    const modifiers: Modifier[] = [];
    const isRightHanded = (modBits & 0x10) === 0x10;

    Object.entries(MODIFIER_MASKS).forEach(([modName, mask]) => {
      const isModRight = (mask & 0x10) === 0x10;
      if (isRightHanded === isModRight) {
        if ((modBits & mask) === mask) {
          modifiers.push(modName as Modifier);
        }
      }
    });

    const innerAction = viaCodeToAction(innerHid);
    const keycode = innerAction.action === 'tap' ? innerAction.keycode : 'TRNS';
    return { action: 'tap', keycode, mods: modifiers };
  }

  // Layer Momentary MO(n) -> 0x5200 - 0x520F range
  if (value >= 0x5200 && value <= 0x520F) {
    return { action: 'mo', layerId: value - 0x5200 };
  }

  // Layer Toggle TG(n) -> 0x5210 - 0x521F range
  if (value >= 0x5210 && value <= 0x521F) {
    return { action: 'tg', layerId: value - 0x5210 };
  }

  // Layer To TO(n) -> 0x5220 - 0x522F range
  if (value >= 0x5220 && value <= 0x522F) {
    return { action: 'to', layerId: value - 0x5220 };
  }

  // Layer Tap LT(layer, key) -> 0x4000 - 0x4FFF range
  if (value >= 0x4000 && value <= 0x4FFF) {
    const layerId = (value & 0x0F00) >> 8;
    const innerHid = value & 0x00FF;
    const innerAction = viaCodeToAction(innerHid);
    return { action: 'lt', layerId, tapAction: innerAction };
  }

  // Mod Tap MT(mod, key) -> 0x2000 - 0x3FFF range
  if (value >= 0x2000 && value <= 0x3FFF) {
    const modBits = (value & 0x1F00) >> 8;
    const innerHid = value & 0x00FF;
    const tapAction = viaCodeToAction(innerHid);
    
    // Parse individual modifier flags
    const modifiers: Modifier[] = [];
    const isRightHanded = (modBits & 0x10) === 0x10;

    Object.entries(MODIFIER_MASKS).forEach(([modName, mask]) => {
      const isModRight = (mask & 0x10) === 0x10;
      if (isRightHanded === isModRight) {
        if ((modBits & mask) === mask) {
          modifiers.push(modName as Modifier);
        }
      }
    });
    return { action: 'mt', modifiers, tapAction };
  }

  // Macro execution -> 0x7700 range
  if (value >= 0x7700 && value <= 0x771F) {
    return { action: 'macro', macroId: value - 0x7700 };
  }

  // Basic keys lookup
  if (HID_TO_UNIVERSAL[value]) {
    return { action: 'tap', keycode: HID_TO_UNIVERSAL[value] };
  }

  // Escape hatch for unsupported raw codes
  return { action: 'custom', protocol: 'qmk', rawCode: `0x${value.toString(16).toUpperCase()}` };
}

// Encodes UniversalAction AST back into standard 16-bit QMK dynamic keycodes
export function actionToViaCode(action: UniversalAction): number {
  switch (action.action) {
    case 'trans':
      return 0x0001;
    case 'none':
      return 0x0000;
    case 'tap': {
      if (action.mods && action.mods.length > 0) {
        let mask = 0;
        action.mods.forEach(m => { mask |= MODIFIER_MASKS[m]; });
        const innerCode = KEY_MAP[action.keycode]?.hid ?? 0x0000;
        return ((mask & 0x1F) << 8) | (innerCode & 0xFF);
      }
      return KEY_MAP[action.keycode]?.hid ?? 0x0000;
    }
    case 'mo':
      return 0x5200 + (action.layerId & 0xF);
    case 'tg':
      return 0x5210 + (action.layerId & 0xF);
    case 'to':
      return 0x5220 + (action.layerId & 0xF);
    case 'lt': {
      const innerCode = actionToViaCode(action.tapAction);
      return 0x4000 | ((action.layerId & 0xF) << 8) | (innerCode & 0xFF);
    }
    case 'mt': {
      const innerCode = actionToViaCode(action.tapAction);
      let modBits = 0;
      action.modifiers.forEach(m => { modBits |= MODIFIER_MASKS[m]; });
      return 0x2000 | ((modBits & 0x1F) << 8) | (innerCode & 0xFF);
    }
    case 'macro':
      return 0x7700 + (action.macroId & 0x1F);
    case 'custom':
      if ((action.protocol === 'qmk' || action.protocol === 'via' || action.protocol === 'vial') && action.rawCode.startsWith('0x')) {
        return parseInt(action.rawCode.slice(2), 16);
      }
      return 0x0000;
    default:
      return 0x0000;
  }
}

// Converts UniversalAction AST into QMK C-macro string notations (for info.json/keymap.c exports)
export function actionToQmkString(action: UniversalAction): string {
  switch (action.action) {
    case 'trans':
      return 'KC_TRNS';
    case 'none':
      return 'KC_NO';
    case 'tap': {
      if (action.mods && action.mods.length > 0) {
        const innerQmk = KEY_MAP[action.keycode]?.qmk ?? 'KC_NO';
        let result = innerQmk;
        action.mods.forEach(mod => {
          result = `${mod}(${result})`;
        });
        return result;
      }
      return KEY_MAP[action.keycode]?.qmk ?? 'KC_NO';
    }
    case 'mo':
      return `MO(${action.layerId})`;
    case 'tg':
      return `TG(${action.layerId})`;
    case 'to':
      return `TO(${action.layerId})`;
    case 'lt': {
      const innerQmk = actionToQmkString(action.tapAction);
      return `LT(${action.layerId}, ${innerQmk})`;
    }
    case 'mt': {
      const innerQmk = actionToQmkString(action.tapAction);
      const mods = action.modifiers.map(m => `MOD_${m}`).join(' | ');
      return `MT(${mods}, ${innerQmk})`;
    }
    case 'macro':
      return `MACRO(${action.macroId})`;
    case 'custom':
      return action.rawCode;
    default:
      return 'KC_NO';
  }
}

// Parses QMK C-macro strings back into the unified UniversalAction AST
export function qmkStringToAction(qmkStr: string): UniversalAction {
  const trimmed = qmkStr.trim();
  
  if (trimmed === 'KC_TRNS') return { action: 'trans' };
  if (trimmed === 'KC_NO') return { action: 'none' };

  // Nested modifiers LCTL(LSFT(KC_A)) or shortcuts C(S(KC_A))
  const modMatch = trimmed.match(/^(LCTL|LSFT|LALT|LGUI|RCTL|RSFT|RALT|RGUI|C|S|A|G)\((.+)\)$/);
  if (modMatch) {
    const modName = modMatch[1];
    const innerStr = modMatch[2];
    
    const shortcutMap: Record<string, Modifier> = {
      'C': 'LCTL', 'S': 'LSFT', 'A': 'LALT', 'G': 'LGUI'
    };
    const mod = (shortcutMap[modName] || modName) as Modifier;
    
    const innerAction = qmkStringToAction(innerStr);
    const targetKey = innerAction.action === 'tap' ? innerAction.keycode : 'TRNS';
    const innerMods = innerAction.action === 'tap' ? (innerAction.mods || []) : [];
    return {
      action: 'tap',
      keycode: targetKey,
      mods: [mod, ...innerMods]
    };
  }

  // Multi-modifiers LCA(KC_A), MEH(KC_A), HYPR(KC_A)
  const multiModMatch = trimmed.match(/^(LCA|LSA|MEH|HYPR)\((.+)\)$/);
  if (multiModMatch) {
    const macroName = multiModMatch[1];
    const innerStr = multiModMatch[2];
    const innerAction = qmkStringToAction(innerStr);
    
    let modifiers: Modifier[] = [];
    if (macroName === 'LCA') modifiers = ['LCTL', 'LALT'];
    else if (macroName === 'LSA') modifiers = ['LSFT', 'LALT'];
    else if (macroName === 'MEH') modifiers = ['LCTL', 'LSFT', 'LALT'];
    else if (macroName === 'HYPR') modifiers = ['LCTL', 'LSFT', 'LALT', 'LGUI'];
    
    const targetKey = innerAction.action === 'tap' ? innerAction.keycode : 'TRNS';
    const innerMods = innerAction.action === 'tap' ? (innerAction.mods || []) : [];
    return {
      action: 'tap',
      keycode: targetKey,
      mods: [...modifiers, ...innerMods]
    };
  }

  // MO(n)
  let match = trimmed.match(/^MO\((\d+)\)$/);
  if (match) return { action: 'mo', layerId: parseInt(match[1]) };

  // TG(n)
  match = trimmed.match(/^TG\((\d+)\)$/);
  if (match) return { action: 'tg', layerId: parseInt(match[1]) };

  // TO(n)
  match = trimmed.match(/^TO\((\d+)\)$/);
  if (match) return { action: 'to', layerId: parseInt(match[1]) };

  // LT(layer, key)
  match = trimmed.match(/^LT\((\d+)\s*,\s*([^)]+)\)$/);
  if (match) {
    const layerId = parseInt(match[1]);
    const tapAction = qmkStringToAction(match[2]);
    return { action: 'lt', layerId, tapAction };
  }

  // MT(mod, key)
  match = trimmed.match(/^MT\(([^,]+)\s*,\s*([^)]+)\)$/);
  if (match) {
    const modsStr = match[1].trim();
    const tapAction = qmkStringToAction(match[2]);
    
    const modifiers: Modifier[] = [];
    const parts = modsStr.split('|').map(p => p.trim());
    parts.forEach(part => {
      const cleanMod = part.replace(/^MOD_/, '');
      if (MODIFIER_MASKS[cleanMod as Modifier] !== undefined) {
        modifiers.push(cleanMod as Modifier);
      }
    });
    return { action: 'mt', modifiers, tapAction };
  }

  // MACRO(n)
  match = trimmed.match(/^MACRO\((\d+)\)$/);
  if (match) return { action: 'macro', macroId: parseInt(match[1]) };

  // Basic keys lookup
  if (QMK_TO_UNIVERSAL[trimmed]) {
    return { action: 'tap', keycode: QMK_TO_UNIVERSAL[trimmed] };
  }

  return { action: 'custom', protocol: 'qmk', rawCode: trimmed };
}
