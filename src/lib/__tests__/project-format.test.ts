import { describe, expect, it } from 'vitest';
import { fromSmidrProjectFile, toSmidrProjectFileV05 } from '@/lib/project-format';
import { SmidrProject } from '@/types/keyboard';

const project = (firmwareTarget: SmidrProject['firmwareTarget']): SmidrProject => ({
  id: 'firmware-target-test',
  updatedAt: 1,
  firmwareTarget,
  name: 'Target Test',
  manufacturer: 'Smiðr',
  description: '',
  vendorProductId: 0xFEED0001,
  matrix: { rows: 1, cols: 1, wiring: 'matrix' },
  pins: { rows: ['GP0'], cols: ['GP1'] },
  hardware: { mcu: 'RP2040', board: 'promicro_rp2040', diodeDirection: 'COL2ROW' },
  features: { rgb: false, encoder: false, oled: false, via: true, split: false },
  layers: 1,
  layoutOptions: {},
  activeOptions: {},
  keys: [{ x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '', row: 0, col: 0 }],
});

describe('firmware target project persistence', () => {
  it('round-trips the selected firmware target', () => {
    const file = toSmidrProjectFileV05(project('zmk'));
    expect(file.firmware.target).toBe('zmk');
    expect(fromSmidrProjectFile(file).firmwareTarget).toBe('zmk');
  });

  it('preserves the unselected state for a new project', () => {
    const file = toSmidrProjectFileV05(project(null));
    expect(file.firmware.target).toBeNull();
    expect(fromSmidrProjectFile(file).firmwareTarget).toBeNull();
  });

  it('migrates a 0.5 project without a target to QMK/VIA', () => {
    const file = toSmidrProjectFileV05(project('qmk'));
    delete file.firmware.target;
    expect(fromSmidrProjectFile(file).firmwareTarget).toBe('qmk');
  });
});
