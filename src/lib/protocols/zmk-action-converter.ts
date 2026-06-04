import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';

// 記号類も完全に KC_ を取り除いたQMK定数短縮名からZMK公式表記へマッピング
export const ZMK_KEY_MAP: Record<UniversalKey, string> = {
  // Letters
  "A": "A", "B": "B", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G", "H": "H",
  "I": "I", "J": "J", "K": "K", "L": "L", "M": "M", "N": "N", "O": "O", "P": "P",
  "Q": "Q", "R": "R", "S": "S", "T": "T", "U": "U", "V": "V", "W": "W", "X": "X",
  "Y": "Y", "Z": "Z",
  "NUHS": "NON_US_HASH", "NUBS": "NON_US_BSLH",

  // Numbers
  "1": "N1", "2": "N2", "3": "N3", "4": "N4", "5": "N5",
  "6": "N6", "7": "N7", "8": "N8", "9": "N9", "0": "N0",

  // Function Keys
  "F1": "F1", "F2": "F2", "F3": "F3", "F4": "F4", "F5": "F5", "F6": "F6",
  "F7": "F7", "F8": "F8", "F9": "F9", "F10": "F10", "F11": "F11", "F12": "F12",
  "F13": "F13", "F14": "F14", "F15": "F15", "F16": "F16", "F17": "F17", "F18": "F18",
  "F19": "F19", "F20": "F20", "F21": "F21", "F22": "F22", "F23": "F23", "F24": "F24",

  // Control Keys
  "ESC": "ESC",
  "TAB": "TAB",
  "CAPS": "CLCK",
  "ENT": "RET",
  "BSPC": "BSPC",
  "SPC": "SPACE",

  // Symbols (KC_ を取り除いたQMK短縮キーからZMK標準への完璧なマッピング)
  "MINS": "MINUS",
  "EQL": "EQUAL",
  "LBRC": "LBKT",
  "RBRC": "RBKT",
  "BSLS": "BSLH",
  "SCLN": "SEMI",
  "QUOT": "SQT",
  "GRV": "GRAV",
  "COMM": "COMMA",
  "DOT": "DOT",
  "SLSH": "FSLH",

  // JIS Japanese Keycodes
  "YEN": "JIS_YEN",
  "RO": "JIS_UNDERSCORE",
  "MHEN": "JIS_MUHENKAN",
  "HENK": "JIS_HENKAN",
  "KANA": "JIS_KANA",
  "EISU": "JIS_EISU",

  // Navigation
  "UP": "UP",
  "DOWN": "DOWN",
  "LEFT": "LEFT",
  "RIGHT": "RIGHT",
  "INS": "INS",
  "DEL": "DEL",
  "HOME": "HOME",
  "END": "END",
  "PGUP": "PG_UP",
  "PGDN": "PG_DN",

  // Lock keys
  "NLCK": "KP_NUM",
  "SCRL": "SLCK",
  "PSCR": "PSCRN",
  "PAUS": "PAUSE_BREAK",

  // Keypad / Application
  "P0": "KP_N0",
  "P1": "KP_N1",
  "P2": "KP_N2",
  "P3": "KP_N3",
  "P4": "KP_N4",
  "P5": "KP_N5",
  "P6": "KP_N6",
  "P7": "KP_N7",
  "P8": "KP_N8",
  "P9": "KP_N9",
  "PSLS": "KP_SLASH",
  "PAST": "KP_ASTERISK",
  "PMNS": "KP_MINUS",
  "PPLS": "KP_PLUS",
  "PENT": "KP_ENTER",
  "PDOT": "KP_DOT",
  "PCMM": "KP_COMMA",
  "PEQL": "KP_EQUAL",
  "APP": "K_APP",

  // Modifiers
  "LCTL": "LCTRL",
  "LSFT": "LSHIFT",
  "LALT": "LALT",
  "LGUI": "LGUI",
  "RCTL": "RCTRL",
  "RSFT": "RSHIFT",
  "RALT": "RALT",
  "RGUI": "RGUI",

  // Media
  "MPLY": "C_PP",
  "MSTP": "C_STOP",
  "MNXT": "C_NEXT",
  "MPRV": "C_PREV",
  "VOLU": "C_VOL_UP",
  "VOLD": "C_VOL_DN",
  "MUTE": "C_MUTE",
  "BRIU": "C_BRI_UP",
  "BRID": "C_BRI_DN",

  // Lighting
  "UG_TOGG": "UG_TOGG",
  "UG_NEXT": "UG_NEXT",
  "UG_PREV": "UG_PREV",
  "UG_VALU": "UG_VALU",
  "UG_VALD": "UG_VALD",
  "UG_HUEU": "UG_HUEU",
  "UG_HUED": "UG_HUED",
  "UG_SATU": "UG_SATU",
  "UG_SATD": "UG_SATD",
  "UG_SPDU": "UG_SPDU",
  "UG_SPDD": "UG_SPDD",
  "BL_ON": "BL_ON",
  "BL_OFF": "BL_OFF",
  "BL_TOGG": "BL_TOGG",
  "BL_DOWN": "BL_DOWN",
  "BL_UP": "BL_UP",
  "BL_STEP": "BL_STEP",
  "BL_BRTG": "BL_BRTG",
  "LM_ON": "LM_ON",
  "LM_OFF": "LM_OFF",
  "LM_TOGG": "LM_TOGG",
  "LM_NEXT": "LM_NEXT",
  "LM_PREV": "LM_PREV",
  "LM_BRIU": "LM_BRIU",
  "LM_BRID": "LM_BRID",
  "LM_SPDU": "LM_SPDU",
  "LM_SPDD": "LM_SPDD",
  "LM_FLGN": "LM_FLGN",
  "LM_FLGP": "LM_FLGP",
  "RM_ON": "RM_ON",
  "RM_OFF": "RM_OFF",
  "RM_TOGG": "RM_TOGG",
  "RM_NEXT": "RM_NEXT",
  "RM_PREV": "RM_PREV",
  "RM_HUEU": "RM_HUEU",
  "RM_HUED": "RM_HUED",
  "RM_SATU": "RM_SATU",
  "RM_SATD": "RM_SATD",
  "RM_VALU": "RM_VALU",
  "RM_VALD": "RM_VALD",
  "RM_SPDU": "RM_SPDU",
  "RM_SPDD": "RM_SPDD",
  "RM_FLGN": "RM_FLGN",
  "RM_FLGP": "RM_FLGP",

  // Mouse Keys
  "MOUSE_UP": "MOVE_UP",
  "MOUSE_DOWN": "MOVE_DOWN",
  "MOUSE_LEFT": "MOVE_LEFT",
  "MOUSE_RIGHT": "MOVE_RIGHT",
  "MOUSE_BTN1": "LCLK",
  "MOUSE_BTN2": "RCLK",
  "MOUSE_BTN3": "MCLK",
  "MOUSE_BTN4": "MB4",
  "MOUSE_BTN5": "MB5",

  // System
  "BOOTLOADER": "BOOTLOADER",
  "SYSTEM_RESET": "SYS_RESET",
  "TRNS": "TRANS",
  "NO": "NONE"
};

