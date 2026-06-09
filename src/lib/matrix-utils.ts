import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

export type MatrixSide = 'left' | 'right';
export type MatrixPosition = { row: number; col: number };

export const isDirectPinMatrix = (settings: ProjectSettings) => settings.matrix?.wiring === 'direct';

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
): MatrixPosition | undefined => {
  const local = getLocalMatrixPosition(settings, key, keys);
  if (!local) return undefined;
  if (!settings.features.split) return { row: local.row, col: local.col };

  const leftRows = settings.pins.rows.length;
  return {
    row: local.side === 'right' ? local.row + leftRows : local.row,
    col: local.col,
  };
};

const hasMatrixPosition = (key: Pick<PhysicalKey, 'row' | 'col'>) => (
  key.row !== undefined &&
  key.col !== undefined &&
  key.row >= 0 &&
  key.col >= 0
);

export const getDirectMatrixSide = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'matrixSide' | 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): MatrixSide => (
  settings.features.split
    ? key.matrixSide || inferMatrixSideFromGeometry(key, keys)
    : 'left'
);

const sortDirectKeys = <T extends Pick<PhysicalKey, 'row' | 'col' | 'x' | 'y' | 'w'>>(keys: T[]) => (
  [...keys].sort((a, b) => {
    const aHasMatrix = hasMatrixPosition(a);
    const bHasMatrix = hasMatrixPosition(b);
    if (aHasMatrix && bHasMatrix) return (a.row! - b.row!) || (a.col! - b.col!);
    if (aHasMatrix) return -1;
    if (bHasMatrix) return 1;
    const dy = (a.y ?? 0) - (b.y ?? 0);
    if (Math.abs(dy) > 0.25) return dy;
    return (a.x ?? 0) - (b.x ?? 0);
  })
);

export const getDirectLocalMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>,
  keys: Array<Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>> = []
): MatrixPosition | undefined => {
  if (hasMatrixPosition(key)) {
    return { row: key.row!, col: key.col! };
  }

  const side = getDirectMatrixSide(settings, key, keys);
  const sideKeys = keys.filter(k => getDirectMatrixSide(settings, k, keys) === side);
  const directKeys = sortDirectKeys(sideKeys.filter(k => k.directPin || !hasMatrixPosition(k)));
  const index = directKeys.findIndex(k => (key.id && k.id === key.id) || k === key);
  if (index < 0) return undefined;
  return { row: 0, col: index };
};

export const getDirectSideDimensions = (
  settings: ProjectSettings,
  keys: Array<Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>>,
  side: MatrixSide
): ProjectSettings['matrix'] => {
  const sideKeys = keys.filter(key => getDirectMatrixSide(settings, key, keys) === side);
  const positions = sideKeys
    .map(key => getDirectLocalMatrixPosition(settings, key, keys))
    .filter((pos): pos is MatrixPosition => !!pos);
  return getMatrixDimensionsFromPositions(positions, { rows: positions.length > 0 ? 1 : 0, cols: 0, wiring: settings.matrix?.wiring });
};

export const getDirectMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>,
  keys: Array<Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>> = []
): MatrixPosition | undefined => {
  const local = getDirectLocalMatrixPosition(settings, key, keys);
  if (!local) return undefined;
  if (!settings.features.split) return local;

  const side = getDirectMatrixSide(settings, key, keys);
  const leftRows = getDirectSideDimensions(settings, keys, 'left').rows || 0;
  return {
    row: side === 'right' ? local.row + leftRows : local.row,
    col: local.col,
  };
};

export const getFirmwareMatrixPosition = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>,
  keys: Array<Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directPin'>> = []
): MatrixPosition | undefined => (
  isDirectPinMatrix(settings)
    ? getDirectMatrixPosition(settings, key, keys)
    : getQmkMatrixPosition(settings, key, keys)
);

export const getMatrixDimensionsFromPositions = (
  positions: MatrixPosition[],
  fallback: ProjectSettings['matrix'] = { rows: 0, cols: 0 }
): ProjectSettings['matrix'] => {
  const keyRows = positions.length > 0 ? Math.max(...positions.map(pos => pos.row)) + 1 : 0;
  const keyCols = positions.length > 0 ? Math.max(...positions.map(pos => pos.col)) + 1 : 0;
  return {
    ...fallback,
    rows: Math.max(fallback.rows || 0, keyRows),
    cols: Math.max(fallback.cols || 0, keyCols),
  };
};
