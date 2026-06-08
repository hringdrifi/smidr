import { describe, expect, it } from 'vitest';
import { createDemoProject, createDemoRemoteKeymap } from '../demo';
import { getKeyLabel, labelNodeToText } from '../canvas-utils';

describe('demo project', () => {
  it('uses per-side split matrix pins and local Corne matrix positions', () => {
    const project = createDemoProject();

    expect(project.matrix).toEqual({ rows: 4, cols: 6 });
    expect(project.pins.rows).toHaveLength(4);
    expect(project.pins.cols).toHaveLength(6);
    expect(project.pins.splitRows).toHaveLength(4);
    expect(project.pins.splitCols).toHaveLength(6);
    expect(project.encoders?.[0]).toEqual({ pinA: 'GP3', pinB: 'GP14' });

    const leftKeys = project.keys.filter(key => key.matrixSide === 'left');
    const rightKeys = project.keys.filter(key => key.matrixSide === 'right');
    expect(leftKeys.length).toBeGreaterThan(0);
    expect(rightKeys.length).toBeGreaterThan(0);
    expect(project.keys.every(key => (key.col ?? 0) >= 0 && (key.col ?? 0) < 6)).toBe(true);
    expect(project.keys.every(key => (key.row ?? 0) >= 0 && (key.row ?? 0) < 4)).toBe(true);
  });

  it('assigns the left thumb cluster to row 3 columns 3 through 5', () => {
    const project = createDemoProject();
    const leftThumbKeys = project.keys
      .filter(key => key.matrixSide === 'left')
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .slice(0, 3)
      .sort((a, b) => a.x - b.x);

    expect(leftThumbKeys.map(key => [key.row, key.col])).toEqual([[3, 3], [3, 4], [3, 5]]);
  });

  it('assigns the right thumb cluster to row 3 columns 0 through 2', () => {
    const project = createDemoProject();
    const rightThumbKeys = project.keys
      .filter(key => key.matrixSide === 'right')
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .slice(0, 3)
      .sort((a, b) => a.x - b.x);

    expect(rightThumbKeys.map(key => [key.row, key.col])).toEqual([[3, 0], [3, 1], [3, 2]]);
  });

  it('maps right-side demo keymap positions into QMK/Vial split rows', () => {
    const project = createDemoProject();
    const rightTopKey = project.keys.find(key => key.matrixSide === 'right' && key.row === 0 && key.col === 0);
    expect(rightTopKey).toBeTruthy();

    const remoteKeymap = createDemoRemoteKeymap(project.keys);
    expect(remoteKeymap[0][4 * 32]).toEqual(rightTopKey!.keymap![0]);
  });

  it('renders right-side remap labels from QMK/Vial split rows', () => {
    const project = createDemoProject();
    const remoteKeymap = createDemoRemoteKeymap(project.keys);
    const settings = { ...project, vendorProductId: project.vendorProductId ?? 0 };
    const rightHomeKey = project.keys.find(key => key.matrixSide === 'right' && key.label === 'H');
    const rightThumbKey = project.keys.find(key => key.matrixSide === 'right' && key.label === 'Enter');

    expect(rightHomeKey).toBeTruthy();
    expect(rightThumbKey).toBeTruthy();
    expect(labelNodeToText(getKeyLabel(rightHomeKey!, 'layout', 0, 'remap', remoteKeymap, project.visualLayout, settings, project.keys))).toBe('H');
    expect(labelNodeToText(getKeyLabel(rightThumbKey!, 'layout', 0, 'remap', remoteKeymap, project.visualLayout, settings, project.keys))).toBe('Enter');
  });
});
