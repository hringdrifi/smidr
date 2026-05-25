import { KEY_MAP } from './via-action-converter';
import { MacroAction, UniversalKey } from '@/types/actions';

const SS_QMK_PREFIX = 1;
const SS_TAP_CODE = 1;
const SS_DOWN_CODE = 2;
const SS_UP_CODE = 3;
const SS_DELAY_CODE = 4;
const VIAL_MACRO_EXT_TAP = 5;
const VIAL_MACRO_EXT_DOWN = 6;
const VIAL_MACRO_EXT_UP = 7;

/**
 * Deserializes raw macro buffer into MacroAction[][] for standard 16 macros.
 */
export function deserializeMacros(buffer: Uint8Array, count: number, protocolVersion: number): MacroAction[][] {
  const macrosBytes: Uint8Array[] = [];
  let current: number[] = [];
  
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) {
      macrosBytes.push(new Uint8Array(current));
      current = [];
    } else {
      current.push(buffer[i]);
    }
  }
  
  // Make sure we have exactly the expected count of macros
  while (macrosBytes.length < count) {
    macrosBytes.push(new Uint8Array(0));
  }
  
  const sliced = macrosBytes.slice(0, count);
  return sliced.map(bytes => deserializeMacro(bytes, protocolVersion));
}

/**
 * Deserializes a single macro's bytes into a sequence of MacroActions.
 */
export function deserializeMacro(data: Uint8Array, protocolVersion: number): MacroAction[] {
  const actions: MacroAction[] = [];
  let i = 0;
  
  if (protocolVersion >= 2) { // Advanced macros support delay and ext-keycodes
    while (i < data.length) {
      if (data[i] === SS_QMK_PREFIX) {
        if (i + 1 >= data.length) break;
        const act = data[i + 1];
        
        if ([SS_TAP_CODE, SS_DOWN_CODE, SS_UP_CODE, VIAL_MACRO_EXT_TAP, VIAL_MACRO_EXT_DOWN, VIAL_MACRO_EXT_UP].includes(act)) {
          let length = 0;
          let kc = 0;
          let actionType: 'tap' | 'down' | 'up' = 'tap';
          
          if ([SS_TAP_CODE, SS_DOWN_CODE, SS_UP_CODE].includes(act)) {
            if (i + 2 >= data.length) break;
            length = 3;
            kc = data[i + 2];
            actionType = act === SS_TAP_CODE ? 'tap' : act === SS_DOWN_CODE ? 'down' : 'up';
          } else { // VIAL_MACRO_EXT_*
            if (i + 3 >= data.length) break;
            length = 4;
            kc = data[i + 2] | (data[i + 3] << 8);
            actionType = act === VIAL_MACRO_EXT_TAP ? 'tap' : act === VIAL_MACRO_EXT_DOWN ? 'down' : 'up';
            if (kc > 0xFF00) {
              kc = (kc & 0xFF) << 8;
            }
          }
          
          const qmkKey = qmkCodeToKey(kc);
          
          // Append to previous sequence if it is of the same type
          const lastAction = actions[actions.length - 1];
          if (lastAction && lastAction.action === actionType && lastAction.keycodes) {
            lastAction.keycodes.push(qmkKey);
          } else {
            actions.push({ action: actionType, keycodes: [qmkKey] });
          }
          
          i += length;
        } else if (act === SS_DELAY_CODE) {
          if (i + 3 >= data.length) break;
          // delay decoding
          const delay = (data[i + 2] - 1) + (data[i + 3] - 1) * 255;
          actions.push({ action: 'delay', duration: delay });
          i += 4;
        } else {
          // Skipping malformed byte sequence
          i += 2;
        }
      } else {
        const ch = String.fromCharCode(data[i]);
        const lastAction = actions[actions.length - 1];
        if (lastAction && lastAction.action === 'text') {
          lastAction.text += ch;
        } else {
          actions.push({ action: 'text', text: ch });
        }
        i++;
      }
    }
  } else { // V1 Basic macros
    while (i < data.length) {
      const act = data[i];
      if ([SS_TAP_CODE, SS_DOWN_CODE, SS_UP_CODE].includes(act)) {
        if (i + 1 >= data.length) break;
        const kc = data[i + 1];
        const actionType = act === SS_TAP_CODE ? 'tap' : act === SS_DOWN_CODE ? 'down' : 'up';
        const qmkKey = qmkCodeToKey(kc);
        
        const lastAction = actions[actions.length - 1];
        if (lastAction && lastAction.action === actionType && lastAction.keycodes) {
          lastAction.keycodes.push(qmkKey);
        } else {
          actions.push({ action: actionType, keycodes: [qmkKey] });
        }
        
        i += 2;
      } else {
        const ch = String.fromCharCode(data[i]);
        const lastAction = actions[actions.length - 1];
        if (lastAction && lastAction.action === 'text') {
          lastAction.text += ch;
        } else {
          actions.push({ action: 'text', text: ch });
        }
        i++;
      }
    }
  }
  return actions;
}

