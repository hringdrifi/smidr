import type { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getDevelopmentBoardPins, getMcuPins } from './mcu-presets';
import { getActiveSplitPins } from './split-communication';
import { resolveDirectPin } from './matrix-utils';

/** All layout keys with LEDs require the corresponding valid hardware pin. */
export const hasMissingLedPins = (settings: ProjectSettings, keys: PhysicalKey[]): boolean => {
  const { features } = normalizeSpecialPinFeatures(settings, keys);
  return keys.some(key => !key.decal && (
    (key.backlight === 'rgb' && !features.rgb)
    || (key.backlight === 'single' && !features.backlight)
  ));
};

/** Special features follow valid, unoccupied GPIO assignments. */
export const normalizeSpecialPinFeatures = (settings: ProjectSettings, keys: PhysicalKey[] = []): ProjectSettings => {
  const { pins } = settings;
  const available = new Set((settings.hardware.controllerType || 'development_board') === 'development_board'
    ? getDevelopmentBoardPins(settings.hardware.board, settings.hardware.mcu)
    : getMcuPins(settings.hardware.mcu));
  const matrixPins = settings.matrix.wiring === 'direct'
    ? [...(pins.direct || []), ...(settings.features.split ? pins.splitDirect || [] : []),
        ...keys.filter(key => !key.decal).map(key => resolveDirectPin(settings, key, keys))]
    : [...pins.rows, ...pins.cols, ...(settings.features.split ? [...(pins.splitRows || []), ...(pins.splitCols || [])] : [])];
  const occupied = new Set([
    ...matrixPins,
    ...getActiveSplitPins(settings),
    ...(settings.encoders || []).flatMap(encoder => [encoder.pinA, encoder.pinB]),
    ...(settings.trackballs || []).flatMap(ball => [ball.sclk, ball.sdio, ball.cs, ball.motion]),
  ].filter(Boolean));
  const specialPins = [pins.rgb, pins.backlight, pins.sda, pins.scl];
  const valid = (pin: string | undefined) => !!pin && available.has(pin) && !occupied.has(pin)
    && specialPins.filter(value => value === pin).length === 1;
  const rgb = valid(pins.rgb);
  const backlight = valid(pins.backlight);
  const oled = valid(pins.sda) && valid(pins.scl);
  if (settings.features.rgb === rgb && settings.features.backlight === backlight && settings.features.oled === oled) return settings;
  return { ...settings, features: { ...settings.features, rgb, backlight, oled } };
};
