import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

export type MatrixSide = 'left' | 'right';
export type MatrixPosition = { row: number; col: number };

export const isDirectPinMatrix = (settings: ProjectSettings) => settings.matrix?.wiring === 'direct';

export const isMatrixSwitchKey = (
  key: Pick<PhysicalKey, 'decal' | 'kind' | 'encoderId' | 'encoderIndex' | 'trackballId' | 'trackballIndex'>
) => !key.decal
  && key.kind !== 'encoder'
  && key.kind !== 'trackball'
  && !key.encoderId
  && key.encoderIndex === undefined
  && !key.trackballId
  && key.trackballIndex === undefined;

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

export const isMatrixPositionWithinConfiguredPins = (
  settings: ProjectSettings,
  key: Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'w'>,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): boolean => {
  const local = getLocalMatrixPosition(settings, key, keys);
  if (!local || local.row < 0 || local.col < 0) return false;

  const isRight = settings.features.split && local.side === 'right';
  const rowPins = isRight ? settings.pins.splitRows || [] : settings.pins.rows;
  const colPins = isRight ? settings.pins.splitCols || [] : settings.pins.cols;
  return !!rowPins[local.row] && !!colPins[local.col];
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

type DirectKey = Pick<PhysicalKey, 'row' | 'col' | 'matrixSide' | 'x' | 'y' | 'w' | 'id' | 'directIndex' | 'directPin'>;

export const getDirectPinPool = (
  settings: ProjectSettings,
  side: MatrixSide
): string[] => (
  settings.features.split && side === 'right'
    ? settings.pins.splitDirect || []
    : settings.pins.direct || []
);

export const getDirectPinIndex = (
  settings: ProjectSettings,
  key: DirectKey,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): number | undefined => {
  if (Number.isInteger(key.directIndex) && key.directIndex! >= 0) return key.directIndex;
  if (!key.directPin) return undefined;
  const side = getDirectMatrixSide(settings, key, keys);
  const index = getDirectPinPool(settings, side).indexOf(key.directPin);
  return index >= 0 ? index : undefined;
};

export const resolveDirectPin = (
  settings: ProjectSettings,
  key: DirectKey,
  keys: Array<Pick<PhysicalKey, 'x' | 'w'>> = []
): string | undefined => {
  const index = getDirectPinIndex(settings, key, keys);
  if (index !== undefined) return getDirectPinPool(settings, getDirectMatrixSide(settings, key, keys))[index] || undefined;
  return key.directPin?.trim() || undefined;
};

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
  key: DirectKey,
  keys: DirectKey[] = []
): MatrixPosition | undefined => {
  const directIndex = getDirectPinIndex(settings, key, keys);
  if (directIndex !== undefined) return { row: 0, col: directIndex };
  if (hasMatrixPosition(key)) {
    return { row: key.row!, col: key.col! };
  }

  const side = getDirectMatrixSide(settings, key, keys);
  const sideKeys = keys.filter(k => getDirectMatrixSide(settings, k, keys) === side);
  const directKeys = sortDirectKeys(sideKeys.filter(k => k.directIndex !== undefined || k.directPin || !hasMatrixPosition(k)));
  const index = directKeys.findIndex(k => (key.id && k.id === key.id) || k === key);
  if (index < 0) return undefined;
  return { row: 0, col: index };
};

export const getDirectSideDimensions = (
  settings: ProjectSettings,
  keys: DirectKey[],
  side: MatrixSide
): ProjectSettings['matrix'] => {
  const sideKeys = keys.filter(key => getDirectMatrixSide(settings, key, keys) === side);
  const positions = sideKeys
    .map(key => getDirectLocalMatrixPosition(settings, key, keys))
    .filter((pos): pos is MatrixPosition => !!pos);
  const poolSize = getDirectPinPool(settings, side).length;
  const dimensions = getMatrixDimensionsFromPositions(positions, {
    rows: positions.length > 0 || poolSize > 0 ? 1 : 0,
    cols: poolSize,
    wiring: settings.matrix?.wiring,
  });
  return { ...dimensions, cols: Math.max(dimensions.cols, poolSize) };
};

export const getDirectMatrixPosition = (
  settings: ProjectSettings,
  key: DirectKey,
  keys: DirectKey[] = []
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
  key: DirectKey,
  keys: DirectKey[] = []
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
