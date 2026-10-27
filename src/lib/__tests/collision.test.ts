import { describe, it, expect } from 'vitest';
import { getKeyPolygons, polygonsIntersect, keysIntersect } from '../collision';

describe('Collision Detection (SAT)', () => {
  describe('getKeyPolygons', () => {
    it('should generate 4 vertices for standard 1u key', () => {
      const key = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      const polys = getKeyPolygons(key);
      expect(polys).toHaveLength(1);
      expect(polys[0]).toHaveLength(4);
      expect(polys[0]).toEqual([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]);
    });

    it('should handle rotated key vertices', () => {
      // Rotate 90 deg around pivot (rx: 0, ry: 0)
      const key = { x: 0, y: 0, w: 1, h: 1, r: 90, rx: 0, ry: 0 };
      const polys = getKeyPolygons(key);
      const vertices = polys[0];
      
      const roundPt = (p: { x: number, y: number }) => ({
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100
      });
      const roundedVertices = vertices.map(roundPt);
      expect(roundedVertices).toEqual([
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 1 },
        { x: -1, y: 0 }
      ]);
    });

    it('should generate second polygon for ISO/polygonal keys', () => {
      const key = {
        x: 0, y: 0, w: 1.5, h: 1, r: 0, rx: 0, ry: 0,
        x2: 0.25, y2: 1, w2: 1.25, h2: 1
      };
      const polys = getKeyPolygons(key);
      expect(polys).toHaveLength(2);
      expect(polys[0]).toHaveLength(4); // Main rect
      expect(polys[1]).toHaveLength(4); // Secondary rect
    });
  });

  describe('polygonsIntersect', () => {
    it('should return true for overlapping polygons', () => {
      const poly1 = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
      const poly2 = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 3 }, { x: 1, y: 3 }];
      expect(polygonsIntersect(poly1, poly2)).toBe(true);
    });

    it('should return false for non-overlapping separate polygons', () => {
      const poly1 = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      const poly2 = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
      expect(polygonsIntersect(poly1, poly2)).toBe(false);
    });

    it('should respect EPSILON and return false for perfectly adjacent edges', () => {
      // 0.6mm edge tolerance
      const poly1 = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
      const poly2 = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 1 }];
      expect(polygonsIntersect(poly1, poly2)).toBe(false);
    });
  });

  describe('keysIntersect', () => {
    it('should check if two keys overlap', () => {
      const k1 = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      const k2 = { x: 0.5, y: 0.5, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      expect(keysIntersect(k1, k2)).toBe(true);
    });

    it('should return true for rotated overlapping keys', () => {
      const k1 = { x: 0, y: 0, w: 2, h: 0.5, r: 45, rx: 0, ry: 0 };
      const k2 = { x: 0.5, y: 0.5, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      expect(keysIntersect(k1, k2)).toBe(true);
    });

    it('should return false for separate keys', () => {
      const k1 = { x: 0, y: 0, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      const k2 = { x: 2, y: 2, w: 1, h: 1, r: 0, rx: 0, ry: 0 };
      expect(keysIntersect(k1, k2)).toBe(false);
    });
  });
});
