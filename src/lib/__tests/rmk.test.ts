import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateRmkZip } from '../rmk';
import { getRmkHardwareErrors, RmkExportFormat } from '../rmk-hardware';
import { rmkActionToRust } from '../rmk-rust';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

const fixture = (chip = 'rp2040', split = false, direct = false) => {
  const pin = (n: number) => chip === 'rp2040' ? `GP${n}` : `P0.${String(n).padStart(2, '0')}`;
  const settings: ProjectSettings = {
    name: 'RMK smoke', manufacturer: 'Smiðr', description: '', vendorProductId: 0xFEED0001,
    hardware: { controllerType: 'mcu', mcu: chip, board: '', diodeDirection: 'COL2ROW', splitCommunication: { transport: chip === 'rp2040' ? 'wired' : 'wireless', duplex: 'half' } },
    matrix: { rows: split ? 2 : 1, cols: 2, wiring: direct ? 'direct' : 'matrix' },
    pins: { rows: [pin(2)], cols: [pin(3), pin(4)], splitRows: [pin(2)], splitCols: [pin(3), pin(4)], splitSerial: pin(10), direct: [pin(2), pin(3)], splitDirect: [pin(2), pin(3)] },
    features: { rgb: false, encoder: false, oled: false, via: true, split },
    layers: 2, activeOptions: {}, layoutOptions: {},
    trackballs: [{ id: 'left-ball', sclk: pin(5), sdio: pin(6), cs: pin(7), motion: pin(8), cpi: 1400, swapXy: true, invertY: true },
      ...(split ? [{ id: 'right-ball', sclk: pin(5), sdio: pin(6), cs: pin(7), cpi: 800 }] : [])],
  };
  const key = (x: number, overrides: Partial<PhysicalKey>): PhysicalKey => ({ x, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '', ...overrides });
  const keys: PhysicalKey[] = [
    key(0, { row: 0, col: 0, directIndex: 0, matrixSide: 'left', keymap: { 0: { action: 'tap', keycode: 'A' }, 1: { action: 'tap', keycode: 'MOUSE_BTN1' } } }),
    key(1, { row: 0, col: 1, directIndex: 1, matrixSide: 'left', keymap: { 0: { action: 'lt', layerId: 1, tapAction: { action: 'tap', keycode: 'SPC' } } } }),
    key(2, { kind: 'trackball', trackballId: 'left-ball', matrixSide: 'left' }),
    ...(split ? [key(5, { row: 0, col: 0, directIndex: 0, matrixSide: 'right', keymap: { 0: { action: 'tap', keycode: 'B', mods: ['LSFT', 'RCTL'] } } }),
      key(6, { row: 0, col: 1, directIndex: 1, matrixSide: 'right', keymap: { 0: { action: 'mt', modifiers: ['LCTL'], tapAction: { action: 'tap', keycode: 'ESC' } } } }),
      key(7, { kind: 'trackball', trackballId: 'right-ball', matrixSide: 'right' })] : []),
  ];
  return { settings, keys };
};

// Set RMK_SMOKE_DIR to cross-compile the actual generated projects outside the repository.
const saveSmokeZip = async (zip: JSZip, name: string) => {
  if (!process.env.RMK_SMOKE_DIR) return;
  const root = join(process.env.RMK_SMOKE_DIR, name);
  for (const file of Object.values(zip.files).filter(file => !file.dir)) {
    const filename = join(root, file.name);
    await mkdir(join(filename, '..'), { recursive: true });
    await writeFile(filename, await file.async('nodebuffer'));
  }
};

