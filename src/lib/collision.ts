import { Point } from '@/types/keyboard';

/**
 * Calculates vertices for a key in 1u units, accounting for rotation and multi-rectangle shapes.
 * Returns an array of polygons (arrays of points).
 */
export const getKeyPolygons = (k: any): Point[][] => {
  const getRectVertices = (x: number, y: number, w: number, h: number, r: number, rx: number, ry: number): Point[] => {
    const rad = (r * Math.PI) / 180;
    const pts = [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ];
    return pts.map(p => {
      const px = (x + p.x) - rx;
      const py = (y + p.y) - ry;
      return {
        x: px * Math.cos(rad) - py * Math.sin(rad) + rx,
        y: px * Math.sin(rad) + py * Math.cos(rad) + ry
      };
    });
  };

  const polygons: Point[][] = [];
  // Main rectangle
  polygons.push(getRectVertices(Number(k.x), Number(k.y), Number(k.w), Number(k.h), Number(k.r), Number(k.rx), Number(k.ry)));
  
  // Secondary rectangle for polygonal keys
  if (k.x2 !== undefined || k.y2 !== undefined || k.w2 !== undefined || k.h2 !== undefined) {
    const x2 = Number(k.x) + (k.x2 || 0);
    const y2 = Number(k.y) + (k.y2 || 0);
    const w2 = k.w2 || k.w;
    const h2 = k.h2 || k.h;
    polygons.push(getRectVertices(x2, y2, w2, h2, Number(k.r), Number(k.rx), Number(k.ry)));
  }
  
  return polygons;
};

/**
 * SAT collision detection between two convex polygons.
 */
export const polygonsIntersect = (poly1: Point[], poly2: Point[]): boolean => {
  const polys = [poly1, poly2];
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    for (let j = 0; j < poly.length; j++) {
      const p1 = poly[j];
      const p2 = poly[(j + 1) % poly.length];
      // Normal vector to the edge
      const axis = { x: -(p2.y - p1.y), y: p2.x - p1.x };
      
      const project = (p: Point[]) => {
        let min = Infinity, max = -Infinity;
        for (const pt of p) {
          const dot = pt.x * axis.x + pt.y * axis.y;
          min = Math.min(min, dot);
          max = Math.max(max, dot);
        }
        return { min, max };
      };

      const proj1 = project(poly1);
      const proj2 = project(poly2);

      // Add a small EPSILON to allow perfect adjacency (0.6mm edge tolerance)
      const EPSILON = 0.6 / 19.05;
      if (proj1.max <= proj2.min + EPSILON || proj2.max <= proj1.min + EPSILON) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Checks if two keys intersect.
 */
export const keysIntersect = (k1: any, k2: any): boolean => {
  const polys1 = getKeyPolygons(k1);
  const polys2 = getKeyPolygons(k2);
  for (const p1 of polys1) {
    for (const p2 of polys2) {
      if (polygonsIntersect(p1, p2)) return true;
    }
  }
  return false;
};
