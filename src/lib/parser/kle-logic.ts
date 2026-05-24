// src/lib/parser/kle-logic.ts
import { roundCoord, roundRot } from '../canvas-utils';
import { KLEItem, ParsedKey } from './types';

const ENCODER_REGEX = /^[eE](\d+)\s*$/;
const LED_REGEX = /^[lL](\d+)\s*$/;

// KLE alignment map for labels
const alignmentArr = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10], // 0 = no centering
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10], // 1 = center x
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10], // 2 = center y
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10], // 3 = center x & y
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1], // 4 = center front (default)
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1], // 5 = center front & x
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1], // 6 = center front & y
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1], // 7 = center front & x & y
];

function normalizeLabels(labels: string, a: number = 0): string[] {
  const normalized: string[] = [];
  const labelArr = labels.split('\n');
  labelArr.forEach((label, idx) => {
    const targetIdx = alignmentArr[a] && alignmentArr[a][idx] !== undefined ? alignmentArr[a][idx] : -1;
    if (targetIdx !== -1) {
      normalized[targetIdx] = label.trim();
    }
  });
  return normalized;
}

function parsePair(pair: string): [number, number] | null {
  if (!pair) return null;
  const parts = pair.split(/[，,]/);
  if (parts.length !== 2) return null;
  const r = parseInt(parts[0], 10);
  const c = parseInt(parts[1], 10);
  if (isNaN(r) || isNaN(c)) return null;
  return [r, c];
}

/**
 * Ported from @the-via/reader kle-parser.ts
 */
export function parseKLEData(json: any[][], options?: { debug?: boolean }): ParsedKey[] {
  const isDebug = options?.debug;
  const result: ParsedKey[] = [];
  
  if (isDebug) console.log('[KLE-Logic] Starting parse with', json.length, 'entries');
  
  // Pen state
  let x = 0, y = 0;
  let rx = 0, ry = 0, r = 0;
  let w = 1, h = 1, w2 = 1, h2 = 1, x2 = 0, y2 = 0;
  let c = '#cccccc', t = '#000000', a = 0;
  let decal = false;

  json.forEach((row, rowIdx) => {
    if (!Array.isArray(row)) {
      if (isDebug) console.log(`[KLE-Logic] Skipping non-array entry at index ${rowIdx}:`, row);
      return;
    }

    if (isDebug) console.log(`[KLE-Logic] Processing row ${rowIdx}, items:`, row.length);

    // At the start of a row, x resets to rx
    x = 0;

    row.forEach((item: KLEItem, itemIdx) => {
      if (typeof item === 'string') {
        const normalizedLabels = normalizeLabels(item, a);
        
        // Extract matrix/encoder/option data from labels
        // Label 0: Matrix Row,Col or Option Group,Choice
        // Label 4: Encoder Index (e0, e1...)
        // Label 6: LED Index (l0, l1...)
        // Label 8: Option Group,Choice (alternative)
        
        const key: ParsedKey = {
          label: item,
          x: roundCoord(rx + x),
          y: roundCoord(ry + y),
          w: roundCoord(w),
          h: roundCoord(h),
          rx: roundCoord(rx),
          ry: roundCoord(ry),
          r: roundRot(r),
          color: c,
          textColor: t,
        };

        if (x2 !== 0 || y2 !== 0 || w2 !== w || h2 !== h) {
          if (isDebug) console.log(`[KLE-Logic] Secondary shape detected for "${item}":`, { w, h, w2, h2, x2, y2 });
          key.x2 = roundCoord(x2);
          key.y2 = roundCoord(y2);
          key.w2 = roundCoord(w2);
          key.h2 = roundCoord(h2);
        }
        if (decal) key.decal = true;

        // Data extraction
        const rowColPair = parsePair(normalizedLabels[0]);
        if (rowColPair) {
          key.matrixRow = rowColPair[0];
          key.matrixCol = rowColPair[1];
        }

        const encoderMatch = normalizedLabels[4]?.match(ENCODER_REGEX);
        if (encoderMatch) key.encoderIndex = parseInt(encoderMatch[1], 10);

        const ledMatch = normalizedLabels[6]?.match(LED_REGEX);
        if (ledMatch) key.ledIndex = parseInt(ledMatch[1], 10);

        const groupChoicePair = parsePair(normalizedLabels[8]);
        if (groupChoicePair) {
          key.optionGroup = groupChoicePair[0];
          key.optionChoice = groupChoicePair[1];
        }

        result.push(key);

        // Advance cursor
        x += w;
        // Reset per-key properties
        w = 1; h = 1; w2 = 1; h2 = 1; x2 = 0; y2 = 0;
        decal = false;
      } else {
        // Property object
        if (isDebug) console.log(`[KLE-Logic] Row ${rowIdx}, Item ${itemIdx}: Updating properties`, item);
        if (item.r !== undefined) r = item.r;
        if (item.rx !== undefined) { rx = item.rx; x = 0; y = 0; }
        if (item.ry !== undefined) { ry = item.ry; y = 0; x = 0; }
        
        if (item.x !== undefined) x += item.x;
        if (item.y !== undefined) y += item.y;
        
        if (item.w !== undefined) { w = item.w; w2 = item.w; }
        if (item.h !== undefined) { h = item.h; h2 = item.h; }
        if (item.w2 !== undefined) w2 = item.w2;
        if (item.h2 !== undefined) h2 = item.h2;
        if (item.x2 !== undefined) x2 = item.x2;
        if (item.y2 !== undefined) y2 = item.y2;
        
        if (item.c !== undefined) c = item.c;
        if (item.t !== undefined) t = item.t;
        if (item.a !== undefined) a = item.a;
        if (item.d !== undefined) decal = item.d;
      }
    });

    // Row increment
    y += 1;
  });

  return result;
}
