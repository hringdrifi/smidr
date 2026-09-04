import { UniversalKey } from '@/types/actions';
import { FirmwareTarget } from '@/types/keyboard';

export type KeycodeSupportTarget = 'all' | 'qmk' | 'via' | 'vial' | 'zmk' | 'rmk';
export type ConnectedKeycodeProtocol = 'via' | 'vial' | 'zmk';

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

export function resolveKeycodeSupportTarget({
  appMode,
  connectedProtocol,
  firmwareTarget,
}: {
  appMode: 'design' | 'remap';
  connectedProtocol?: ConnectedKeycodeProtocol;
  firmwareTarget?: FirmwareTarget | null;
}): KeycodeSupportTarget {
  if (appMode === 'remap') return connectedProtocol ?? 'all';
  return firmwareTarget ?? 'all';
}

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

  if (target === 'qmk' || target === 'via' || target === 'vial' || target === 'rmk') {
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
