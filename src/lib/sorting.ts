import { PhysicalKey } from '@/types/keyboard';

const num = (v: any): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Sorts keys primarily by Y and secondarily by X, 
 * with a tolerance for Y coordinates to handle staggered layouts.
 */
export const sortKeys = (keys: PhysicalKey[], threshold: number): PhysicalKey[] => {
  if (keys.length === 0) return [];

  // 1. Sort all keys by Y coordinate first to group them
  const sortedByY = [...keys].sort((a, b) => num(a.y) - num(b.y));

  const rows: PhysicalKey[][] = [];
  let currentRow: PhysicalKey[] = [];

  if (sortedByY.length > 0) {
    currentRow.push(sortedByY[0]);
    
    for (let i = 1; i < sortedByY.length; i++) {
      const prev = sortedByY[i - 1];
      const curr = sortedByY[i];

      // If the difference in Y is within threshold, consider them the same "row"
      if (Math.abs(num(curr.y) - num(prev.y)) <= threshold) {
        currentRow.push(curr);
      } else {
        // Sort the completed row by X coordinate (Left to Right)
        currentRow.sort((a, b) => num(a.x) - num(b.x));
        rows.push(currentRow);
        currentRow = [curr];
      }
    }
    
    // Don't forget the last row
    currentRow.sort((a, b) => num(a.x) - num(b.x));
    rows.push(currentRow);
  }

  // Flatten the rows back into a single array
  return rows.flat();
};
