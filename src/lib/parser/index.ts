import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { parseKLEData } from './kle-logic';

const labelMap = [
  // 0  1  2  3  4  5  6  7  8  9 10 11   # align flags
  [ 0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10], // 0 = no centering
  [ 1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10], // 1 = center x
  [ 3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10], // 2 = center y
  [ 4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10], // 3 = center x & y
  [ 0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1], // 4 = center front (default)
  [ 1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1], // 5 = center front & x
  [ 3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1], // 6 = center front & y
  [ 4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1], // 7 = center front & x & y
];

function reorderLabels(parts: string[], align: number): (string | null)[] {
  const ret: (string | null)[] = new Array(12).fill(null);
  const map = labelMap[align] || labelMap[4];
  for (let i = 0; i < parts.length; i++) {
    const logicalIdx = map[i];
    if (logicalIdx !== undefined && logicalIdx !== -1) {
      ret[logicalIdx] = parts[i];
    }
  }
  return ret;
}

/**
 * Unified parser for Keyboard definitions (KLE, VIA, Vial).
 */
export function parseKeyboardDefinition(input: any, options?: { debug?: boolean }): { 
  keys: PhysicalKey[], 
  name?: string,
  vendorProductId?: number,
  layoutOptions?: ProjectSettings['layoutOptions']
} {
  const isDebug = options?.debug;
  if (isDebug) console.log('[Parser] Starting unified parse...');
  let rawKLE: any[][] = [];
  let name: string | undefined;
  let vendorProductId: number | undefined;
  let layoutOptions: ProjectSettings['layoutOptions'] = {};

  // 1. Detect format
  if (!input) {
    throw new Error("Empty input provided to parser");
  }

  if (Array.isArray(input)) {
    if (isDebug) console.log('[Parser] Detected Format: Raw KLE Array');
    
    // Check if first element is metadata
    const first = input[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      if (isDebug) console.log('[Parser] Extracting metadata from first element:', first);
      name = first.name || first.kbName;
      if (first.vendorProductId) {
        vendorProductId = first.vendorProductId;
      } else if (first.vid && first.pid) {
        vendorProductId = (parseInt(String(first.vid), 16) << 16) | parseInt(String(first.pid), 16);
      }
      rawKLE = input.slice(1);
    } else {
      rawKLE = input;
    }
  } else if (typeof input === 'object') {
    if (isDebug) console.log('[Parser] Detected Format: VIA/Vial Object');
    // VIA/Vial Definition
    if (input.layouts && input.layouts.keymap) {
      if (typeof input.layouts.keymap === 'string') {
        try {
          rawKLE = JSON.parse(input.layouts.keymap);
        } catch (e) {
          throw new Error(`Failed to parse KLE string inside VIA definition: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        rawKLE = input.layouts.keymap;
      }
      name = input.name;
      vendorProductId = input.vendorProductId;
      
      // Parse layout options from VIA labels
      if (input.layouts.labels) {
        input.layouts.labels.forEach((label: any, idx: number) => {
          const groupId = idx.toString();
          if (Array.isArray(label)) {
            const [groupName, ...choices] = label;
            layoutOptions[groupId] = {
              name: groupName,
              type: 'list',
              choices: choices
            };
          } else if (typeof label === 'string') {
            layoutOptions[groupId] = {
              name: label,
              type: 'toggle'
            };
          }
        });
      }
    } else {
      throw new Error("Invalid keyboard definition: 'layouts.keymap' property is missing.");
    }
  } else {
    throw new Error(`Unsupported input format: ${typeof input}. Expected Array or Object.`);
  }

  // 2. Parse KLE
  if (isDebug) console.log('[Parser] Parsing KLE data rows:', rawKLE.length);
  const parsedKeys = parseKLEData(rawKLE, { debug: isDebug });

  // 3. Convert to Smiðr PhysicalKey format
  const keys: PhysicalKey[] = parsedKeys.map((pk, i) => {
    const id = crypto.randomUUID();
    
    // Base key properties
    let w = pk.w || 1;
    let h = pk.h || 1;
    let w2 = pk.w2;
    let h2 = pk.h2;
    let x2 = pk.x2;
    let y2 = pk.y2;

    const key: PhysicalKey = {
      id,
      x: pk.x,
      y: pk.y,
      w,
      h,
      r: pk.r || 0,
      rx: pk.rx ?? pk.x,
      ry: pk.ry ?? pk.y,
      label: pk.label,
      w2,
      h2,
      x2,
      y2,
      stepped: pk.stepped,
      keymap: {}
    };
    
    // Extract matrix info
    if (pk.matrixRow !== undefined && pk.matrixCol !== undefined) {
      key.row = pk.matrixRow;
      key.col = pk.matrixCol;
    }
    
    // Layout Options mapping
    if (pk.optionGroup !== undefined) {
      key.group = pk.optionGroup.toString();
      key.option = pk.optionChoice;
    }

    if (pk.decal) key.decal = true;
    if (pk.encoderIndex !== undefined) key.encoderIndex = pk.encoderIndex;

    return key;
  });

  // 4. Ensure all groups in keys exist in layoutOptions to prevent keys from being hidden
  keys.forEach(k => {
    if (k.group && !layoutOptions[k.group]) {
      if (isDebug) console.log(`[Parser] Auto-creating layout group ${k.group} found in keys`);
      layoutOptions[k.group] = {
        name: `Group ${k.group}`,
        type: 'list',
        choices: ['Option 0', 'Option 1', 'Option 2', 'Option 3'] // Fallback choices
      };
    }
  });

  return { 
    keys, 
    name, 
    vendorProductId, 
    layoutOptions
  };
}
