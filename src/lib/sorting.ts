import { PhysicalKey } from '@/types/keyboard';

const num = (v: any): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export const getSortPoint = (key: PhysicalKey) => {
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
 * Sorts keys into physical rows by seeding the topmost remaining key,
 * walking right while keys stay within the vertical threshold, then walking left.
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

  const byTopThenLeft = (a: PhysicalKey, b: PhysicalKey) => {
    const pa = pointFor(a);
    const pb = pointFor(b);
    return (pa.y - pb.y) || (pa.x - pb.x);
  };

  const rows: PhysicalKey[][] = [];
  const remaining = new Set(keys);

  const pickNextRight = (current: PhysicalKey) => {
    const currentPoint = pointFor(current);
    return [...remaining]
      .filter(key => {
        const point = pointFor(key);
        return point.x > currentPoint.x && Math.abs(point.y - currentPoint.y) <= threshold;
      })
      .sort((a, b) => {
        const pa = pointFor(a);
        const pb = pointFor(b);
        return (pa.x - pb.x)
          || (Math.abs(pa.y - currentPoint.y) - Math.abs(pb.y - currentPoint.y))
          || (pa.y - pb.y);
      })[0];
  };

  const pickNextLeft = (current: PhysicalKey) => {
    const currentPoint = pointFor(current);
    return [...remaining]
      .filter(key => {
        const point = pointFor(key);
        return point.x < currentPoint.x && Math.abs(point.y - currentPoint.y) <= threshold;
      })
      .sort((a, b) => {
        const pa = pointFor(a);
        const pb = pointFor(b);
        return (pb.x - pa.x)
          || (Math.abs(pa.y - currentPoint.y) - Math.abs(pb.y - currentPoint.y))
          || (pa.y - pb.y);
      })[0];
  };

  while (remaining.size > 0) {
    const seed = [...remaining].sort(byTopThenLeft)[0];
    const row = [seed];
    remaining.delete(seed);

    let current = seed;
    while (true) {
      const next = pickNextRight(current);
      if (!next) break;
      row.push(next);
      remaining.delete(next);
      current = next;
    }

    current = row[0];
    while (true) {
      const next = pickNextLeft(current);
      if (!next) break;
      row.unshift(next);
      remaining.delete(next);
      current = next;
    }

    rows.push(row);
  }

  return rows.flat();
};
