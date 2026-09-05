import { beforeEach, describe, expect, it } from 'vitest';
import { useKeyboardStore } from '../store';
import { hasMissingLedPins, normalizeSpecialPinFeatures } from '../special-pins';
import type { PhysicalKey, ProjectSettings } from '@/types/keyboard';

let settings: ProjectSettings;
beforeEach(() => {
  settings = {
    ...useKeyboardStore.getState().settings,
    hardware: { controllerType: 'mcu', mcu: 'RP2040', board: '', diodeDirection: 'COL2ROW' },
    matrix: { wiring: 'matrix', rows: 1, cols: 1 },
    pins: { rows: ['GP0'], cols: ['GP1'] },
    features: { rgb: false, backlight: false, oled: false, split: false, via: true, encoder: false },
    encoders: [], trackballs: [],
  };
  useKeyboardStore.setState({ settings, keys: [], appMode: 'design', previewKeys: null });
});

describe('automatic special-pin features', () => {
  it('requires each LED type to have a valid pin and clears the warning when corrected', () => {
    const key: PhysicalKey = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' };
    const rgb = { ...key, backlight: 'rgb' as const };
    const single = { ...key, backlight: 'single' as const };
    expect(hasMissingLedPins(settings, [rgb])).toBe(true);
    expect(hasMissingLedPins(settings, [single])).toBe(true);
    const rgbOnly = { ...settings, pins: { ...settings.pins, rgb: 'GP2' } };
    expect(hasMissingLedPins(rgbOnly, [rgb])).toBe(false);
    expect(hasMissingLedPins(rgbOnly, [rgb, single])).toBe(true);
    const both = { ...rgbOnly, pins: { ...rgbOnly.pins, backlight: 'GP3' } };
    expect(hasMissingLedPins(both, [rgb, single])).toBe(false);
    for (const invalid of ['', 'GP99', 'GP0', 'GP3']) {
      expect(hasMissingLedPins({ ...both, pins: { ...both.pins, rgb: invalid } }, [rgb, single])).toBe(true);
    }
  });

  it('ignores keys without LEDs and decals, but checks every layout option', () => {
    const key: PhysicalKey = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' };
    expect(hasMissingLedPins(settings, [])).toBe(false);
    expect(hasMissingLedPins(settings, [key, { ...key, backlight: 'none' }, { ...key, decal: true, backlight: 'rgb' }])).toBe(false);
    expect(hasMissingLedPins(settings, [{ ...key, group: 'thumb', option: 1, backlight: 'rgb' }])).toBe(true);
  });

  it('enables assigned pins, requires both OLED pins, and disables cleared pins with undo support', () => {
    const { setPin } = useKeyboardStore.getState();
    setPin('feature', 'rgb', 'GP2');
    setPin('feature', 'backlight', 'GP3');
    setPin('feature', 'sda', 'GP4');
    expect(useKeyboardStore.getState().settings.features).toMatchObject({ rgb: true, backlight: true, oled: false });
    setPin('feature', 'scl', 'GP5');
    expect(useKeyboardStore.getState().settings.features.oled).toBe(true);
    setPin('feature', 'sda', '');
    expect(useKeyboardStore.getState().settings.features.oled).toBe(false);
    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().settings.features.oled).toBe(true);
    setPin('feature', 'rgb', '');
    expect(useKeyboardStore.getState().settings.features.rgb).toBe(false);
  });

  it('rejects missing, unknown, duplicate, and occupied GPIOs', () => {
    for (const rgb of [undefined, '', 'GP99', 'GP0', 'GP1']) {
      expect(normalizeSpecialPinFeatures({ ...settings, pins: { ...settings.pins, rgb } }).features.rgb).toBe(false);
    }
    const duplicate = normalizeSpecialPinFeatures({ ...settings, pins: { ...settings.pins, rgb: 'GP2', backlight: 'GP2', sda: 'GP3', scl: 'GP3' } });
    expect(duplicate.features).toMatchObject({ rgb: false, backlight: false, oled: false });
    const rgbSettings = { ...settings, pins: { ...settings.pins, rgb: 'GP2' } };
    expect(normalizeSpecialPinFeatures({ ...rgbSettings, encoders: [{ pinA: 'GP2', pinB: 'GP3' }] }).features.rgb).toBe(false);
    expect(normalizeSpecialPinFeatures({ ...rgbSettings, trackballs: [{ cs: 'GP2' }] }).features.rgb).toBe(false);
    expect(normalizeSpecialPinFeatures({ ...rgbSettings, features: { ...settings.features, split: true }, pins: { ...rgbSettings.pins, splitSerial: 'GP2' } }).features.rgb).toBe(false);
    expect(normalizeSpecialPinFeatures({ ...rgbSettings, matrix: { ...settings.matrix, wiring: 'direct' }, pins: { ...rgbSettings.pins, direct: ['GP2'] } }).features.rgb).toBe(false);
  });

  it('rechecks assignments when hardware and other pin uses change', () => {
    const { setPin, updateSettings } = useKeyboardStore.getState();
    setPin('feature', 'rgb', 'GP2');
    updateSettings({ hardware: { ...settings.hardware, mcu: 'ATmega32U4' } });
    expect(useKeyboardStore.getState().settings.features.rgb).toBe(false);
    updateSettings({ hardware: settings.hardware });
    expect(useKeyboardStore.getState().settings.features.rgb).toBe(true);
    setPin('row', 0, 'GP2');
    expect(useKeyboardStore.getState().settings.features.rgb).toBe(false);
  });

  it('recalculates legacy flags when loading a project', () => {
    useKeyboardStore.getState().loadProject({ ...settings, id: 'special-pins', updatedAt: 1, keys: [], pins: { ...settings.pins, rgb: 'GP2' }, features: { ...settings.features, backlight: true, oled: true } });
    expect(useKeyboardStore.getState().settings.features).toMatchObject({ rgb: true, backlight: false, oled: false });
  });
});
