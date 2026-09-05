import { describe, expect, it } from 'vitest';
import { isFirmwareDetailSettingsComplete, isFirmwareTargetSupported } from '../firmware-targets';
import type { ProjectSettings } from '@/types/keyboard';

const settings: ProjectSettings = {
  name: 'Details', manufacturer: '', description: '', vendorProductId: 0,
  matrix: { rows: 1, cols: 1 }, pins: { rows: [], cols: [] },
  hardware: { controllerType: 'development_board', mcu: 'nrf52840', board: 'nice_nano', diodeDirection: 'COL2ROW' },
  features: { rgb: false, encoder: false, oled: false, via: true, split: false },
  layers: 1, activeOptions: {}, layoutOptions: {},
};

describe('firmware detail step', () => {
  it.each(['qmk', 'vial'] as const)('%s defaults are complete even on incompatible hardware', target => {
    expect(isFirmwareTargetSupported(target, settings.hardware)).toBe(false);
    expect(isFirmwareDetailSettingsComplete(target, settings)).toBe(true);
    const supported = { ...settings, hardware: { ...settings.hardware, board: 'promicro_rp2040', mcu: 'RP2040' } };
    expect(isFirmwareTargetSupported(target, supported.hardware)).toBe(true);
    expect(isFirmwareDetailSettingsComplete(target, supported)).toBe(true);
  });
  it('checks explicit bootmagic coordinates and ignores disabled values', () => {
    for (const row of [-1, 0.5, 256, NaN]) {
      expect(isFirmwareDetailSettingsComplete('qmk', { ...settings, qmk: { bootmagic: { row } } })).toBe(false);
      expect(isFirmwareDetailSettingsComplete('qmk', { ...settings, qmk: { bootmagic: { row, enabled: false } } })).toBe(true);
    }
    expect(isFirmwareDetailSettingsComplete('qmk', { ...settings, qmk: { bootmagic: { row: 0, col: 1 } } })).toBe(true);
  });
  it('checks Vial UID and unlock coordinates without affecting QMK', () => {
    for (const vialUid of ['0x12', '0x123456789ABCDEFX', '0x0123456789ABCDEF0']) {
      expect(isFirmwareDetailSettingsComplete('vial', { ...settings, vialUid })).toBe(false);
      expect(isFirmwareDetailSettingsComplete('qmk', { ...settings, vialUid })).toBe(true);
    }
    expect(isFirmwareDetailSettingsComplete('vial', { ...settings, vialUid: '0x123456789ABCDEF0' })).toBe(true);
    expect(isFirmwareDetailSettingsComplete('vial', { ...settings, vial: { unlockCombo: { key2: { col: -1 } } } })).toBe(false);
  });
  it('checks the legacy ZMK UART reference only while its field is active', () => {
    const wired = { ...settings, features: { ...settings.features, split: true }, zmk: { splitTransport: 'wired' as const } };
    expect(isFirmwareDetailSettingsComplete('zmk', wired)).toBe(true);
    expect(isFirmwareDetailSettingsComplete('zmk', { ...wired, zmk: { ...wired.zmk, wiredSplitDevice: '&uart0' } })).toBe(true);
    const invalid = { ...wired, zmk: { ...wired.zmk, wiredSplitDevice: 'bad reference' } };
    expect(isFirmwareDetailSettingsComplete('zmk', invalid)).toBe(false);
    expect(isFirmwareDetailSettingsComplete('zmk', { ...invalid, hardware: { ...invalid.hardware, splitCommunication: { transport: 'wired', duplex: 'full' } } })).toBe(true);
  });
});
