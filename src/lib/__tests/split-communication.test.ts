import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { ProjectSettings, PhysicalKey, SmidrProject } from '@/types/keyboard';
import { getSplitCommunication, getActiveSplitPins } from '../split-communication';
import { generateQmkZip } from '../qmk';
import { generateVialZip } from '../vial';
import { generateZmkZip } from '../zmk';
import { generateRmkZip } from '../rmk';
import { validateFirmwareExport } from '../export-validation';
import { toSmidrProjectFileV05, fromSmidrProjectFile } from '../project-format';

const settings: ProjectSettings = {
  name: 'Split Test', manufacturer: 'Test', description: '', vendorProductId: 0xFEED0001,
  hardware: { controllerType: 'mcu', mcu: 'RP2040', board: '', diodeDirection: 'COL2ROW', splitCommunication: { transport: 'wired', duplex: 'full' } },
  pins: { rows: ['GP2'], cols: ['GP3'], splitRows: ['GP4'], splitCols: ['GP5'], splitSerial: 'GP0', splitSerialRx: 'GP1' },
  matrix: { rows: 1, cols: 2 }, features: { split: true, rgb: false, encoder: false, oled: false, via: true },
  layers: 1, layoutOptions: {}, activeOptions: {},
};
const keys: PhysicalKey[] = ['left', 'right'].map((side, i) => ({
  id: side, matrixSide: side as 'left' | 'right', row: 0, col: 0,
  x: i * 4, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '', keymap: { 0: { action: 'tap', keycode: 'A' } },
}));
const withMode = (transport: 'wired' | 'wireless', duplex: 'half' | 'full'): ProjectSettings => ({ ...settings, hardware: { ...settings.hardware, splitCommunication: { transport, duplex } } });
const unzip = async (blob: Blob | null) => {
  expect(blob).not.toBeNull();
  return JSZip.loadAsync(await blob!.arrayBuffer());
};
const readEnding = async (zip: JSZip, ending: string) => {
  const file = Object.values(zip.files).find(file => !file.dir && file.name.endsWith(ending));
  expect(file, ending).toBeDefined();
  return file!.async('string');
};

