import { describe, expect, it } from 'vitest';
import type { SmidrProject } from '@/types/keyboard';
import { fromSmidrProjectFile, isSmidrProjectFileV05, toSmidrProjectFileV05 } from '@/lib/project-format';

const legacyProject: SmidrProject = {
  id: 'project-1',
  updatedAt: 123,
  name: 'Bifrost',
  manufacturer: 'Smiðr',
  description: 'Split keyboard',
  vendorId: '0xFEED',
  productId: '0x0001',
  matrix: { rows: 4, cols: 6, wiring: 'matrix' },
  pins: { rows: ['GP0'], cols: ['GP1'], splitRows: ['GP2'], splitCols: ['GP3'] },
  hardware: { controllerType: 'development_board', mcu: 'RP2040', board: 'promicro', diodeDirection: 'COL2ROW', bootloader: 'rp2040' },
  qmk: { matrixMasked: true },
  features: { rgb: false, encoder: true, oled: false, via: true, split: true },
  layers: 4,
  encoders: [{ id: 'encoder-runtime', pinA: 'GP4', pinB: 'GP5' }],
  macros: [[{ action: 'text', text: 'hello' }]],
  combos: [],
  tapDances: [],
  layoutOptions: { thumb: { name: 'Thumb', type: 'toggle' } },
  activeOptions: { thumb: 0 },
  vialUid: '0x1234567890ABCDEF',
  keys: [{ id: 'key-runtime', encoderId: 'encoder-runtime', kind: 'encoder', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' }],
};

describe('Smiðr 0.5 project format', () => {
  it('groups project data by purpose and removes runtime ids', () => {
    const file = toSmidrProjectFileV05(legacyProject);

    expect(file.schemaVersion).toBe('0.5');
    expect(file.metadata.name).toBe('Bifrost');
    expect(file.hardware.split).toBe(true);
    expect(file.firmware.vendorId).toBe('0xFEED');
    expect(file.layout.keys[0].encoderIndex).toBe(0);
    expect(file.layout.keys[0]).not.toHaveProperty('id');
    expect(file.hardware.encoders?.[0]).not.toHaveProperty('id');
    expect(isSmidrProjectFileV05(file)).toBe(true);
  });

  it('converts a 0.5 file to the runtime-compatible project model', () => {
    const restored = fromSmidrProjectFile(toSmidrProjectFileV05(legacyProject));

    expect(restored.name).toBe(legacyProject.name);
    expect(restored.features.split).toBe(true);
    expect(restored.pins.splitRows).toEqual(['GP2']);
    expect(restored.macros?.[0]).toEqual([{ action: 'text', text: 'hello' }]);
    expect(restored.keys[0].encoderIndex).toBe(0);
  });

  it('keeps an unversioned project readable for legacy imports', () => {
    expect(fromSmidrProjectFile(legacyProject)).toBe(legacyProject);
  });

  it('derives direct pin pools from legacy key assignments', () => {
    const directProject: SmidrProject = {
      ...legacyProject,
      matrix: { rows: 1, cols: 2, wiring: 'direct' },
      pins: { rows: [], cols: [] },
      keys: [
        { id: 'left', matrixSide: 'left', directPin: 'D0', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: '' },
        { id: 'right', matrixSide: 'right', directPin: 'D1', x: 4, y: 0, w: 1, h: 1, r: 0, rx: 4, ry: 0, label: '' },
      ],
    };

    const restored = fromSmidrProjectFile(directProject);

    expect(restored.pins.direct).toEqual(['D0']);
    expect(restored.pins.splitDirect).toEqual(['D1']);
    expect(restored.keys[0].directIndex).toBe(0);
    expect(restored.keys[1].directIndex).toBe(0);
    expect(restored.keys[0].directPin).toBeUndefined();

    const saved = toSmidrProjectFileV05(restored);
    expect(saved.layout.keys[0].directIndex).toBe(0);
    expect(saved.layout.keys[0]).not.toHaveProperty('directPin');
  });
});
