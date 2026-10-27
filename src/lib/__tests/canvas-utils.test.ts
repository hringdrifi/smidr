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
    expect(labelNodeToText(getKeyLabel(makeComponent({ encoderId: 'encoder-0', keymap: { 0: { action: 'tap', keycode: 'A' } } }), 'layout', 0, 'design', undefined, undefined, settings))).toBe('ENC0');
    expect(labelNodeToText(getKeyLabel(makeComponent({ trackballId: 'trackball-0' }), 'layout', 0, 'design', undefined, undefined, settings))).toBe('TRK0');
  });

  it('shows the selected layer assignment on ordinary keys in layout mode', () => {
    const key = makeComponent({ keymap: { 0: { action: 'tap', keycode: 'A' }, 1: { action: 'tap', keycode: 'B' } } });
    expect(labelNodeToText(getKeyLabel(key, 'layout', 0, 'design', undefined, undefined, settings))).toBe('A');
    expect(labelNodeToText(getKeyLabel(key, 'layout', 1, 'design', undefined, undefined, settings))).toBe('B');
    expect(getKeyLabel(key, 'layout', 2, 'design', undefined, undefined, settings)).toEqual({ type: 'empty' });
  });

  it('shows a trackball identifier in matrix wiring mode', () => {
    expect(labelNodeToText(getKeyLabel(makeComponent({ trackballId: 'trackball-0' }), 'matrix', 0, 'design', undefined, undefined, settings))).toBe('TRK0');
    expect(labelNodeToText(getKeyLabel(makeComponent({ row: 0, col: 0, keymap: { 0: { action: 'tap', keycode: 'A' } } }), 'matrix', 0, 'design', undefined, undefined, settings))).toBe('R0:C0');
  });
});
