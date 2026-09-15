import { UniversalAction, UniversalKey } from '@/types/actions';
import { FirmwareTarget } from '@/types/keyboard';
import { KEYCODES } from '@/lib/keycodes';

export type KeycodeSupportTarget = FirmwareTarget | 'via';
export type ConnectedKeycodeProtocol = 'via' | 'vial' | 'zmk';

export interface KeycodeSupportStatus {
  supported: boolean;
  reason?: string;
}

const QMK_LIGHTING_KEYS = [
  'UG_TOGG', 'UG_NEXT', 'UG_PREV', 'UG_VALU', 'UG_VALD', 'UG_HUEU', 'UG_HUED', 'UG_SATU', 'UG_SATD', 'UG_SPDU', 'UG_SPDD',
  'BL_ON', 'BL_OFF', 'BL_TOGG', 'BL_DOWN', 'BL_UP', 'BL_STEP', 'BL_BRTG',
  'LM_ON', 'LM_OFF', 'LM_TOGG', 'LM_NEXT', 'LM_PREV', 'LM_BRIU', 'LM_BRID', 'LM_SPDU', 'LM_SPDD', 'LM_FLGN', 'LM_FLGP',
  'RM_ON', 'RM_OFF', 'RM_TOGG', 'RM_NEXT', 'RM_PREV', 'RM_HUEU', 'RM_HUED', 'RM_SATU', 'RM_SATD', 'RM_VALU', 'RM_VALD', 'RM_SPDU', 'RM_SPDD', 'RM_FLGN', 'RM_FLGP',
] as const;

const ZMK_LIGHTING_KEYS = [
  'UG_TOGG', 'UG_NEXT', 'UG_PREV', 'UG_VALU', 'UG_VALD', 'UG_HUEU', 'UG_HUED', 'UG_SATU', 'UG_SATD', 'UG_SPDU', 'UG_SPDD',
  'BL_ON', 'BL_OFF', 'BL_TOGG', 'BL_DOWN', 'BL_UP', 'BL_STEP',
] as const;

const POINTER_KEYS = [
  'MOUSE_UP', 'MOUSE_DOWN', 'MOUSE_LEFT', 'MOUSE_RIGHT',
  'MOUSE_BTN1', 'MOUSE_BTN2', 'MOUSE_BTN3', 'MOUSE_BTN4', 'MOUSE_BTN5',
  'MOUSE_WHEEL_UP', 'MOUSE_WHEEL_DOWN', 'MOUSE_WHEEL_LEFT', 'MOUSE_WHEEL_RIGHT',
  'MOUSE_ACCEL0', 'MOUSE_ACCEL1', 'MOUSE_ACCEL2',
] as const;

const FIRMWARE_CONTROL_KEYS = ['BOOTLOADER', 'SYSTEM_RESET'] as const;
const UNIVERSAL_BEHAVIOR_KEYS = ['CAPS_WORD', 'KEY_REPEAT'] as const;
const QMK_ZMK_BEHAVIOR_KEYS = ['GRAVE_ESCAPE', 'OUTPUT_USB', 'OUTPUT_BLUETOOTH'] as const;
const ZMK_ONLY_BEHAVIOR_KEYS = ['STUDIO_UNLOCK'] as const;
const QMK_ZMK_SYSTEM_HID_KEYS = ['PWR', 'SLEEP', 'WAKE'] as const;

const ZMK_POINTER_KEYS = POINTER_KEYS.filter(code => !code.startsWith('MOUSE_ACCEL'));
const RMK_POINTER_KEYS = POINTER_KEYS.filter(code =>
  !code.startsWith('MOUSE_WHEEL') && !code.startsWith('MOUSE_ACCEL')
);

const TARGET_SPECIFIC_KEYS = new Set<string>([
  ...QMK_LIGHTING_KEYS,
  ...POINTER_KEYS,
  ...FIRMWARE_CONTROL_KEYS,
  ...UNIVERSAL_BEHAVIOR_KEYS,
  ...QMK_ZMK_BEHAVIOR_KEYS,
  ...ZMK_ONLY_BEHAVIOR_KEYS,
  ...QMK_ZMK_SYSTEM_HID_KEYS,
]);

const CORE_KEYCODES = new Set<string>([
  ...KEYCODES
    .map(keycode => keycode.code)
    .filter(code => !TARGET_SPECIFIC_KEYS.has(code)),
  'TRNS',
  'NO',
]);

