import { describe, it, expect } from 'vitest';
import { sortKeys } from '../sorting';
import { PhysicalKey } from '../../types/keyboard';

describe('sortKeys', () => {
  it('should return empty array for empty input', () => {
    expect(sortKeys([], 0.25)).toEqual([]);
  });

  it('should sort keys left to right when they are on the exact same row (Y coordinate)', () => {
    const keys = [
      { id: '1', x: 2, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
      { id: '2', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { id: '3', x: 4, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'C' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B', 'C']);
  });

  it('should sort keys top to bottom when they are in different rows', () => {
    const keys = [
      { id: '1', x: 0, y: 2, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'C' },
      { id: '2', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { id: '3', x: 0, y: 1, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B', 'C']);
  });

  it('should group keys in the same row if Y coordinate difference is within threshold', () => {
    // Columns staggered layout where Y differs by 0.15u (within 0.25u threshold)
    const keys = [
      { id: '1', x: 1, y: 0.15, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
      { id: '2', x: 0, y: 0.0,  w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { id: '3', x: 2, y: 0.05, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'C' },
    ] as unknown as PhysicalKey[];

    // Since differences are <= 0.25u, they should all be in the same row, sorted by X: A -> B -> C
    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B', 'C']);
  });

  it('should not pull a lower-row left key into a curved upper row through Y-order chaining', () => {
    const keys = [
      { id: '1', x: 0.25, y: 0.0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Tab' },
      { id: '2', x: 0.375, y: 1.0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Caps' },
      { id: '3', x: 1.502, y: 0.003, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'Q' },
      { id: '4', x: 2.51, y: 0.063, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'W' },
      { id: '5', x: 3.509, y: 0.204, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'E' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['Tab', 'Q', 'W', 'E', 'Caps']);
  });

  it('should extend the seeded row to the left as well as the right', () => {
    const keys = [
      { id: '1', x: 1, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
      { id: '2', x: 0, y: 0.1, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
      { id: '3', x: 2, y: 0.1, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'C' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B', 'C']);
  });

  it('should separate keys into different rows if Y coordinate difference exceeds threshold', () => {
    const keys = [
      { id: '1', x: 1, y: 0.35, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
      { id: '2', x: 0, y: 0.0,  w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
    ] as unknown as PhysicalKey[];

    // With a 0.25u threshold, Y=0.0 and Y=0.35 are separate rows.
    // Row 1: A (Y=0.0)
    // Row 2: B (Y=0.35)
    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B']);
  });

  it('should sort by visual position when keys are rotated negatively', () => {
    const keys = [
      { id: '1', x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'B' },
      { id: '2', x: 1.2, y: 0, w: 1, h: 1, r: -45, rx: 0, ry: 0, label: 'A' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B']);
  });

  it('should sort by visual position when keys are rotated positively', () => {
    const keys = [
      { id: '1', x: 0, y: 0, w: 1, h: 1, r: 45, rx: 0, ry: 1, label: 'B' },
      { id: '2', x: 1.2, y: 0.2, w: 1, h: 1, r: 0, rx: 0, ry: 0, label: 'A' },
    ] as unknown as PhysicalKey[];

    const sorted = sortKeys(keys, 0.25);
    expect(sorted.map(k => k.label)).toEqual(['A', 'B']);
  });
});
