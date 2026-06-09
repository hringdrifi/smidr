import { PhysicalKey } from '@/types/keyboard';
import { getKeyVertices, getVisualCenter, UNIT } from './canvas-utils';

export const getRgbMatrixBounds = (keys: PhysicalKey[]) => {
  if (keys.length === 0) return { minX: 0, minY: 0, width: 1, height: 1 };

  const vertices = keys.flatMap(key => getKeyVertices(key).map(point => ({
    x: point.x / UNIT,
    y: point.y / UNIT,
  })));

  const minX = Math.min(...vertices.map(point => point.x));
  const maxX = Math.max(...vertices.map(point => point.x));
  const minY = Math.min(...vertices.map(point => point.y));
  const maxY = Math.max(...vertices.map(point => point.y));

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
};

export const getRgbMatrixLedPosition = (
  key: PhysicalKey,
  bounds: ReturnType<typeof getRgbMatrixBounds>
) => {
  const center = getVisualCenter(key);
  const centerX = center.x / UNIT;
  const centerY = center.y / UNIT;

  return {
    ledX: Math.round(((centerX - bounds.minX) / bounds.width) * 224),
    ledY: Math.round(((centerY - bounds.minY) / bounds.height) * 64),
  };
};