const TARGET_KEYCODE_CATALOG: Record<KeycodeSupportTarget, ReadonlySet<string>> = {
  qmk: new Set([...CORE_KEYCODES, ...QMK_LIGHTING_KEYS, ...POINTER_KEYS, ...FIRMWARE_CONTROL_KEYS, ...UNIVERSAL_BEHAVIOR_KEYS, ...QMK_ZMK_BEHAVIOR_KEYS, ...QMK_ZMK_SYSTEM_HID_KEYS]),
  via: new Set([...CORE_KEYCODES, ...QMK_LIGHTING_KEYS, ...POINTER_KEYS, ...FIRMWARE_CONTROL_KEYS, ...UNIVERSAL_BEHAVIOR_KEYS, ...QMK_ZMK_BEHAVIOR_KEYS, ...QMK_ZMK_SYSTEM_HID_KEYS]),
  vial: new Set([...CORE_KEYCODES, ...QMK_LIGHTING_KEYS, ...POINTER_KEYS, ...FIRMWARE_CONTROL_KEYS, ...UNIVERSAL_BEHAVIOR_KEYS, ...QMK_ZMK_BEHAVIOR_KEYS, ...QMK_ZMK_SYSTEM_HID_KEYS]),
  zmk: new Set([...CORE_KEYCODES, ...ZMK_LIGHTING_KEYS, ...ZMK_POINTER_KEYS, ...FIRMWARE_CONTROL_KEYS, ...UNIVERSAL_BEHAVIOR_KEYS, ...QMK_ZMK_BEHAVIOR_KEYS, ...ZMK_ONLY_BEHAVIOR_KEYS, ...QMK_ZMK_SYSTEM_HID_KEYS]),
  rmk: new Set([...CORE_KEYCODES, ...RMK_POINTER_KEYS, ...FIRMWARE_CONTROL_KEYS, ...UNIVERSAL_BEHAVIOR_KEYS]),
};

const isLayerKey = (code: string) => /^(MO|TG|TO|LT)\(\d+\)$/.test(code);
const isMacroKey = (code: string) => /^MACRO_\d+$/.test(code);
const isTapDanceKey = (code: string) => /^TD_\d+$/.test(code);

export function resolveKeycodeSupportTarget({
  appMode,
  connectedProtocol,
  firmwareTarget,
}: {
  appMode: 'design' | 'remap';
  connectedProtocol?: ConnectedKeycodeProtocol;
  firmwareTarget?: FirmwareTarget | null;
}): KeycodeSupportTarget | null {
  if (appMode === 'remap') return connectedProtocol ?? null;
  return firmwareTarget ?? null;
}

export function getKeycodeSupport(
  code: string,
  target: KeycodeSupportTarget | null
): KeycodeSupportStatus {
  if (!target) return { supported: false, reason: 'Keymap target is not selected' };

  if (isLayerKey(code)) return { supported: true };
  if (isMacroKey(code) || isTapDanceKey(code)) {
    return target === 'rmk'
      ? { supported: false, reason: 'RMK definition export is not available' }
      : { supported: true };
  }

  return TARGET_KEYCODE_CATALOG[target].has(code)
    ? { supported: true }
    : { supported: false, reason: `${target.toUpperCase()} unsupported` };
}

const CUSTOM_PROTOCOLS_BY_TARGET: Record<KeycodeSupportTarget, ReadonlySet<string>> = {
  qmk: new Set(['qmk']),
  via: new Set(['qmk', 'via']),
  vial: new Set(['qmk', 'via', 'vial']),
  zmk: new Set(['zmk']),
  rmk: new Set(['rmk']),
};

export function getActionSupport(
  action: UniversalAction,
  target: KeycodeSupportTarget | null
): KeycodeSupportStatus {
  if (!target) return { supported: false, reason: 'Keymap target is not selected' };

  switch (action.action) {
    case 'tap':
      return getKeycodeSupport(action.keycode, target);
    case 'lt':
    case 'mt':
      return getActionSupport(action.tapAction, target);
    case 'macro':
      return getKeycodeSupport(`MACRO_${action.macroId}`, target);
    case 'td':
      return getKeycodeSupport(`TD_${action.tapDanceId}`, target);
    case 'custom':
      return CUSTOM_PROTOCOLS_BY_TARGET[target].has(action.protocol)
        ? { supported: true }
        : { supported: false, reason: `${action.protocol.toUpperCase()} raw action does not match ${target.toUpperCase()}` };
    default:
      return { supported: true };
  }
}

export function isUniversalKeycode(code: string): code is UniversalKey {
  return code !== 'transparent' &&
    code !== 'none' &&
    code !== 'any' &&
    !isLayerKey(code) &&
    !isMacroKey(code) &&
    !isTapDanceKey(code);
}