// Reversing mappings for fast lookup
export const ZMK_TO_UNIVERSAL: Record<string, UniversalKey> = Object.entries(ZMK_KEY_MAP).reduce((acc, [k, v]) => {
  acc[v] = k as UniversalKey;
  return acc;
}, {} as Record<string, UniversalKey>);

export const ZMK_BACKLIGHT_KEY_MAP: Partial<Record<UniversalKey, string>> = {
  "BL_ON": "BL_ON",
  "BL_OFF": "BL_OFF",
  "BL_TOGG": "BL_TOG",
  "BL_DOWN": "BL_DEC",
  "BL_UP": "BL_INC",
  "BL_STEP": "BL_CYCLE"
};

export const ZMK_BACKLIGHT_TO_UNIVERSAL: Record<string, UniversalKey> = Object.entries(ZMK_BACKLIGHT_KEY_MAP).reduce((acc, [key, value]) => {
  if (value) acc[value] = key as UniversalKey;
  return acc;
}, {} as Record<string, UniversalKey>);

// Recursively parses ZMK nested modifiers like LC(LS(A))
export function parseZmkModifiedKey(str: string): { modifiers: Modifier[], keycode: UniversalKey } | null {
  const match = str.match(/^(LC|LS|LA|LG|RC|RS|RA|RG)\((.+)\)$/);
  if (match) {
    const sh = match[1];
    const inner = match[2];
    
    const mapping: Record<string, Modifier> = {
      'LC': 'LCTL', 'LS': 'LSFT', 'LA': 'LALT', 'LG': 'LGUI',
      'RC': 'RCTL', 'RS': 'RSFT', 'RA': 'RALT', 'RG': 'RGUI'
    };
    const mod = mapping[sh];
    
    const parsedInner = parseZmkModifiedKey(inner);
    if (parsedInner) {
      return {
        modifiers: [mod, ...parsedInner.modifiers],
        keycode: parsedInner.keycode
      };
    } else {
      const uKey = ZMK_TO_UNIVERSAL[inner] || inner;
      return {
        modifiers: [mod],
        keycode: uKey as UniversalKey
      };
    }
  }
  return null;
}

