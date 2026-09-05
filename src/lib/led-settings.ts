import type { PhysicalKey } from '@/types/keyboard';

export const isRgbLedKey = (key: PhysicalKey) => !key.decal && key.backlight === 'rgb';
export const hasLedNumber = (key: PhysicalKey) => Number.isInteger(key.ledIndex) && key.ledIndex! >= 0 && key.ledIndex! < 1000;
export const hasRgbMatrixPosition = (key: PhysicalKey) => isRgbLedKey(key)
  && Number.isInteger(key.ledX) && key.ledX! >= 0 && key.ledX! <= 224
  && Number.isInteger(key.ledY) && key.ledY! >= 0 && key.ledY! <= 64;

export const clearRgbMatrixPosition = <T extends PhysicalKey>(key: T): T => {
  if (key.ledX === undefined && key.ledY === undefined && key.ledFlags === undefined) return key;
  const { ledX: _x, ledY: _y, ledFlags: _flags, ...rest } = key;
  return rest as T;
};

export const hasInvalidRgbLedNumbers = (keys: PhysicalKey[]) => {
  const rgbKeys = keys.filter(isRgbLedKey);
  return rgbKeys.some(key => !hasLedNumber(key)) || new Set(rgbKeys.map(key => key.ledIndex)).size !== rgbKeys.length;
};