describe('RMK 0.9 source export', () => {
  for (const chip of ['rp2040', 'nrf52840']) for (const split of [false, true]) for (const format of ['toml', 'rust'] as RmkExportFormat[]) {
    it(`${chip}, split=${split}, ${format}: emits matching sensor wiring and complete entry points`, async () => {
      const state = fixture(chip, split);
      const zip = await JSZip.loadAsync(await (await generateRmkZip(state, { format })).arrayBuffer());
      const toml = await zip.file('keyboard.toml')!.async('string');
      expect(toml).toContain('[keymap]\nlayers = 2');
      expect(toml).not.toContain('keymap = [');
      expect(toml).toContain(`[[${split ? 'split.central.' : ''}input_device.pmw3610]]`);
      expect(toml).toContain('cpi = 1400');
      expect(toml).toContain('swap_xy = true');
      expect(toml).toContain('invert_y = true');
      if (split) {
        expect(toml).toContain('[[split.peripheral.input_device.pmw3610]]');
        expect(toml).toContain('id = 1');
        expect(toml).toContain('row_offset = 1');
      }
      const cargo = await zip.file('Cargo.toml')!.async('string');
      expect(cargo).toContain('version = "=0.9.0"');
      expect(cargo).not.toContain('path = "../../../rmk"');
      expect(zip.file('memory.x')).toBeTruthy();
      const source = await zip.file(split ? 'src/central.rs' : 'src/main.rs')!.async('string');
      if (format === 'rust') {
        expect(source).toContain('PointingDevice::<');
        expect(source).toContain('res_cpi: 1400');
        expect(source).toContain('device_id: 0');
        expect(source).toContain('run_all!');
        const keymap = await zip.file('src/keymap.rs')!.async('string');
        expect(keymap).toContain('rmk::k!(A)');
        expect(keymap).toContain('rmk::k!(MouseBtn1)');
        if (split) {
          expect(source).toContain('device_id: 1');
          expect(source).not.toContain('let mut trackball_1');
          const peripheral = await zip.file('src/peripheral.rs')!.async('string');
          expect(peripheral).toContain('let mut trackball_1');
          expect(peripheral).not.toContain('PointingProcessor::new');
          expect(peripheral).toContain("None::<Input<'static>>");
        }
      } else expect(source).toContain(split ? '#[rmk::macros::rmk_central]' : '#[rmk::macros::rmk_keyboard]');
      await saveSmokeZip(zip, `${chip}-${split ? 'split' : 'single'}-${format}`);
    });
  }
  it('emits direct matrices and full-duplex serial in Rust', async () => {
    const state = fixture('rp2040', true, true);
    state.settings.hardware.splitCommunication!.duplex = 'full';
    state.settings.pins.splitSerialRx = 'GP11';
    const zip = await JSZip.loadAsync(await (await generateRmkZip(state, { format: 'rust' })).arrayBuffer());
    const central = await zip.file('src/central.rs')!.async('string');
    expect(central).toContain('DirectPinMatrix::<_, _, 1, 2, 2>');
    expect(central).toContain('new_full_duplex(p.PIO0, p.PIN_10, p.PIN_11');
    await saveSmokeZip(zip, 'rp2040-direct-rust');
  });
  it('rejects missing wiring and unsupported Rust targets, while allowing polling', async () => {
    const state = fixture();
    state.settings.trackballs![0].motion = '';
    expect(getRmkHardwareErrors(state.settings, state.keys, 'toml')).toEqual([]);
    state.settings.trackballs![0].sdio = '';
    await expect(generateRmkZip(state)).rejects.toThrow('SCLK, SDIO and CS');
    state.settings.hardware.mcu = 'stm32f411';
    expect(getRmkHardwareErrors(state.settings, state.keys, 'rust').join()).toContain('RP2040 and nRF52840');
  });
  it('preserves modifier bits and rejects unsupported raw syntax instead of dropping actions', () => {
    expect(rmkActionToRust('MT(A, LCtrl | RShift)')).toContain('from_bits(33)');
    expect(rmkActionToRust('Reboot')).toContain('KeyboardAction::Reboot');
    expect(() => rmkActionToRust('unhandled(1, 2)')).toThrow('cannot translate');
  });
  it('rejects sensor pin collisions only on the same half', () => {
    const state = fixture('rp2040', true);
    expect(getRmkHardwareErrors(state.settings, state.keys, 'rust')).toEqual([]);
    state.settings.trackballs![0].sclk = 'GP2';
    expect(getRmkHardwareErrors(state.settings, state.keys, 'rust').join()).toContain('shared by matrix row and trackball');
  });
  it('excludes inactive trackball placements without renumbering remaining sensor IDs', async () => {
    const state = fixture('rp2040', true);
    const ball = state.keys.find(key => key.trackballId === 'left-ball')!;
    ball.group = 'option';
    ball.option = 1;
    state.settings.activeOptions = { option: 0 };
    const zip = await JSZip.loadAsync(await (await generateRmkZip(state)).arrayBuffer());
    const toml = await zip.file('keyboard.toml')!.async('string');
    expect(toml).not.toContain('name = "trackball0"');
    expect(toml).toContain('name = "trackball1"\nid = 1');
  });
  it('keeps the Nordic vector origin and Adafruit feature consistent', async () => {
    const state = fixture('nrf52840');
    for (const bootloader of [undefined, 'adafruit-uf2']) {
      state.settings.hardware.bootloader = bootloader;
      const zip = await JSZip.loadAsync(await (await generateRmkZip(state)).arrayBuffer());
      const cargo = await zip.file('Cargo.toml')!.async('string');
      const memory = await zip.file('memory.x')!.async('string');
      expect(cargo.includes('"adafruit_bl"')).toBe(!!bootloader);
      expect(memory).toContain(`FLASH : ORIGIN = ${bootloader ? '0x00001000' : '0x00000000'}`);
    }
  });
});
