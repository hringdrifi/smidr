import { PhysicalKey } from '@/types/keyboard';
import { parseKeyboardDefinition } from './parser';
import { roundCoord } from './canvas-utils';

/**
 * Legacy wrapper for the new unified parser.
 * Now supports VIA/Vial definitions as well as raw KLE JSON.
 */
export const parseKLE = (json: any): PhysicalKey[] => {
  const result = parseKeyboardDefinition(json);
  return result.keys;
};

/**
 * Basic KLE JSON exporter. (Keeping original for now)
 */
export const exportKLE = (keys: PhysicalKey[]): any[] => {
  // ... original export code ...

  const result: any[] = [];
  
  // Sort keys to maintain stateful row-by-row structure
  const sortedKeys = [...keys].sort((a, b) => {
    if (a.ry !== b.ry) return a.ry - b.ry;
    if (a.rx !== b.rx) return a.rx - b.rx;
    if (Math.abs(a.y - b.y) > 0.1) return a.y - b.y;
    return a.x - b.x;
  });

  let curX = 0, curY = 0, curRX = 0, curRY = 0, curR = 0;
  let currentRow: any[] = [];

  sortedKeys.forEach((key) => {
    const props: any = {};
    let propsChanged = false;

    // Determine if we need a row break
    const rotationChanged = key.r !== curR || key.rx !== curRX || key.ry !== curRY;
    const yDrifted = Math.abs(key.y - curY) > 0.1;

    if (rotationChanged || yDrifted || currentRow.length === 0) {
      if (currentRow.length > 0) {
        result.push(currentRow);
        currentRow = [];
        curY += 1;
        curX = curRX;
      }

      if (key.r !== curR) { props.r = key.r; curR = key.r; propsChanged = true; }
      if (key.rx !== curRX) { 
        props.rx = key.rx; 
        curRX = key.rx; 
        curX = curRX; 
        curY = curRY; 
        propsChanged = true; 
      }
      if (key.ry !== curRY) { 
        props.ry = key.ry; 
        curRY = key.ry; 
        curY = curRY; 
        curX = curRX; 
        propsChanged = true; 
      }
    }

    const dx = key.x - curX;
    const dy = key.y - curY;

    if (Math.abs(dx) > 0.001) { props.x = roundCoord(dx); propsChanged = true; }
    if (Math.abs(dy) > 0.001) { props.y = roundCoord(dy); propsChanged = true; }

    if (key.w !== 1) { props.w = key.w; propsChanged = true; }
    if (key.h !== 1) { props.h = key.h; propsChanged = true; }
    if (key.w2 !== undefined && key.w2 !== key.w) { props.w2 = key.w2; propsChanged = true; }
    if (key.h2 !== undefined && key.h2 !== key.h) { props.h2 = key.h2; propsChanged = true; }
    if (key.x2 !== undefined && key.x2 !== 0) { props.x2 = key.x2; propsChanged = true; }
    if (key.y2 !== undefined && key.y2 !== 0) { props.y2 = key.y2; propsChanged = true; }
    if (key.stepped) { props.l = true; propsChanged = true; }

    if (propsChanged) currentRow.push(props);
    currentRow.push(key.label || '');

    curX = key.x + key.w;
    curY = key.y;
  });

  if (currentRow.length > 0) result.push(currentRow);
  return result;
};