// Helper to convert UniversalAction AST to ZMK DTS string notation (e.g. for dynamic keymap compilation)
export function actionToZmkString(action: UniversalAction): string {
  switch (action.action) {
    case 'trans':
      return '&trans';
    case 'none':
      return '&none';
    case 'tap': {
      const zKey = ZMK_KEY_MAP[action.keycode] || action.keycode;
      if (action.keycode.startsWith('LM_')) {
        throw new Error(`ZMK LED Matrix does not support ${action.keycode}.`);
      }
      if (action.keycode.startsWith('RM_')) {
        throw new Error(`ZMK RGB Matrix does not support ${action.keycode}.`);
      }
      if (action.keycode.startsWith('BL_')) {
        const blAction = ZMK_BACKLIGHT_KEY_MAP[action.keycode];
        if (!blAction) {
          throw new Error(`ZMK backlight does not support ${action.keycode}.`);
        }
        return `&bl ${blAction}`;
      }
      if (action.keycode.startsWith('UG_')) {
        return `&rgb_ug ${zKey}`;
      }
      if (action.keycode.startsWith('MOUSE_BTN')) {
        return `&mkp ${zKey}`;
      }
      if (action.keycode.startsWith('MOUSE_') && (action.keycode as string) !== 'MOUSE_BTN') {
        return `&mmv ${zKey}`;
      }
      if (action.mods && action.mods.length > 0) {
        let result = zKey;
        const shortcutMap: Record<Modifier, string> = {
          'LCTL': 'LC', 'LSFT': 'LS', 'LALT': 'LA', 'LGUI': 'LG',
          'RCTL': 'RC', 'RSFT': 'RS', 'RALT': 'RA', 'RGUI': 'RG'
        };
        action.mods.forEach(mod => {
          const sh = shortcutMap[mod] || mod;
          result = `${sh}(${result})`;
        });
        return `&kp ${result}`;
      }
      return `&kp ${zKey}`;
    }
    case 'mo':
      return `&mo ${action.layerId}`;
    case 'tg':
      return `&tog ${action.layerId}`;
    case 'to':
      return `&to ${action.layerId}`;
    case 'lt': {
      const inner = actionToZmkString(action.tapAction).replace(/^&kp\s+/, '');
      return `&lt ${action.layerId} ${inner}`;
    }
    case 'mt': {
      if (action.modifiers.length === 0) {
        throw new Error('Mod-tap requires at least one hold modifier.');
      }
      const inner = actionToZmkString(action.tapAction).replace(/^&kp\s+/, '');
      const mods = action.modifiers.map(m => ZMK_KEY_MAP[m] || m).join(' ');
      return `&mt ${mods} ${inner}`;
    }
    case 'macro':
      return `&macro_${action.macroId}`;
    case 'td':
      return `&td ${action.tapDanceId}`;
    case 'custom':
      return action.rawCode;
    default:
      return '&none';
  }
}

