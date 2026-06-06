import { MacroAction, UniversalKey, UniversalAction } from '@/types/actions';
import { actionToQmkString } from './protocols/via-action-converter';
import { actionToZmkString } from './protocols/zmk-action-converter';

const hasMacroActions = (actions: MacroAction[] | undefined) => !!actions && actions.length > 0;

export const getConfiguredMacroIds = (macros: MacroAction[][] = []) => (
  macros
    .map((actions, id) => ({ actions, id }))
    .filter(({ actions }) => hasMacroActions(actions))
    .map(({ id }) => id)
);

const escapeCString = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t');

const qmkActionKey = (key: string) => (
  key.startsWith('0x') ? key : actionToQmkString({ action: 'tap', keycode: key as UniversalKey })
);

const generateQmkMacroStatement = (action: MacroAction) => {
  if (action.action === 'text') {
    return `            SEND_STRING("${escapeCString(action.text || '')}");`;
  }

  if (action.action === 'delay') {
    return `            wait_ms(${Math.max(0, Math.round(action.duration || 0))});`;
  }

  const fn = action.action === 'tap'
    ? 'tap_code16'
    : action.action === 'down'
      ? 'register_code16'
      : 'unregister_code16';

  return (action.keycodes || [])
    .map(key => `            ${fn}(${qmkActionKey(key)});`)
    .join('\n');
};

export const generateQmkStaticMacroC = (macros: MacroAction[][] = []) => {
  const ids = getConfiguredMacroIds(macros);
  if (ids.length === 0) return '';

  const enumEntries = ids.map((id, idx) => (
    `    SMIDR_MACRO_${id}${idx === 0 ? ' = SAFE_RANGE' : ''},`
  ));

  const cases = ids.map(id => {
    const statements = macros[id]
      .map(generateQmkMacroStatement)
      .filter(Boolean)
      .join('\n');

    return `        case SMIDR_MACRO_${id}:
            if (record->event.pressed) {
${statements}
            }
            return false;`;
  });

  return `enum smidr_custom_keycodes {
${enumEntries.join('\n')}
};

bool process_record_user(uint16_t keycode, keyrecord_t *record) {
    switch (keycode) {
${cases.join('\n')}
    }
    return true;
}

`;
};

export const actionToQmkSourceString = (action: UniversalAction, macros: MacroAction[][] = []) => (
  action.action === 'macro' && hasMacroActions(macros[action.macroId])
    ? `SMIDR_MACRO_${action.macroId}`
    : actionToQmkString(action)
);

type TextBinding = {
  key: string;
  shifted?: boolean;
};

const textKeyMap: Record<string, TextBinding> = {
  ' ': { key: 'SPACE' },
  '\n': { key: 'RET' },
  '\t': { key: 'TAB' },
  '-': { key: 'MINUS' },
  '_': { key: 'MINUS', shifted: true },
  '=': { key: 'EQUAL' },
  '+': { key: 'EQUAL', shifted: true },
  '[': { key: 'LBKT' },
  '{': { key: 'LBKT', shifted: true },
  ']': { key: 'RBKT' },
  '}': { key: 'RBKT', shifted: true },
  '\\': { key: 'BSLH' },
  '|': { key: 'BSLH', shifted: true },
  ';': { key: 'SEMI' },
  ':': { key: 'SEMI', shifted: true },
  "'": { key: 'SQT' },
  '"': { key: 'SQT', shifted: true },
  ',': { key: 'COMMA' },
  '<': { key: 'COMMA', shifted: true },
  '.': { key: 'DOT' },
  '>': { key: 'DOT', shifted: true },
  '/': { key: 'FSLH' },
  '?': { key: 'FSLH', shifted: true },
  '`': { key: 'GRAV' },
  '~': { key: 'GRAV', shifted: true },
  '!': { key: 'N1', shifted: true },
  '@': { key: 'N2', shifted: true },
  '#': { key: 'N3', shifted: true },
  '$': { key: 'N4', shifted: true },
  '%': { key: 'N5', shifted: true },
  '^': { key: 'N6', shifted: true },
  '&': { key: 'N7', shifted: true },
  '*': { key: 'N8', shifted: true },
  '(': { key: 'N9', shifted: true },
  ')': { key: 'N0', shifted: true },
};

const zmkBindingForTextChar = (char: string) => {
  if (/^[a-z]$/.test(char)) return `&kp ${char.toUpperCase()}`;
  if (/^[A-Z]$/.test(char)) {
    return `&macro_press &kp LSHIFT>, <&macro_tap &kp ${char}>, <&macro_release &kp LSHIFT`;
  }
  if (/^[0-9]$/.test(char)) return `&kp N${char}`;
  const mapped = textKeyMap[char];
  if (!mapped) return null;
  if (!mapped.shifted) return `&kp ${mapped.key}`;
  return `&macro_press &kp LSHIFT>, <&macro_tap &kp ${mapped.key}>, <&macro_release &kp LSHIFT`;
};

const zmkBindingsForAction = (action: MacroAction) => {
  if (action.action === 'text') {
    return [...(action.text || '')]
      .map(zmkBindingForTextChar)
      .filter((binding): binding is string => !!binding);
  }

  if (action.action === 'delay') {
    return [`&macro_wait_time ${Math.max(0, Math.round(action.duration || 0))}`];
  }

  const prefix = action.action === 'tap'
    ? '&macro_tap'
    : action.action === 'down'
      ? '&macro_press'
      : '&macro_release';

  return (action.keycodes || [])
    .map(key => actionToZmkString({ action: 'tap', keycode: key as UniversalKey }))
    .map(binding => `${prefix} ${binding}`);
};

export const generateZmkMacroBehaviors = (macros: MacroAction[][] = []) => {
  const ids = getConfiguredMacroIds(macros);
  if (ids.length === 0) return '';

  const macroDefs = ids.map(id => {
    const bindings = macros[id]
      .flatMap(zmkBindingsForAction)
      .filter(Boolean);

    return `        smidr_macro_${id}: smidr_macro_${id} {
            compatible = "zmk,behavior-macro";
            #binding-cells = <0>;
            wait-ms = <40>;
            tap-ms = <40>;
            bindings = <${bindings.join('>, <')}>;
        };`;
  });

  return `    macros {
${macroDefs.join('\n\n')}
    };

`;
};

export const actionToZmkSourceStringWithMacros = (action: UniversalAction, macros: MacroAction[][] = []) => (
  action.action === 'macro' && hasMacroActions(macros[action.macroId])
    ? `&smidr_macro_${action.macroId}`
    : actionToZmkString(action)
);
