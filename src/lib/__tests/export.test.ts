import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateViaJson } from '../export';
import { generateQmkZip } from '../qmk';
import { generateVialZip } from '../vial';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

const baseSettings: ProjectSettings = {
  name: 'Test Keyboard',
  manufacturer: 'Test',
  description: '',
  vendorProductId: 0xFEED0001,
  matrix: { rows: 0, cols: 0 },
  pins: { rows: [], cols: [], splitRows: [], splitCols: [] },
  hardware: {
    mcu: 'rp2040',
    board: 'promicro',
    diodeDirection: 'ROW2COL',
  },
  features: {
    rgb: false,
    encoder: false,
    oled: false,
    via: true,
    split: false,
  },
  layers: 2,
  layoutOptions: {},
  activeOptions: {},
};

describe('export generation', () => {
  it('derives VIA matrix dimensions from key row/col assignments when pins are not available', () => {
    const keys: PhysicalKey[] = [
      {
        row: 1,
        col: 2,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: {
          0: { action: 'tap', keycode: 'A' },
        },
      },
    ];

    const viaJson = generateViaJson({ settings: baseSettings, keys });

    expect(viaJson.matrix).toEqual({ rows: 2, cols: 3 });
    expect(viaJson.keymaps[0][1][2]).toBe('KC_A');
  });

  it('does not emit a matrix mask from pin overlap alone', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Unmasked Board',
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 1,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('unmasked_board/keyboard.json')!.async('string'));

    expect(keyboardJson.matrix_pins.masked).toBeUndefined();
    expect(zip.file('unmasked_board/unmasked_board.c')).toBeNull();
  });

  it('emits explicit QMK bootmagic settings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Bootmagic Board',
      matrix: { rows: 3, cols: 4 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2'],
        cols: ['GP3', 'GP4', 'GP5', 'GP6'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        bootmagic: {
          enabled: true,
          row: 1,
          col: 2,
        },
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('bootmagic_board/keyboard.json')!.async('string'));

    expect(keyboardJson.features.bootmagic).toBeUndefined();
    expect(keyboardJson.bootmagic).toEqual({ enabled: true, matrix: [1, 2] });
  });

  it('emits disabled QMK bootmagic without a matrix position', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'No Bootmagic Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        bootmagic: {
          enabled: false,
        },
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('no_bootmagic_board/keyboard.json')!.async('string'));

    expect(keyboardJson.bootmagic).toEqual({ enabled: false });
  });

  it('emits a matrix mask when MATRIX_MASKED is enabled', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split Masked Board',
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['GP0', 'GP1'],
        cols: ['GP2', 'GP3'],
        splitRows: ['GP4', 'GP5'],
        splitCols: ['GP5', 'GP6'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      qmk: {
        matrixMasked: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('split_masked_board/keyboard.json')!.async('string'));
    const keyboardC = await zip.file('split_masked_board/split_masked_board.c')!.async('string');

    expect(keyboardJson.matrix_pins.masked).toBe(true);
    expect(keyboardJson.split.matrix_pins.right.rows).toEqual(['GP4', 'GP5']);
    expect(keyboardJson.split.matrix_pins.right.cols).toEqual(['GP5', 'GP6']);
    expect(keyboardC).toContain('(matrix_row_t)0x1ULL');
  });

  it('emits Vial MATRIX_MASKED through rules.mk instead of keyboard.json', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Masked Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      qmk: {
        matrixMasked: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('vial_masked_board/keyboard.json')!.async('string'));
    const rulesMk = await zip.file('vial_masked_board/rules.mk')!.async('string');
    const keyboardC = await zip.file('vial_masked_board/vial_masked_board.c')!.async('string');

    expect(keyboardJson.matrix_pins.masked).toBeUndefined();
    expect(keyboardJson.features.bootmagic).toBeUndefined();
    expect(keyboardJson.bootmagic).toEqual({ enabled: true, matrix: [0, 0] });
    expect(rulesMk).toContain('MATRIX_MASKED = yes');
    expect(keyboardC).toContain('const matrix_row_t matrix_mask[MATRIX_ROWS]');
  });

  it('emits configured Vial unlock combo positions', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Unlock Board',
      matrix: { rows: 4, cols: 5 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2', 'GP3'],
        cols: ['GP4', 'GP5', 'GP6', 'GP7', 'GP8'],
        splitRows: [],
        splitCols: [],
      },
      vial: {
        unlockCombo: {
          key1: { row: 1, col: 2 },
          key2: { row: 3, col: 4 },
        },
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
      {
        row: 2,
        col: 2,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const configH = await zip.file('vial_unlock_board/keymaps/vial/config.h')!.async('string');

    expect(configH).toContain('#define VIAL_UNLOCK_COMBO_ROWS { 1, 3 }');
    expect(configH).toContain('#define VIAL_UNLOCK_COMBO_COLS { 2, 4 }');
  });
});