// Parses ZMK DTS strings back into the unified UniversalAction AST
export function zmkStringToAction(zmkStr: string): UniversalAction {
  const trimmed = zmkStr.trim();

  if (trimmed === '&trans') return { action: 'trans' };
  if (trimmed === '&none') return { action: 'none' };

  // momentary layer (&mo 1)
  let match = trimmed.match(/^&mo\s+(\d+)$/);
  if (match) return { action: 'mo', layerId: parseInt(match[1]) };

  // layer toggle (&tog 1)
  match = trimmed.match(/^&tog\s+(\d+)$/);
  if (match) return { action: 'tg', layerId: parseInt(match[1]) };

  // layer to (&to 1)
  match = trimmed.match(/^&to\s+(\d+)$/);
  if (match) return { action: 'to', layerId: parseInt(match[1]) };

  // layer tap (&lt 1 SPACE)
  match = trimmed.match(/^&lt\s+(\d+)\s+([^\s]+)$/);
  if (match) {
    const layerId = parseInt(match[1]);
    const tapAction = zmkStringToAction(`&kp ${match[2]}`);
    return { action: 'lt', layerId, tapAction };
  }

  // mod tap (&mt LCTRL SPACE or &mt LCTRL LSHIFT SPACE)
  match = trimmed.match(/^&mt\s+(.+)\s+([^\s]+)$/);
  if (match) {
    const modsStr = match[1];
    const tapAction = zmkStringToAction(`&kp ${match[2]}`);
    const modifiers = modsStr.split(/\s+/).map(m => {
      const clean = m.trim();
      return ZMK_TO_UNIVERSAL[clean] || clean;
    }) as Modifier[];
    return { action: 'mt', modifiers, tapAction };
  }

  // macro (&macro_0)
  match = trimmed.match(/^&macro_(\d+)$/);
  if (match) return { action: 'macro', macroId: parseInt(match[1]) };

  // tap dance (&td 0)
  match = trimmed.match(/^&td\s+(\d+)$/);
  if (match) return { action: 'td', tapDanceId: parseInt(match[1]) };

  // rgb_ug (&rgb_ug UG_TOGG)
  match = trimmed.match(/^&rgb_ug\s+([^\s]+)$/);
  if (match) {
    const cmd = match[1];
    if (ZMK_TO_UNIVERSAL[cmd]) {
      return { action: 'tap', keycode: ZMK_TO_UNIVERSAL[cmd] };
    }
  }

  // backlight (&bl BL_TOG)
  match = trimmed.match(/^&bl\s+([^\s]+)(?:\s+\d+)?$/);
  if (match) {
    const cmd = match[1];
    if (ZMK_BACKLIGHT_TO_UNIVERSAL[cmd]) {
      return { action: 'tap', keycode: ZMK_BACKLIGHT_TO_UNIVERSAL[cmd] };
    }
  }

  // mouse keys (&mkp LCLK / &mmv MOVE_UP)
  match = trimmed.match(/^&(mkp|mmv)\s+([^\s]+)$/);
  if (match) {
    const inner = match[2];
    if (ZMK_TO_UNIVERSAL[inner]) {
      return { action: 'tap', keycode: ZMK_TO_UNIVERSAL[inner] };
    }
  }

  // basic key press (&kp A or nested mod combos &kp LC(LS(A)))
  match = trimmed.match(/^&kp\s+([^\s]+)$/);
  if (match) {
    const inner = match[1];
    const parsedMod = parseZmkModifiedKey(inner);
    if (parsedMod) {
      return { action: 'tap', keycode: parsedMod.keycode, mods: parsedMod.modifiers };
    }
    if (ZMK_TO_UNIVERSAL[inner]) {
      return { action: 'tap', keycode: ZMK_TO_UNIVERSAL[inner] };
    }
  }

  return { action: 'custom', protocol: 'zmk', rawCode: trimmed };
}

// Maps UniversalAction to ZMK Studio RPC Protobuf dynamic behavior request objects (stub for Phase 4)
export function actionToZmkRpc(action: UniversalAction): any {
  return {
    behaviorId: action.action,
    param: action.action === 'tap' ? ZMK_KEY_MAP[action.keycode] : null
  };
}
