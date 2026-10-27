import { describe, expect, it } from 'vitest';
import type { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import {
  getDirectLocalMatrixPosition,
  getDirectSideDimensions,
  isMatrixSwitchKey,
  isMatrixPositionWithinConfiguredPins,
  resolveDirectPin,
} from '../matrix-utils';

const settings = {
  features: { split: true },
  matrix: { rows: 2, cols: 2, wiring: 'matrix' },
  pins: {
    rows: ['GP0', 'GP1'],
    cols: ['GP2', 'GP3'],
    splitRows: [],
    splitCols: [],
  },
} as unknown as ProjectSettings;

const keys = [
  { id: 'left', row: 0, col: 0, matrixSide: 'left', x: 0, w: 1 },
  { id: 'right', row: 0, col: 0, matrixSide: 'right', x: 8, w: 1 },
] as PhysicalKey[];

describe('isMatrixPositionWithinConfiguredPins', () => {
  it('validates split halves against their own pin groups', () => {
    expect(isMatrixPositionWithinConfiguredPins(settings, keys[0], keys)).toBe(true);
    expect(isMatrixPositionWithinConfiguredPins(settings, keys[1], keys)).toBe(false);
  });

  it('accepts the right half after its row and column pins are configured', () => {
    const configured = {
      ...settings,
      pins: { ...settings.pins, splitRows: ['GP4'], splitCols: ['GP5'] },
    };
    expect(isMatrixPositionWithinConfiguredPins(configured, keys[1], keys)).toBe(true);
  });
});

describe('direct pin logical indices', () => {
  const directSettings = {
    ...settings,
    matrix: { rows: 1, cols: 3, wiring: 'direct' },
    pins: {
      rows: [],
      cols: [],
      direct: ['GP2', 'GP3', 'GP4'],
      splitDirect: ['GP6', 'GP7'],
    },
  } as unknown as ProjectSettings;

  it('resolves the same D index against the pin pool for each half', () => {
    const directKeys = [
      { id: 'left', directIndex: 1, matrixSide: 'left', x: 0, y: 0, w: 1 },
      { id: 'right', directIndex: 1, matrixSide: 'right', x: 8, y: 0, w: 1 },
    ] as PhysicalKey[];

    expect(resolveDirectPin(directSettings, directKeys[0], directKeys)).toBe('GP3');
    expect(resolveDirectPin(directSettings, directKeys[1], directKeys)).toBe('GP7');
    expect(getDirectLocalMatrixPosition(directSettings, directKeys[1], directKeys)).toEqual({ row: 0, col: 1 });
  });

  it('keeps direct dimensions wide enough for the configured D slots', () => {
    const directKeys = [
      { id: 'left', directIndex: 0, matrixSide: 'left', x: 0, y: 0, w: 1 },
    ] as PhysicalKey[];

    expect(getDirectSideDimensions(directSettings, directKeys, 'left')).toMatchObject({ rows: 1, cols: 3 });
    expect(getDirectSideDimensions(directSettings, directKeys, 'right')).toMatchObject({ rows: 1, cols: 2 });
  });
});

describe('isMatrixSwitchKey', () => {
  it('includes normal keys and excludes encoders, trackballs, and decals', () => {
    expect(isMatrixSwitchKey({})).toBe(true);
    expect(isMatrixSwitchKey({ kind: 'key' })).toBe(true);
    expect(isMatrixSwitchKey({ kind: 'encoder' })).toBe(false);
    expect(isMatrixSwitchKey({ encoderIndex: 0 })).toBe(false);
    expect(isMatrixSwitchKey({ kind: 'trackball' })).toBe(false);
    expect(isMatrixSwitchKey({ trackballIndex: 0 })).toBe(false);
    expect(isMatrixSwitchKey({ decal: true })).toBe(false);
  });
});
