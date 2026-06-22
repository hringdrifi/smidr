import { PhysicalKey } from '@/types/keyboard';

const num = (v: any): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const getSortPoint = (key: PhysicalKey) => {
  const minX = Math.min(0, num(key.x2));
  const minY = Math.min(0, num(key.y2));
  const maxX = Math.max(num(key.w), num(key.x2) + num(key.w2 || key.w));
  const maxY = Math.max(num(key.h), num(key.y2) + num(key.h2 || key.h));
  const centerX = num(key.x) + minX + (maxX - minX) / 2;
  const centerY = num(key.y) + minY + (maxY - minY) / 2;

  const rad = (num(key.r) * Math.PI) / 180;
  const pivotX = num(key.rx);
  const pivotY = num(key.ry);
  const dx = centerX - pivotX;
  const dy = centerY - pivotY;

  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad) + pivotX,
    y: dx * Math.sin(rad) + dy * Math.cos(rad) + pivotY,
  };
};

/**
 * Sorts keys primarily by visual Y and secondarily by visual X,
 * with a tolerance for visual Y coordinates to handle staggered layouts.
 */
export const sortKeys = (keys: PhysicalKey[], threshold: number): PhysicalKey[] => {
  if (keys.length === 0) return [];

  const sortPoints = new Map<PhysicalKey, ReturnType<typeof getSortPoint>>();
  const pointFor = (key: PhysicalKey) => {
    const cached = sortPoints.get(key);
    if (cached) return cached;
    const point = getSortPoint(key);
    sortPoints.set(key, point);
    return point;
  };

  // 1. Sort all keys by visual Y coordinate first to group them.
  const sortedByY = [...keys].sort((a, b) => pointFor(a).y - pointFor(b).y);

  const rows: PhysicalKey[][] = [];
  let currentRow: PhysicalKey[] = [];

  if (sortedByY.length > 0) {
    currentRow.push(sortedByY[0]);
    
    for (let i = 1; i < sortedByY.length; i++) {
      const prev = sortedByY[i - 1];
      const curr = sortedByY[i];

      // If the visual Y difference is within threshold, consider them the same "row".
      if (Math.abs(pointFor(curr).y - pointFor(prev).y) <= threshold) {
        currentRow.push(curr);
      } else {
        // Sort the completed row by visual X coordinate (Left to Right).
        currentRow.sort((a, b) => pointFor(a).x - pointFor(b).x);
        rows.push(currentRow);
        currentRow = [curr];
      }
    }
    
    // Don't forget the last row
    currentRow.sort((a, b) => pointFor(a).x - pointFor(b).x);
    rows.push(currentRow);
  }

  // Flatten the rows back into a single array
  return rows.flat();
};