describe('common split communication', () => {
  it('round trips transport, duplex and both pins in hardware data', () => {
    const project = { ...settings, id: 'split', updatedAt: 1, keys } as SmidrProject;
    const file = toSmidrProjectFileV05(project);
    expect(file.hardware.splitCommunication).toEqual({ transport: 'wired', duplex: 'full' });
    const restored = fromSmidrProjectFile(JSON.parse(JSON.stringify(file)));
    expect(restored.hardware.splitCommunication).toEqual(settings.hardware.splitCommunication);
    expect(restored.pins.splitSerialRx).toBe('GP1');
  });
  it('keeps legacy serial and ZMK defaults readable', () => {
    const legacy = { ...settings, hardware: { ...settings.hardware, splitCommunication: undefined } };
    expect(getSplitCommunication(legacy, 'qmk')).toEqual({ transport: 'wired', duplex: 'half' });
    expect(getSplitCommunication(legacy, 'zmk')).toEqual({ transport: 'wireless', duplex: 'full' });
    expect(getSplitCommunication({ ...legacy, zmk: { splitTransport: 'wired' } }, 'zmk')).toEqual({ transport: 'wired', duplex: 'full' });
  });
  it('ignores inactive pins and keeps their saved values', () => {
    expect(getActiveSplitPins(settings)).toEqual(['GP0', 'GP1']);
    expect(getActiveSplitPins(withMode('wired', 'half'))).toEqual(['GP0']);
    expect(getActiveSplitPins(withMode('wireless', 'full'))).toEqual([]);
    expect(withMode('wireless', 'full').pins.splitSerialRx).toBe('GP1');
  });
  it.each([generateQmkZip, generateVialZip])('emits full-duplex UART defines and vendor driver', async generate => {
    const zip = await unzip(await generate({ settings, keys }));
    const config = await readEnding(zip, '/config.h');
    expect(config).toContain('#define SERIAL_USART_FULL_DUPLEX');
    expect(config).toContain('#define SERIAL_USART_TX_PIN GP0');
    expect(config).toContain('#define SERIAL_USART_RX_PIN GP1');
    const info = JSON.parse(await readEnding(zip, '/keyboard.json'));
    expect(info.split.serial).toEqual({ driver: 'vendor' });
  });
  it('emits half-duplex without a receive pin or full-duplex define', async () => {
    const zip = await unzip(await generateQmkZip({ settings: withMode('wired', 'half'), keys }));
    expect(await readEnding(zip, '/config.h')).not.toContain('SERIAL_USART_FULL_DUPLEX');
    expect(JSON.parse(await readEnding(zip, '/keyboard.json')).split.serial).toEqual({ driver: 'vendor', pin: 'GP0' });
  });
  it.each(['mcu', 'development_board'] as const)('emits selected ZMK UART pins for %s', async controllerType => {
    const configured = { ...settings, hardware: { ...settings.hardware, controllerType, board: 'kb2040' } };
    const zip = await unzip(await generateZmkZip({ settings: configured, keys }));
    const all = (await Promise.all(Object.values(zip.files).filter(f => /\.(dts|dtsi)$/.test(f.name)).map(f => f.async('string')))).join('\n');
    expect(all).toContain('device = <&smidr_split_uart>');
    expect(all).toContain('PIO0_P0');
    expect(all).toContain('PIO0_P1');
    expect(all).toContain('raspberrypi,pico-uart-pio');
  });
  it('emits Nordic UART pinctrl for both full-duplex signals', async () => {
    const configured = { ...settings, hardware: { ...settings.hardware, mcu: 'nRF52840' }, pins: { ...settings.pins, splitSerial: 'P0.06', splitSerialRx: 'P1.09' } };
    const zip = await unzip(await generateZmkZip({ settings: configured, keys }));
    const all = (await Promise.all(Object.values(zip.files).filter(f => f.name.endsWith('.dts')).map(f => f.async('string')))).join('\n');
    expect(all).toContain('NRF_PSEL(UART_TX, 0, 6)');
    expect(all).toContain('NRF_PSEL(UART_RX, 1, 9)');
  });
  it.each(['half', 'full'] as const)('emits RMK %s duplex split matrices and PIO pins', async duplex => {
    const zip = await unzip(await generateRmkZip({ settings: withMode('wired', duplex), keys }));
    const toml = await readEnding(zip, 'keyboard.toml');
    expect(toml).toContain('[split.central.matrix]');
    expect(toml).toContain('[split.peripheral.matrix]');
    expect(toml).toContain('row_offset = 1');
    expect(toml).toContain('instance = "PIO0", tx_pin = "PIN_0", rx_pin = "PIN_' + (duplex === 'half' ? '0' : '1') + '"');
    expect(toml).toContain('[layout]\nrows = 2\ncols = 1');
  });
  it('exports direct split matrices with one local row per half', async () => {
    const configured = { ...settings, matrix: { rows: 1, cols: 1, wiring: 'direct' as const }, pins: { ...settings.pins, rows: [], cols: [], direct: ['GP2'], splitDirect: ['GP3'] } };
    const directKeys = keys.map(key => ({ ...key, row: undefined, col: undefined, directIndex: 0 }));
    const zip = await unzip(await generateRmkZip({ settings: configured, keys: directKeys }));
    const toml = await readEnding(zip, 'keyboard.toml');
    expect(toml).toContain('direct_pins = [\n    ["PIN_2"]\n]');
    expect(toml).toContain('direct_pins = [\n    ["PIN_3"]\n]');
  });
  it('exports wireless without UART despite retained UART pins', async () => {
    const configured = { ...withMode('wireless', 'full'), hardware: { ...withMode('wireless', 'full').hardware, mcu: 'nRF52840' } };
    const zip = await unzip(await generateRmkZip({ settings: configured, keys }));
    const toml = await readEnding(zip, 'keyboard.toml');
    expect(toml).toContain('connection = "ble"');
    expect(toml).not.toContain('tx_pin');
    const zmk = await unzip(await generateZmkZip({ settings: configured, keys }));
    const all = (await Promise.all(Object.values(zmk.files).filter(f => f.name.endsWith('.dts')).map(f => f.async('string')))).join('\n');
    expect(all).not.toContain('wired_split');
    expect(all).not.toContain('smidr_split_uart');
  });
  it('reports missing and conflicting UART pins including the right half', () => {
    const missing = { ...settings, pins: { ...settings.pins, splitSerialRx: '' } };
    expect(validateFirmwareExport(missing, keys, 'qmk').map(i => i.code)).toContain('split-uart-pins-missing');
    const conflict = { ...settings, pins: { ...settings.pins, splitSerialRx: 'GP5' } };
    expect(validateFirmwareExport(conflict, keys, 'qmk').map(i => i.code)).toContain('split-uart-pin-conflict');
    const half = { ...withMode('wired', 'half'), pins: conflict.pins };
    expect(validateFirmwareExport(half, keys, 'qmk').map(i => i.code)).not.toContain('split-uart-pin-conflict');
  });
  it('rejects unsupported exports rather than silently changing transport', async () => {
    await expect(generateQmkZip({ settings: withMode('wireless', 'full'), keys })).rejects.toThrow('wireless');
    await expect(generateZmkZip({ settings: withMode('wired', 'half'), keys })).rejects.toThrow('half-duplex');
  });
});
