import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateSmidrProjectJson, generateViaJson } from '../export';
import { generateQmkZip } from '../qmk';
import { generateVialZip } from '../vial';
import { generateZmkZip } from '../zmk';
import { validateFirmwareExport } from '../export-validation';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

const baseSettings: ProjectSettings = {
  name: 'Test Keyboard',
  manufacturer: 'Test',
  description: '',
  vendorProductId: 0xFEED0001,
  matrix: { rows: 0, cols: 0 },
  pins: { rows: [], cols: [], splitRows: [], splitCols: [] },
  hardware: {
    controllerType: 'development_board',
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
  tapDances: [],
  layoutOptions: {},
  activeOptions: {},
};

describe('export generation', () => {
  it('omits split pin settings from saved projects when split is disabled', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: {
        ...baseSettings.features,
        split: false,
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.pins).toEqual({
      rows: ['GP0'],
      cols: ['GP1'],
    });
  });

  it('stores USB IDs in .smidr as vendorId/productId instead of vendorProductId', () => {
    const project = generateSmidrProjectJson({ settings: baseSettings, keys: [] });

    expect(project.vendorId).toBe('0xFEED');
    expect(project.productId).toBe('0x0001');
    expect(project).not.toHaveProperty('vendorProductId');
  });

  it('keeps project macros in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      macros: [[{ action: 'text', text: 'Hello' }]],
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.macros?.[0]).toEqual([{ action: 'text', text: 'Hello' }]);
  });

  it('keeps project combos in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.combos?.[0]).toEqual({
      inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
      output: { action: 'tap', keycode: 'ESC' },
    });
  });

  it('keeps project ZMK settings in saved projects', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.zmk).toEqual({
      splitTransport: 'wired',
      wiredSplitDevice: '&uart0',
    });
  });

  it('keeps split pin settings in saved projects when split is enabled', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      features: {
        ...baseSettings.features,
        split: true,
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
    };

    const project = generateSmidrProjectJson({ settings, keys: [] });

    expect(project.pins.splitRows).toEqual(['GP2']);
    expect(project.pins.splitCols).toEqual(['GP3']);
    expect(project.pins.splitSerial).toBe('GP4');
  });

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
    expect(keyboardJson.features.via).toBeUndefined();
    expect(zip.file('unmasked_board/unmasked_board.c')).toBeNull();
  });

  it('emits QMK development_board without processor and bootloader', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Development Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        board: 'elite_pi',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
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
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('development_board/keyboard.json')!.async('string'));

    expect(keyboardJson.development_board).toBe('elite_pi');
    expect(keyboardJson.processor).toBeUndefined();
    expect(keyboardJson.bootloader).toBeUndefined();
  });

  it('emits current QMK RGB pin settings without deprecated config defines', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'RGB Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
        rgb: 'GP2',
      },
      features: {
        ...baseSettings.features,
        rgb: true,
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

    const qmkBlob = await generateQmkZip({ settings, keys });
    const vialBlob = await generateVialZip({ settings, keys });
    expect(qmkBlob).toBeTruthy();
    expect(vialBlob).toBeTruthy();

    const qmkZip = await JSZip.loadAsync(await qmkBlob!.arrayBuffer());
    const vialZip = await JSZip.loadAsync(await vialBlob!.arrayBuffer());
    const qmkConfigH = await qmkZip.file('rgb_board/config.h')!.async('string');
    const vialConfigH = await vialZip.file('rgb_board/config.h')!.async('string');

    for (const configH of [qmkConfigH, vialConfigH]) {
      expect(configH).toContain('#define WS2812_DI_PIN GP2');
      expect(configH).toContain('#define RGBLED_NUM 1');
      expect(configH).not.toContain('RGB_DI_PIN');
      expect(configH).not.toContain('RGBLIGHT_ANIMATIONS');
    }
  });

  it('emits QMK new-keyboard style processor and bootloader defaults when MCU is selected', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'STM Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'STM32F103',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['A0'],
        cols: ['B0'],
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
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keyboardJson = JSON.parse(await zip.file('stm_board/keyboard.json')!.async('string'));

    expect(keyboardJson.processor).toBe('STM32F103');
    expect(keyboardJson.bootloader).toBe('stm32duino');
  });

  it('emits QMK tap dance definitions and rules when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Tap Dance Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 0,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 175,
        },
      ],
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
        keymap: {
          0: { action: 'td', tapDanceId: 0 },
        },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('tap_dance_board/keymaps/default/keymap.c')!.async('string');
    const rulesMk = await zip.file('tap_dance_board/keymaps/default/rules.mk')!.async('string');

    expect(keymapC).toContain('tap_dance_action_t tap_dance_actions[]');
    expect(keymapC).toContain('void smidr_td_0_finished(tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('register_code16(smidr_td_0_held)');
    expect(keymapC).toContain('tap_code16(KC_ESC)');
    expect(keymapC).toContain('tap_code16(KC_CAPS)');
    expect(keymapC).toContain('[0] = ACTION_TAP_DANCE_FN_ADVANCED(NULL, smidr_td_0_finished, smidr_td_0_reset)');
    expect(keymapC).toContain('TD(0)');
    expect(rulesMk).toContain('TAP_DANCE_ENABLE = yes');
  });

  it('emits QMK static project macros when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Macro Board',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      macros: [[
        { action: 'text', text: 'Hi' },
        { action: 'delay', duration: 25 },
        { action: 'tap', keycodes: ['ENT'] },
      ]],
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
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('macro_board/keymaps/default/keymap.c')!.async('string');

    expect(keymapC).toContain('SMIDR_MACRO_0 = SAFE_RANGE');
    expect(keymapC).toContain('process_record_user');
    expect(keymapC).toContain('SEND_STRING("Hi")');
    expect(keymapC).toContain('wait_ms(25)');
    expect(keymapC).toContain('tap_code16(KC_ENT)');
    expect(keymapC).toContain('SMIDR_MACRO_0');
  });

  it('emits QMK project combos when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Combo Board',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
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
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateQmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('combo_board/keymaps/default/keymap.c')!.async('string');
    const rulesMk = await zip.file('combo_board/keymaps/default/rules.mk')!.async('string');

    expect(keymapC).toContain('const uint16_t PROGMEM smidr_combo_0[] = { KC_A, KC_B, COMBO_END };');
    expect(keymapC).toContain('COMBO(smidr_combo_0, KC_ESC)');
    expect(rulesMk).toContain('COMBO_ENABLE = yes');
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

  it('exports split Vial matrix positions as per-half rows and columns', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split Vial Board',
      matrix: { rows: 4, cols: 6 },
      pins: {
        rows: ['GP0', 'GP1', 'GP2', 'GP3'],
        cols: ['GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9'],
        splitRows: ['GP10', 'GP11', 'GP12', 'GP13'],
        splitCols: ['GP14', 'GP15', 'GP16', 'GP17', 'GP18', 'GP19'],
        encoderA: 'GP20',
        encoderB: 'GP21',
      },
      features: {
        ...baseSettings.features,
        split: true,
        encoder: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 8,
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
    const keyboardJson = JSON.parse(await zip.file('split_vial_board/keyboard.json')!.async('string'));
    const configH = await zip.file('split_vial_board/config.h')!.async('string');
    const vialJson = JSON.parse(await zip.file('split_vial_board/keymaps/vial/vial.json')!.async('string'));

    expect(keyboardJson.layouts.LAYOUT.layout.map((key: any) => key.matrix)).toEqual([[0, 0], [4, 0]]);
    expect(keyboardJson.encoder.rotary).toEqual([{ pin_a: 'GP20', pin_b: 'GP21' }]);
    expect(configH).not.toContain('ENCODERS_PAD_A');
    expect(configH).not.toContain('ENCODERS_PAD_B');
    expect(vialJson.matrix).toEqual({ rows: 8, cols: 6 });
  });

  it('keeps encoder output enabled when encoder pins are missing', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Encoder Missing Pins',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
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
    const keyboardJson = JSON.parse(await zip.file('encoder_missing_pins/keyboard.json')!.async('string'));
    expect(keyboardJson.features.encoder).toBe(true);
    expect(keyboardJson.encoder.rotary).toEqual([{ pin_a: 'B0', pin_b: 'B1' }]);
  });

  it('warns when encoder pins are missing during export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
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

    const issues = validateFirmwareExport(settings, keys, 'vial');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'encoder-pins-missing',
    }));
  });

  it('warns about unknown pins and missing split transport during export validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        encoderA: 'B0',
        encoderB: 'GP2',
        splitRows: [],
        splitCols: [],
      },
      features: {
        ...baseSettings.features,
        encoder: true,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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

    const issues = validateFirmwareExport(settings, keys, 'qmk');
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'unknown-pin',
      message: expect.stringContaining('Encoder A'),
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'split-serial-missing',
    }));
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'split-matrix-pins-missing',
    }));
  });

  it('allows ZMK custom-board split source export during validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'nRF52840',
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
        splitSerial: 'GP4',
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('allows ZMK nRF52840 development-board split source export during validation', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: ['P1.06'],
        splitCols: ['P1.08'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
  });

  it('warns when ZMK wired split has no UART device configured', () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      matrix: { rows: 1, cols: 1 },
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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

    const issues = validateFirmwareExport(settings, keys, 'zmk');
    expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'zmk-wired-split-device-missing',
    }));
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
    const configH = await zip.file('vial_masked_board/config.h')!.async('string');
    const rulesMk = await zip.file('vial_masked_board/rules.mk')!.async('string');
    const keyboardC = await zip.file('vial_masked_board/vial_masked_board.c')!.async('string');

    expect(keyboardJson.matrix_pins.masked).toBeUndefined();
    expect(keyboardJson.features.bootmagic).toBeUndefined();
    expect(keyboardJson.features.extrakey).toBe(false);
    expect(keyboardJson.features.mousekey).toBe(false);
    expect(keyboardJson.bootmagic).toEqual({ enabled: true, matrix: [0, 0] });
    expect(configH).toContain('#define MATRIX_MASKED');
    expect(rulesMk).toContain('MATRIX_MASKED = yes');
    expect(keyboardC).toContain('const matrix_row_t matrix_mask[MATRIX_ROWS]');
  });

  it('emits Vial tap dance definitions and rules when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Tap Dance',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 1,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 225,
        },
      ],
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
        keymap: {
          0: { action: 'td', tapDanceId: 1 },
        },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_tap_dance/keymaps/vial/keymap.c')!.async('string');
    const rulesMk = await zip.file('vial_tap_dance/keymaps/vial/rules.mk')!.async('string');

    expect(keymapC).toContain('void smidr_td_1_finished(tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('tap_code16(KC_ESC)');
    expect(keymapC).toContain('tap_code16(KC_CAPS)');
    expect(keymapC).toContain('[1] = ACTION_TAP_DANCE_FN_ADVANCED(NULL, smidr_td_1_finished, smidr_td_1_reset)');
    expect(keymapC).toContain('TD(1)');
    expect(rulesMk).toContain('TAP_DANCE_ENABLE = yes');
  });

  it('emits Vial static project macros when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Macro',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      macros: [[{ action: 'text', text: 'Vial' }]],
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
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_macro/keymaps/vial/keymap.c')!.async('string');

    expect(keymapC).toContain('SMIDR_MACRO_0 = SAFE_RANGE');
    expect(keymapC).toContain('SEND_STRING("Vial")');
    expect(keymapC).toContain('SMIDR_MACRO_0');
  });

  it('emits Vial project combos when configured', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Vial Combo',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1', 'GP2'],
        splitRows: [],
        splitCols: [],
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
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
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateVialZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymapC = await zip.file('vial_combo/keymaps/vial/keymap.c')!.async('string');
    const rulesMk = await zip.file('vial_combo/keymaps/vial/rules.mk')!.async('string');

    expect(keymapC).toContain('COMBO(smidr_combo_0, KC_ESC)');
    expect(rulesMk).toContain('COMBO_ENABLE = yes');
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
      vialUid: '43A8F8008844F971',
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
    expect(configH).toContain('#define VIAL_KEYBOARD_UID { 0x71, 0xF9, 0x44, 0x88, 0x00, 0xF8, 0xA8, 0x43 }');
  });

  it('emits nRF52840 ZMK custom board GPIO ports', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Nordic Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'nRF52840',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P1.02'],
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
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const boardDts = await zip.file('boards/arm/nordic_board/nordic_board.dts')!.async('string');
    const kconfigBoard = await zip.file('boards/arm/nordic_board/Kconfig.board')!.async('string');

    expect(kconfigBoard).toContain('select SOC_NRF52840_QIAA');
    expect(boardDts).toContain('#include <nordic/nrf52840_qiaa.dtsi>');
    expect(boardDts).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(boardDts).toContain('&gpio1 2 GPIO_ACTIVE_HIGH');
  });

  it('emits ZMK split custom boards for MCU projects', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split MCU Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'mcu',
        mcu: 'RP2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const leftDts = await zip.file('boards/arm/split_mcu_board_left/split_mcu_board_left.dts')!.async('string');
    const rightDts = await zip.file('boards/arm/split_mcu_board_right/split_mcu_board_right.dts')!.async('string');
    const leftKconfig = await zip.file('boards/arm/split_mcu_board_left/Kconfig.defconfig')!.async('string');
    const rightKconfig = await zip.file('boards/arm/split_mcu_board_right/Kconfig.defconfig')!.async('string');
    const leftConf = await zip.file('boards/arm/split_mcu_board_left/split_mcu_board_left.conf')!.async('string');
    const keymap = await zip.file('config/split_mcu_board.keymap')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(leftDts).toContain('model = "Split MCU Board left"');
    expect(leftDts).toContain('RC(0,0) RC(0,1)');
    expect(leftDts).toContain('compatible = "zmk,wired-split"');
    expect(leftDts).toContain('device = <&uart0>;');
    expect(rightDts).toContain('model = "Split MCU Board right"');
    expect(rightDts).toContain('col-offset = <1>');
    expect(rightDts).toContain('&gpio0 2 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(rightDts).toContain('&gpio0 3 GPIO_ACTIVE_HIGH');
    expect(leftKconfig).toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(leftKconfig).toContain('config ZMK_SPLIT');
    expect(rightKconfig).not.toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(rightKconfig).toContain('config ZMK_SPLIT');
    expect(leftConf).toContain('CONFIG_ZMK_SPLIT_WIRED=y');
    expect(keymap).toContain('&kp A &kp B');
    expect(readme).toContain('- board: split_mcu_board_left');
    expect(readme).toContain('- board: split_mcu_board_right');
  });

  it('emits ZMK as an existing board plus shield when development board is selected', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Shield Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P1.02'],
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
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const shieldOverlay = await zip.file('boards/shields/shield_board/shield_board.overlay')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(zip.file('boards/arm/shield_board/Kconfig.board')).toBeNull();
    expect(shieldOverlay).toContain('zmk,kscan = &kscan0;');
    expect(shieldOverlay).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(shieldOverlay).toContain('&gpio1 2 GPIO_ACTIVE_HIGH');
    expect(readme).toContain('- board: nice_nano');
    expect(readme).toContain('shield: shield_board');
  });

  it('emits ZMK split as left and right shield siblings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Split ZMK Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano',
      },
      matrix: { rows: 2, cols: 2 },
      pins: {
        rows: ['P0.06', 'P0.07'],
        cols: ['P0.08', 'P0.09'],
        splitRows: ['P1.06', 'P1.07'],
        splitCols: ['P1.08', 'P1.09'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 5,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/split_zmk_board/split_zmk_board.dtsi')!.async('string');
    const leftOverlay = await zip.file('boards/shields/split_zmk_board/split_zmk_board_left.overlay')!.async('string');
    const rightOverlay = await zip.file('boards/shields/split_zmk_board/split_zmk_board_right.overlay')!.async('string');
    const kconfigShield = await zip.file('boards/shields/split_zmk_board/Kconfig.shield')!.async('string');
    const kconfigDefconfig = await zip.file('boards/shields/split_zmk_board/Kconfig.defconfig')!.async('string');
    const zmkYml = await zip.file('boards/shields/split_zmk_board/split_zmk_board.zmk.yml')!.async('string');
    const keymap = await zip.file('boards/shields/split_zmk_board/split_zmk_board.keymap')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(zip.file('config/split_zmk_board.keymap')).toBeNull();
    expect(dtsi).toContain('columns = <4>');
    expect(dtsi).toContain('rows = <2>');
    expect(dtsi).toContain('RC(0,0) RC(0,2)');
    expect(leftOverlay).toContain('#include "split_zmk_board.dtsi"');
    expect(leftOverlay).toContain('&gpio0 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(leftOverlay).toContain('&gpio0 8 GPIO_ACTIVE_HIGH');
    expect(rightOverlay).toContain('col-offset = <2>');
    expect(rightOverlay).toContain('&gpio1 6 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)');
    expect(rightOverlay).toContain('&gpio1 8 GPIO_ACTIVE_HIGH');
    expect(kconfigShield).toContain('config SHIELD_SPLIT_ZMK_BOARD_LEFT');
    expect(kconfigShield).toContain('config SHIELD_SPLIT_ZMK_BOARD_RIGHT');
    expect(kconfigDefconfig).toContain('config ZMK_SPLIT_ROLE_CENTRAL');
    expect(kconfigDefconfig).toContain('config ZMK_SPLIT');
    expect(zmkYml).toContain('siblings:');
    expect(zmkYml).toContain('  - split_zmk_board_left');
    expect(zmkYml).toContain('  - split_zmk_board_right');
    expect(keymap).toContain('&kp A &kp B');
    expect(readme).toContain('shield: split_zmk_board_left');
    expect(readme).toContain('shield: split_zmk_board_right');
  });

  it('emits ZMK wired split transport settings', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Wired ZMK Split',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: ['GP2'],
        splitCols: ['GP3'],
      },
      features: {
        ...baseSettings.features,
        split: true,
      },
      zmk: {
        splitTransport: 'wired',
        wiredSplitDevice: '&uart0',
      },
    };
    const keys: PhysicalKey[] = [
      {
        row: 0,
        col: 0,
        matrixSide: 'left',
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
        row: 0,
        col: 0,
        matrixSide: 'right',
        x: 4,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const dtsi = await zip.file('boards/shields/wired_zmk_split/wired_zmk_split.dtsi')!.async('string');
    const conf = await zip.file('boards/shields/wired_zmk_split/wired_zmk_split.conf')!.async('string');
    const readme = await zip.file('README.md')!.async('string');

    expect(dtsi).toContain('compatible = "zmk,wired-split"');
    expect(dtsi).toContain('device = <&uart0>;');
    expect(conf).toContain('CONFIG_ZMK_SPLIT_BLE=n');
    expect(conf).toContain('CONFIG_ZMK_SPLIT_WIRED=y');
    expect(readme).toContain('ZMK wired split firmware');
    expect(readme).toContain('using `&uart0`');
    expect(readme).toContain('- board: adafruit_kb2040');
    expect(readme).toContain('shield: wired_zmk_split_left');
    expect(readme).toContain('shield: wired_zmk_split_right');
  });

  it('emits ZMK tap dance behaviors from Vial-style definitions', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Tap Dance',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
        splitRows: [],
        splitCols: [],
      },
      tapDances: [
        {
          id: 0,
          tapAction: { action: 'tap', keycode: 'ESC' },
          holdAction: { action: 'tap', keycode: 'LSFT' },
          doubleTapAction: { action: 'tap', keycode: 'CAPS' },
          tapHoldAction: { action: 'tap', keycode: 'LCTL' },
          tappingTerm: 180,
        },
      ],
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
        keymap: {
          0: { action: 'td', tapDanceId: 0 },
        },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_tap_dance.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,behavior-tap-dance"');
    expect(keymap).toContain('compatible = "zmk,behavior-hold-tap"');
    expect(keymap).toContain('tapping-term-ms = <180>');
    expect(keymap).toContain('bindings = <&smidr_td_0_1_ht LSHIFT ESC>, <&smidr_td_0_2_ht LCTRL CLCK>');
    expect(keymap).toContain('&smidr_td_0');
  });

  it('emits ZMK macro behaviors from project macros', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Macro',
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08'],
        splitRows: [],
        splitCols: [],
      },
      hardware: {
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano_v2',
        diodeDirection: 'COL2ROW',
      },
      macros: [[
        { action: 'text', text: 'Az' },
        { action: 'delay', duration: 30 },
        { action: 'tap', keycodes: ['ENT'] },
      ]],
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
        keymap: {
          0: { action: 'macro', macroId: 0 },
        },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_macro.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,behavior-macro"');
    expect(keymap).toContain('smidr_macro_0: smidr_macro_0');
    expect(keymap).toContain('&macro_press &kp LSHIFT');
    expect(keymap).toContain('&macro_wait_time 30');
    expect(keymap).toContain('&macro_tap &kp RET');
    expect(keymap).toContain('&smidr_macro_0');
  });

  it('emits ZMK combos from project combos', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'ZMK Combo',
      matrix: { rows: 1, cols: 2 },
      pins: {
        rows: ['P0.06'],
        cols: ['P0.08', 'P0.09'],
        splitRows: [],
        splitCols: [],
      },
      hardware: {
        controllerType: 'development_board',
        mcu: 'nRF52840',
        board: 'nice_nano_v2',
        diodeDirection: 'COL2ROW',
      },
      combos: [{
        inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
        output: { action: 'tap', keycode: 'ESC' },
      }],
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
        keymap: { 0: { action: 'tap', keycode: 'A' } },
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        r: 0,
        rx: 0,
        ry: 0,
        label: '',
        keymap: { 0: { action: 'tap', keycode: 'B' } },
      },
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const keymap = await zip.file('config/zmk_combo.keymap')!.async('string');

    expect(keymap).toContain('compatible = "zmk,combos"');
    expect(keymap).toContain('key-positions = <0 1>');
    expect(keymap).toContain('bindings = <&kp ESC>');
  });

  it('maps shared development board selections to ZMK board ids', async () => {
    const settings: ProjectSettings = {
      ...baseSettings,
      name: 'Shared Board',
      hardware: {
        ...baseSettings.hardware,
        controllerType: 'development_board',
        mcu: 'RP2040',
        board: 'kb2040',
      },
      matrix: { rows: 1, cols: 1 },
      pins: {
        rows: ['GP0'],
        cols: ['GP1'],
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
    ];

    const blob = await generateZmkZip({ settings, keys });
    expect(blob).toBeTruthy();

    const zip = await JSZip.loadAsync(await blob!.arrayBuffer());
    const readme = await zip.file('README.md')!.async('string');

    expect(readme).toContain('- board: adafruit_kb2040');
    expect(readme).toContain('shield: shared_board');
  });
});
