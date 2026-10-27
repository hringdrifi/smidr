import { ComboEntry, MacroAction, UniversalAction } from '@/types/actions';
import { PhysicalKey } from '@/types/keyboard';
import { actionToQmkSourceString } from './macro-codegen';
import { actionToQmkString } from './protocols/via-action-converter';
import { actionToZmkSourceStringWithMacros } from './macro-codegen';
import { actionToZmkString } from './protocols/zmk-action-converter';

const isRealCombo = (combo: ComboEntry | undefined) => (
  !!combo && combo.inputs.some(input => input.action !== 'none') && combo.output.action !== 'none'
);

const comboInputToQmk = (action: UniversalAction) => (
  action.action === 'tap' ? actionToQmkString(action) : 'KC_NO'
);

export const generateQmkComboC = (combos: ComboEntry[] = [], macros: MacroAction[][] = []) => {
  const entries = combos
    .map((combo, id) => ({ combo, id }))
    .filter(({ combo }) => isRealCombo(combo));

  if (entries.length === 0) return '';

  const arrays = entries.map(({ combo, id }) => {
    const inputs = combo.inputs
      .map(comboInputToQmk)
      .filter(key => key !== 'KC_NO');
    return `const uint16_t PROGMEM smidr_combo_${id}[] = { ${inputs.join(', ')}, COMBO_END };`;
  });

  const table = entries.map(({ combo, id }) => (
    `    COMBO(smidr_combo_${id}, ${actionToQmkSourceString(combo.output, macros)}),`
  ));

  return `${arrays.join('\n')}

combo_t key_combos[] = {
${table.join('\n')}
};

`;
};

export const hasConfiguredCombos = (combos: ComboEntry[] = []) => combos.some(isRealCombo);

const actionKey = (action: UniversalAction) => (
  action.action === 'tap' ? action.keycode : null
);

export const generateZmkComboBehaviors = (
  combos: ComboEntry[] = [],
  sortedKeys: PhysicalKey[] = [],
  macros: MacroAction[][] = [],
) => {
  const entries = combos
    .map((combo, id) => ({ combo, id }))
    .filter(({ combo }) => isRealCombo(combo));

  if (entries.length === 0) return '';

  const positionByKey = new Map<string, number[]>();
  sortedKeys.forEach((key, index) => {
    Object.values(key.keymap || {}).forEach(action => {
      const keycode = actionKey(action);
      if (!keycode) return;
      const positions = positionByKey.get(keycode) || [];
      positions.push(index);
      positionByKey.set(keycode, positions);
    });
  });

  const comboDefs = entries.map(({ combo, id }) => {
    const keyPositions = combo.inputs
      .map(actionKey)
      .filter((keycode): keycode is NonNullable<ReturnType<typeof actionKey>> => !!keycode)
      .map(keycode => positionByKey.get(keycode)?.[0])
      .filter((position): position is number => Number.isInteger(position));

    const binding = combo.output.action === 'td'
      ? actionToZmkString(combo.output)
      : actionToZmkSourceStringWithMacros(combo.output, macros);

    return `        smidr_combo_${id} {
            timeout-ms = <50>;
            key-positions = <${keyPositions.join(' ')}>;
            bindings = <${binding}>;
        };`;
  });

  return `    combos {
        compatible = "zmk,combos";
${comboDefs.join('\n\n')}
    };

`;
};
