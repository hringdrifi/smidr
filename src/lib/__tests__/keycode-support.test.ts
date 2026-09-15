import { describe, expect, it } from 'vitest';
import { getActionSupport, getKeycodeSupport, resolveKeycodeSupportTarget } from '@/lib/keycode-support';

describe('keycode palette support target', () => {
  it('uses the selected firmware while designing', () => {
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: 'qmk', connectedProtocol: 'zmk' })).toBe('qmk');
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: 'vial' })).toBe('vial');
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: 'zmk' })).toBe('zmk');
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: 'rmk' })).toBe('rmk');
  });

  it('uses the connected protocol while remapping', () => {
    expect(resolveKeycodeSupportTarget({ appMode: 'remap', firmwareTarget: 'qmk', connectedProtocol: 'zmk' })).toBe('zmk');
    expect(resolveKeycodeSupportTarget({ appMode: 'remap', connectedProtocol: 'vial' })).toBe('vial');
    expect(resolveKeycodeSupportTarget({ appMode: 'remap', connectedProtocol: 'via' })).toBe('via');
  });

  it('does not expose an all-target palette without a selected or connected target', () => {
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: null })).toBeNull();
    expect(resolveKeycodeSupportTarget({ appMode: 'remap' })).toBeNull();
  });

  it('builds target-specific keycode catalogs', () => {
    expect(getKeycodeSupport('LM_ON', 'zmk').supported).toBe(false);
    expect(getKeycodeSupport('LM_ON', 'qmk').supported).toBe(true);
    expect(getKeycodeSupport('BL_TOGG', 'zmk').supported).toBe(true);
    expect(getKeycodeSupport('MOUSE_ACCEL0', 'zmk').supported).toBe(false);
    expect(getKeycodeSupport('BOOTLOADER', 'zmk').supported).toBe(true);
    expect(getKeycodeSupport('BOOTLOADER', 'qmk').supported).toBe(true);
    expect(getKeycodeSupport('CAPS_WORD', 'zmk').supported).toBe(true);
    expect(getKeycodeSupport('CAPS_WORD', 'qmk').supported).toBe(true);
    expect(getKeycodeSupport('CAPS_WORD', 'rmk').supported).toBe(true);
    expect(getKeycodeSupport('STUDIO_UNLOCK', 'zmk').supported).toBe(true);
    expect(getKeycodeSupport('STUDIO_UNLOCK', 'qmk').supported).toBe(false);
    expect(getKeycodeSupport('GRAVE_ESCAPE', 'rmk').supported).toBe(false);
    expect(getKeycodeSupport('SLEEP', 'zmk').supported).toBe(true);
    expect(getKeycodeSupport('SLEEP', 'rmk').supported).toBe(false);
    expect(getKeycodeSupport('MOUSE_BTN1', 'rmk').supported).toBe(true);
    expect(getKeycodeSupport('MOUSE_WHEEL_UP', 'rmk').supported).toBe(false);
    expect(getKeycodeSupport('TD_0', 'rmk').supported).toBe(false);
  });

  it('rejects missing targets and mismatched raw actions', () => {
    expect(getKeycodeSupport('A', null).supported).toBe(false);
    expect(getActionSupport({ action: 'custom', protocol: 'zmk', rawCode: '&kp A' }, 'zmk').supported).toBe(true);
    expect(getActionSupport({ action: 'custom', protocol: 'qmk', rawCode: 'KC_A' }, 'zmk').supported).toBe(false);
    expect(getActionSupport({
      action: 'lt',
      layerId: 1,
      tapAction: { action: 'tap', keycode: 'LM_ON' },
    }, 'zmk').supported).toBe(false);
  });
});