/**
 * Serializes MacroAction[][] back into a concatenated raw byte buffer separated by NUL.
 */
export function serializeMacros(macros: MacroAction[][], protocolVersion: number): Uint8Array {
  const serializedChunks = macros.map(m => serializeMacro(m, protocolVersion));
  const totalLength = serializedChunks.reduce((acc, c) => acc + c.length + 1, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of serializedChunks) {
    result.set(chunk, offset);
    offset += chunk.length;
    result[offset] = 0; // NUL terminator
    offset++;
  }
  
  return result;
}

/**
 * Serializes a single list of MacroActions to bytes.
 */
export function serializeMacro(actions: MacroAction[], protocolVersion: number): Uint8Array {
  const bytes: number[] = [];
  
  for (const action of actions) {
    if (action.action === 'text') {
      const textBytes = new TextEncoder().encode(action.text || '');
      for (let j = 0; j < textBytes.length; j++) {
        bytes.push(textBytes[j]);
      }
    } else if (action.action === 'delay') {
      if (protocolVersion >= 2) {
        const d = action.duration || 0;
        bytes.push(SS_QMK_PREFIX);
        bytes.push(SS_DELAY_CODE);
        bytes.push((d % 255) + 1);
        bytes.push(Math.floor(d / 255) + 1);
      }
    } else { // tap, down, up
      const keycodes = action.keycodes || [];
      const actType = action.action;
      for (const k of keycodes) {
        const kc = keyToQmkCode(k);
        if (protocolVersion >= 2) {
          bytes.push(SS_QMK_PREFIX);
          if (kc < 256) {
            bytes.push(actType === 'tap' ? SS_TAP_CODE : actType === 'down' ? SS_DOWN_CODE : SS_UP_CODE);
            bytes.push(kc);
          } else {
            bytes.push(actType === 'tap' ? VIAL_MACRO_EXT_TAP : actType === 'down' ? VIAL_MACRO_EXT_DOWN : VIAL_MACRO_EXT_UP);
            let encodedKc = kc;
            if (encodedKc % 256 === 0) {
              encodedKc = 0xFF00 | (encodedKc >> 8);
            }
            bytes.push(encodedKc & 0xFF);
            bytes.push((encodedKc >> 8) & 0xFF);
          }
        } else {
          if (kc < 256) {
            bytes.push(actType === 'tap' ? SS_TAP_CODE : actType === 'down' ? SS_DOWN_CODE : SS_UP_CODE);
            bytes.push(kc);
          }
        }
      }
    }
  }
  
  return new Uint8Array(bytes);
}

function qmkCodeToKey(kc: number): string {
  for (const [key, entry] of Object.entries(KEY_MAP)) {
    if (entry.hid === kc) {
      return key;
    }
  }
  return `0x${kc.toString(16).toUpperCase()}`;
}

function keyToQmkCode(key: string): number {
  if (key.startsWith('0x')) {
    return parseInt(key.slice(2), 16);
  }
  return KEY_MAP[key as UniversalKey]?.hid ?? 0;
}
