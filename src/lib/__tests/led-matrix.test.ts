import { beforeEach, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { useKeyboardStore } from '../store';
import { generateKiCadZip, getKiCadExportWarnings } from '../kicad';
import { generateQmkZip } from '../qmk';
import { generateVialZip } from '../vial';
import { getKeyLabel } from '../canvas-utils';
import { fromSmidrProjectFile, toSmidrProjectFileV05 } from '../project-format';
import type { PhysicalKey, ProjectSettings } from '@/types/keyboard';

const key = (id: string, col: number, extras: Partial<PhysicalKey> = {}) => ({
  id, row: 0, col, x: col, y: 0, w: 1, h: 1, r: 0, rx: col, ry: 0, label: id, ...extras,
});
let settings: ProjectSettings;
beforeEach(() => {
  settings = {
    ...useKeyboardStore.getState().settings,
    name: 'LED Board', firmwareTarget: 'qmk',
    matrix: { rows: 1, cols: 4, wiring: 'matrix' },
    hardware: { controllerType: 'mcu', mcu: 'RP2040', board: '', diodeDirection: 'COL2ROW', bootloader: 'rp2040' },
    pins: { rows: ['GP0'], cols: ['GP1', 'GP2', 'GP3', 'GP4'], rgb: 'GP5', backlight: 'GP6' },
    features: { rgb: true, backlight: true, rgbMatrix: true, oled: false, encoder: false, via: true, split: false },
    encoders: [], trackballs: [], layers: 1, macros: [], combos: [], tapDances: [],
    activeOptions: {}, layoutOptions: {},
  };
  useKeyboardStore.setState({ settings, keys: [], appMode: 'design', previewKeys: null });
});

describe('hardware LEDs and firmware Matrix separation', () => {
  it('disabling and clearing Matrix preserve hardware numbers, save data and undo', () => {
    const keys = [key('rgb', 0, { backlight: 'rgb', ledIndex: 7, ledX: 22, ledY: 32, ledFlags: 4 })];
    useKeyboardStore.setState({ keys });
    useKeyboardStore.getState().updateSettings({ features: { ...settings.features, rgbMatrix: false } });
    const disabled = useKeyboardStore.getState();
    expect(disabled.keys[0]).toMatchObject({ backlight: 'rgb', ledIndex: 7 });
    expect(disabled.keys[0].ledX).toBeUndefined();
    expect(disabled.keys[0].ledY).toBeUndefined();
    expect(disabled.keys[0].ledFlags).toBeUndefined();
    expect(getKeyLabel(disabled.keys[0], 'rgbMatrix', 0, 'design', undefined, undefined, disabled.settings)).toEqual({ type: 'empty' });
    const saved = JSON.parse(JSON.stringify(toSmidrProjectFileV05({ ...disabled.settings, keys: disabled.keys, id: 'led', updatedAt: 1 })));
    expect(fromSmidrProjectFile(saved).keys[0]).toMatchObject({ backlight: 'rgb', ledIndex: 7 });
    useKeyboardStore.getState().undo();
    expect(useKeyboardStore.getState().keys[0]).toMatchObject({ ledIndex: 7, ledX: 22, ledY: 32, ledFlags: 4 });
    useKeyboardStore.getState().clearRgbMatrix();
    expect(useKeyboardStore.getState().keys[0]).toMatchObject({ ledIndex: 7, backlight: 'rgb' });
    expect(useKeyboardStore.getState().keys[0].ledX).toBeUndefined();
  });

  it('auto-places only visible RGB keys without renumbering and cannot re-enable Matrix', () => {
    useKeyboardStore.setState({ keys: [
      key('rgb', 0, { backlight: 'rgb', ledIndex: 7 }),
      key('single', 1, { backlight: 'single' }), key('none', 2),
      key('decal', 3, { decal: true, backlight: 'rgb', ledIndex: 8 }),
      key('hidden', 4, { backlight: 'rgb', ledIndex: 9, group: 'thumb', option: 1 }),
    ] });
    useKeyboardStore.getState().autoAssignRgbMatrix();
    const placed = useKeyboardStore.getState().keys;
    expect(placed[0]).toMatchObject({ ledIndex: 7, ledFlags: 4 });
    expect(placed[0].ledX).toBeDefined();
    expect(placed.slice(1).every(item => item.ledX === undefined)).toBe(true);
    useKeyboardStore.getState().updateKey('rgb', { backlight: 'single' });
    expect(useKeyboardStore.getState().keys[0].ledX).toBeUndefined();
    useKeyboardStore.getState().updateSettings({ features: { ...settings.features, rgbMatrix: false } });
    useKeyboardStore.getState().autoAssignRgbMatrix();
    expect(useKeyboardStore.getState().settings.features.rgbMatrix).toBe(false);
    expect(useKeyboardStore.getState().keys.every(item => item.ledX === undefined)).toBe(true);
  });

  it('KiCad follows per-key types identically with Matrix enabled or disabled', async () => {
    const keys = [key('rgb', 0, { backlight: 'rgb', ledIndex: 2 }), key('single', 1, { backlight: 'single' }),
      key('none', 2, { backlight: 'none', ledIndex: 0 }), key('decal', 3, { decal: true, backlight: 'rgb', ledIndex: 3 })];
    const on = await JSZip.loadAsync(await (await generateKiCadZip({ settings, keys })).arrayBuffer());
    const off = await JSZip.loadAsync(await (await generateKiCadZip({ settings: { ...settings, features: { ...settings.features, rgbMatrix: false, backlight: false, rgb: false } }, keys })).arrayBuffer());
    for (const suffix of ['kicad_pcb', 'kicad_sch']) {
      expect(await off.file(`led_board.${suffix}`)!.async('string')).toBe(await on.file(`led_board.${suffix}`)!.async('string'));
    }
    const pcb = await off.file('led_board.kicad_pcb')!.async('string');
    expect(pcb.match(/\(footprint "Smidr:LED_Smidr_SK6812MINI_E"/g)).toHaveLength(1);
    expect(pcb.match(/\(footprint "Smidr:LED_Smidr_Backlight"/g)).toHaveLength(1);
    expect(pcb).toContain('"RGB3"');
    expect(pcb).not.toContain('"RGB1"');
  });

  it('rejects unnumbered or duplicate hardware LEDs instead of omitting them', async () => {
    for (const keys of [[key('rgb', 0, { backlight: 'rgb' })], [key('a', 0, { backlight: 'rgb', ledIndex: 0 }), key('b', 1, { backlight: 'rgb', ledIndex: 0 })]]) {
      expect(getKiCadExportWarnings({ settings, keys })).toEqual(['rgbLedNumbersInvalid']);
      await expect(generateKiCadZip({ settings, keys })).rejects.toThrow('unique RGB LED number');
    }
  });

  it.each([['QMK', generateQmkZip], ['Vial', generateVialZip]] as const)('%s uses hardware numbers and only RGB Matrix placements', async (_name, generate) => {
    const keys = [key('rgb', 0, { backlight: 'rgb', ledIndex: 2, ledX: 80, ledY: 32, ledFlags: 4 }),
      key('single', 1, { backlight: 'single', ledIndex: 9, ledX: 100, ledY: 30 }),
      key('unplaced', 2, { backlight: 'rgb', ledIndex: 3 })];
    for (const enabled of [true, false]) {
      const blob = await generate({ settings: { ...settings, features: { ...settings.features, rgbMatrix: enabled } }, keys });
      if (!blob) throw new Error('Expected a firmware ZIP');
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const keyboard = JSON.parse(await zip.file('led_board/keyboard.json')!.async('string'));
      expect(keyboard.features.rgb_matrix).toBe(enabled);
      const source = (await Promise.all(zip.file(/keymap\.c$/).map(file => file.async('string')))).join('\n');
      const config = await zip.file('led_board/config.h')!.async('string');
      expect(source.includes('g_led_config')).toBe(enabled);
      expect(source.includes('{ 80, 32 }')).toBe(enabled);
      expect(source).not.toContain('{ 100, 30 }');
      if (enabled) {
        expect(config).toContain('#define RGB_MATRIX_LED_COUNT 4');
        expect(source).toContain('0, 0, 4, 0');
      } else expect(config).not.toContain('#define RGB_MATRIX_LED_COUNT');
    }
  });
});
