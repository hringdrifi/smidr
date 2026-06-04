import { UniversalKey } from '@/types/actions';

export type KeycodeSupportTarget = 'all' | 'via' | 'vial' | 'zmk';

export interface KeycodeSupportStatus {
  supported: boolean;
  reason?: string;
}

const ZMK_UNSUPPORTED_KEYS = new Set<string>([
  'BL_BRTG',
]);

const ZMK_UNSUPPORTED_PREFIXES = [
  'LM_',
  'RM_',
];

const isLayerKey = (code: string) => /^(MO|TG|TO|LT)\(\d+\)$/.test(code);
const isMacroKey = (code: string) => /^MACRO_\d+$/.test(code);
const isTapDanceKey = (code: string) => /^TD_\d+$/.test(code);

const isZmkUnsupportedKey = (code: string) => (
  ZMK_UNSUPPORTED_KEYS.has(code) ||
  ZMK_UNSUPPORTED_PREFIXES.some(prefix => code.startsWith(prefix))
);

export function getKeycodeSupport(
  code: string,
  target: KeycodeSupportTarget
): KeycodeSupportStatus {
  if (target === 'all') return { supported: true };

  if (target === 'zmk') {
    if (isZmkUnsupportedKey(code)) {
      return { supported: false, reason: 'ZMK unsupported' };
    }
    return { supported: true };
  }

  if (target === 'via' || target === 'vial') {
    return { supported: true };
  }

  return { supported: true };
}

export function isUniversalKeycode(code: string): code is UniversalKey {
  return code !== 'transparent' &&
    code !== 'none' &&
    code !== 'any' &&
    !isLayerKey(code) &&
    !isMacroKey(code) &&
    !isTapDanceKey(code);
}
