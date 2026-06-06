import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { generateSmidrProjectJson, generateViaJson } from '../export';
import { generateQmkZip } from '../qmk';
import { generateVialZip } from '../vial';
import { generateZmkZip } from '../zmk';
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
    expect(keymapC).toContain('void smidr_td_0_finished(qk_tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('register_code16(smidr_td_0_held)');
    expect(keymapC).toContain('tap_code16(KC_ESC)');
    expect(keymapC).toContain('tap_code16(KC_CAPS)');
    expect(keymapC).toContain('[0] = ACTION_TAP_DANCE_FN_ADVANCED_TIME(NULL, smidr_td_0_finished, smidr_td_0_reset, 175)');
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

    expect(keymapC).toContain('void smidr_td_1_finished(qk_tap_dance_state_t *state, void *user_data)');
    expect(keymapC).toContain('tap_code16(KC_ESC)');
    expect(keymapC).toContain('tap_code16(KC_CAPS)');
    expect(keymapC).toContain('[1] = ACTION_TAP_DANCE_FN_ADVANCED_TIME(NULL, smidr_td_1_finished, smidr_td_1_reset, 225)');
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
