import { describe, expect, it } from 'vitest';
import type { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getKeyLabel, labelNodeToText } from '../canvas-utils';

const settings = {
  matrix: { rows: 1, cols: 1, wiring: 'matrix' },
  encoders: [{ id: 'encoder-0', keymap: {} }],
  trackballs: [{ id: 'trackball-0', cpi: 1200 }],
} as ProjectSettings;

const makeComponent = (updates: Partial<PhysicalKey>): PhysicalKey => ({
  id: 'component',
  label: '',
  x: 0,
  y: 0,
  w: 1,
  h: 1,
  r: 0,
  rx: 0,
  ry: 0,
  ...updates,
});

describe('getKeyLabel component identifiers', () => {
  it('shows encoder and trackball identifiers in layout mode', () => {
    expect(labelNodeToText(getKeyLabel(makeComponent({ encoderId: 'encoder-0' }), 'layout', 0, 'design', undefined, undefined, settings))).toBe('ENC0');
    expect(labelNodeToText(getKeyLabel(makeComponent({ trackballId: 'trackball-0' }), 'layout', 0, 'design', undefined, undefined, settings))).toBe('TRK0');
  });

  it('shows a trackball identifier in matrix wiring mode', () => {
    expect(labelNodeToText(getKeyLabel(makeComponent({ trackballId: 'trackball-0' }), 'matrix', 0, 'design', undefined, undefined, settings))).toBe('TRK0');
  });
});
