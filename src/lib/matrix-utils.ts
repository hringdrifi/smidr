import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

export type MatrixSide = 'left' | 'right';

export const getMatrixFromPins = (
  pins: ProjectSettings['pins'],
  split = false
): ProjectSettings['matrix'] | undefined => {
  const rows = pins.rows?.length ?? 0;
  const cols = pins.cols?.length ?? 0;
  const splitRows = split ? pins.splitRows?.length ?? 0 : 0;
  const splitCols = split ? pins.splitCols?.length ?? 0 : 0;
  const effectiveRows = split ? Math.max(rows, splitRows) : rows;
  const effectiveCols = split ? Math.max(cols, splitCols) : cols;
  if (effectiveRows === 0 && effectiveCols === 0) return undefined;
  return { rows: effectiveRows, cols: effectiveCols };
};

export const getQmkMatrixFromPins = (
  pins: ProjectSettings['pins'],
  split = false
): ProjectSettings['matrix'] | undefined => {
  const rows = pins.rows?.length ?? 0;
  const cols = pins.cols?.length ?? 0;
  const splitRows = split ? pins.splitRows?.length || rows : 0;
  const splitCols = split ? pins.splitCols?.length || cols : 0;
  const effectiveRows = split ? rows + splitRows : rows;
  const effectiveCols = split ? Math.max(cols, splitCols) : cols;
  if (effectiveRows === 0 && effectiveCols === 0) return undefined;
  return { rows: effectiveRows, cols: effectiveCols };
};

const getKeyCenterX = (key: Pick<PhysicalKey, 'x' | 'w'>) => key.x + key.w / 2;

export const inferMatrixSideFromGeometry = (
  key: Pick<PhysicalKey, 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>>
): MatrixSide => {
  if (keys.length === 0) return 'left';
  const centers = keys.map(getKeyCenterX);
  const minCenter = Math.min(...centers);
  const maxCenter = Math.max(...centers);
  if (Math.abs(maxCenter - minCenter) < 0.001) return 'left';
  const splitCenter = (minCenter + maxCenter) / 2;
  return getKeyCenterX(key) >= splitCenter ? 'right' : 'left';
};

export const getLocalMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): { side?: MatrixSide; row: number; col: number } | undefined => {
  if (key.row === undefined || key.col === undefined) return undefined;
  if (!settings.features.split) return { row: key.row, col: key.col };

  const leftCols = settings.pins.cols.length;
  const side = key.matrixSide || (
    leftCols > 0 && key.col >= leftCols
      ? 'right'
      : inferMatrixSideFromGeometry(key, keys)
  );
  const col = side === 'right' && !key.matrixSide && leftCols > 0 && key.col >= leftCols
    ? key.col - leftCols
    : key.col;

  return { side, row: key.row, col };
};

export const getQmkMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): { row: number; col: number } | undefined => {
  const local = getLocalMatrixPosition(settings, key, keys);
  if (!local) return undefined;
  if (!settings.features.split) return { row: local.row, col: local.col };

  const leftRows = settings.pins.rows.length;
  return {
    row: local.side === 'right' ? local.row + leftRows : local.row,
    col: local.col,
  };
};
