import { describe, expect, it } from 'vitest';
import { getKeycodeSupport, resolveKeycodeSupportTarget } from '@/lib/keycode-support';

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

  it('falls back to all without a selected or connected target', () => {
    expect(resolveKeycodeSupportTarget({ appMode: 'design', firmwareTarget: null })).toBe('all');
    expect(resolveKeycodeSupportTarget({ appMode: 'remap' })).toBe('all');
  });

  it('applies target-specific support rules automatically', () => {
    expect(getKeycodeSupport('LM_ON', 'zmk').supported).toBe(false);
    expect(getKeycodeSupport('LM_ON', 'qmk').supported).toBe(true);
  });
});
