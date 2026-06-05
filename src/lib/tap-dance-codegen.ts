import { TapDanceEntry, UniversalAction } from '@/types/actions';
import { actionToQmkString } from './protocols/via-action-converter';
import { actionToZmkString } from './protocols/zmk-action-converter';

const isRealAction = (action: UniversalAction | undefined) => !!action && action.action !== 'none';

const tapDanceActionToQmkKey = (action: UniversalAction | undefined) => {
  if (!isRealAction(action)) return 'KC_NO';
  const qmk = actionToQmkString(action);
  return qmk.startsWith('TD(') ? 'KC_NO' : qmk;
};

const qmkTapCode = (action: UniversalAction | undefined) => {
  const key = tapDanceActionToQmkKey(action);
  return key === 'KC_NO' ? '' : `            tap_code16(${key});`;
};

const qmkHoldCode = (varName: string, action: UniversalAction | undefined) => {
  const key = tapDanceActionToQmkKey(action);
  if (key === 'KC_NO') return `            ${varName} = KC_NO;`;
  return `            ${varName} = ${key};
            register_code16(${varName});`;
};

export const generateQmkTapDanceC = (tapDances: TapDanceEntry[] = []) => {
  const entries = tapDances
    .filter(entry => isRealAction(entry.tapAction) || isRealAction(entry.holdAction) || isRealAction(entry.doubleTapAction) || isRealAction(entry.tapHoldAction))
    .sort((a, b) => a.id - b.id);

  if (entries.length === 0) return '';

  const functions = entries.map(entry => {
    const id = entry.id;
    const holdVar = `smidr_td_${id}_held`;
    const finished = `smidr_td_${id}_finished`;
    const reset = `smidr_td_${id}_reset`;

    return `static uint16_t ${holdVar} = KC_NO;

void ${finished}(qk_tap_dance_state_t *state, void *user_data) {
    ${holdVar} = KC_NO;
    if (state->count == 1) {
        if (state->pressed) {
${qmkHoldCode(holdVar, entry.holdAction)}
        } else {
${qmkTapCode(entry.tapAction)}
        }
    } else {
        if (state->pressed) {
${qmkHoldCode(holdVar, entry.tapHoldAction)}
        } else {
${qmkTapCode(entry.doubleTapAction)}
        }
    }
}

void ${reset}(qk_tap_dance_state_t *state, void *user_data) {
    if (${holdVar} != KC_NO) {
        unregister_code16(${holdVar});
        ${holdVar} = KC_NO;
    }
}
`;
  }).join('\n');

  const tableEntries = entries.map(entry => (
    `    [${entry.id}] = ACTION_TAP_DANCE_FN_ADVANCED_TIME(NULL, smidr_td_${entry.id}_finished, smidr_td_${entry.id}_reset, ${entry.tappingTerm ?? 200}),`
  ));

  return `
${functions}
tap_dance_action_t tap_dance_actions[] = {
${tableEntries.join('\n')}
};

`;
};

type ZmkBinding = {
  behavior: string;
  params: string[];
};

const parseZmkBinding = (binding: string): ZmkBinding => {
  const parts = binding.trim().split(/\s+/).filter(Boolean);
  return {
    behavior: parts[0] || '&none',
    params: parts.slice(1),
  };
};

const canUseHoldTapBinding = (binding: ZmkBinding) => binding.params.length <= 1;

const zmkParam = (binding: ZmkBinding) => binding.params[0] || '0';

const zmkBindingForAction = (action: UniversalAction | undefined) => (
  isRealAction(action) ? actionToZmkString(action) : '&none'
);

const zmkTapDanceSlot = (
  entry: TapDanceEntry,
  count: 1 | 2,
  tapAction: UniversalAction | undefined,
  holdAction: UniversalAction | undefined,
  behaviorDefs: string[],
) => {
  const tapBinding = parseZmkBinding(zmkBindingForAction(tapAction));
  const holdBinding = parseZmkBinding(zmkBindingForAction(holdAction));

  if (!isRealAction(holdAction)) {
    return zmkBindingForAction(tapAction);
  }

  if (!canUseHoldTapBinding(tapBinding) || !canUseHoldTapBinding(holdBinding)) {
    return zmkBindingForAction(tapAction);
  }

  const label = `smidr_td_${entry.id}_${count}_ht`;
  behaviorDefs.push(`        ${label}: ${label} {
            compatible = "zmk,behavior-hold-tap";
            #binding-cells = <2>;
            flavor = "hold-preferred";
            tapping-term-ms = <${entry.tappingTerm ?? 200}>;
            bindings = <${holdBinding.behavior}>, <${tapBinding.behavior}>;
        };`);

  return `&${label} ${zmkParam(holdBinding)} ${zmkParam(tapBinding)}`;
};

export const generateZmkTapDanceBehaviors = (tapDances: TapDanceEntry[] = []) => {
  const entries = tapDances
    .filter(entry => isRealAction(entry.tapAction) || isRealAction(entry.holdAction) || isRealAction(entry.doubleTapAction) || isRealAction(entry.tapHoldAction))
    .sort((a, b) => a.id - b.id);

  if (entries.length === 0) return '';

  const behaviorDefs: string[] = [];
  const tapDanceDefs = entries.map(entry => {
    const first = zmkTapDanceSlot(entry, 1, entry.tapAction, entry.holdAction, behaviorDefs);
    const second = zmkTapDanceSlot(entry, 2, entry.doubleTapAction, entry.tapHoldAction, behaviorDefs);

    return `        smidr_td_${entry.id}: smidr_td_${entry.id} {
            compatible = "zmk,behavior-tap-dance";
            #binding-cells = <0>;
            tapping-term-ms = <${entry.tappingTerm ?? 200}>;
            bindings = <${first}>, <${second}>;
        };`;
  });

  return `    behaviors {
${[...behaviorDefs, ...tapDanceDefs].join('\n\n')}
    };

`;
};

export const actionToZmkSourceString = (action: UniversalAction) => (
  action.action === 'td' ? `&smidr_td_${action.tapDanceId}` : actionToZmkString(action)
);
