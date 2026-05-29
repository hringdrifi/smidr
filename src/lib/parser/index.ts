import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { parseKLEData } from './kle-logic';

const roundCoord = (v: number) => Math.round(v * 10000000) / 10000000;

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
  layoutOptions?: ProjectSettings['layoutOptions'],
  pins?: Partial<ProjectSettings['pins']>,
  hardware?: Partial<ProjectSettings['hardware']>,
  qmk?: Partial<ProjectSettings['qmk']>,
  features?: Partial<ProjectSettings['features']>
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
    // 1. VIA/Vial Definition
    if (input.layouts && input.layouts.keymap) {
      if (isDebug) console.log('[Parser] Detected Format: VIA/Vial Object');
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
    } else if (input.layouts && Object.values(input.layouts).some((l: any) => typeof l === 'object' && l !== null && Array.isArray(l.layout))) {
      // 2. QMK info.json Format
      if (isDebug) console.log('[Parser] Detected Format: QMK info.json');
      name = input.keyboard_name || input.name;
      if (input.usb && input.usb.vid !== undefined && input.usb.pid !== undefined) {
        const parseHexOrDec = (val: any) => {
          if (typeof val === 'number') return val;
          const s = String(val).trim();
          if (s.toLowerCase().startsWith('0x')) {
            return parseInt(s.slice(2), 16);
          }
          return parseInt(s, 10);
        };
        const vid = parseHexOrDec(input.usb.vid);
        const pid = parseHexOrDec(input.usb.pid);
        if (!isNaN(vid) && !isNaN(pid)) {
          vendorProductId = (vid << 16) | pid;
        }
      }

      // Parse QMK hardware configuration
      let pins: any = undefined;
      if (input.matrix_pins) {
        pins = {
          rows: Array.isArray(input.matrix_pins.rows) ? input.matrix_pins.rows.map(String) : [],
          cols: Array.isArray(input.matrix_pins.cols) ? input.matrix_pins.cols.map(String) : [],
        };
        
        // Parse encoder pins if present
        if (input.encoder && Array.isArray(input.encoder.rotary) && input.encoder.rotary[0]) {
          pins.encoderA = input.encoder.rotary[0].pin_a ? String(input.encoder.rotary[0].pin_a) : undefined;
          pins.encoderB = input.encoder.rotary[0].pin_b ? String(input.encoder.rotary[0].pin_b) : undefined;
        }

        // Parse RGB light pin if present
        if (input.rgblight && input.rgblight.pin) {
          pins.rgb = String(input.rgblight.pin);
        } else if (input.ws2812 && input.ws2812.pin) {
          pins.rgb = String(input.ws2812.pin);
        }
      }

      let hardware: any = undefined;
      if (input.processor || input.bootloader || input.diode_direction) {
        let mcu = 'rp2040';
        if (input.processor) {
          const proc = String(input.processor).toLowerCase();
          if (proc.includes('atmega32u4')) mcu = 'atmega32u4';
          else if (proc.includes('rp2040')) mcu = 'rp2040';
          else mcu = proc;
        }
        let board = 'promicro';
        if (input.bootloader) {
          const bl = String(input.bootloader).toLowerCase();
          if (bl.includes('pro_micro') || bl.includes('promicro')) board = 'promicro';
          else board = bl;
        }
        let diodeDirection: 'ROW2COL' | 'COL2ROW' = 'COL2ROW';
        if (input.diode_direction) {
          const dd = String(input.diode_direction).toUpperCase();
          if (dd === 'ROW2COL' || dd === 'COL2ROW') {
            diodeDirection = dd;
          }
        }
        hardware = { mcu, board, diodeDirection };
      }

      const qmk: Partial<ProjectSettings['qmk']> = {
        matrixMasked: input.matrix_pins?.masked === true,
      };

      let features: any = undefined;
      if (input.features) {
        features = {
          rgb: !!(input.features.rgblight || input.features.rgb_matrix),
          encoder: !!input.features.encoder,
          oled: !!input.features.oled,
          via: !!input.features.via,
          vial: !!input.features.vial,
        };
      }

      const layoutKey = Object.keys(input.layouts).find(k => Array.isArray(input.layouts[k]?.layout));
      if (layoutKey) {
        const qmkLayout = input.layouts[layoutKey].layout;
        const keys: PhysicalKey[] = qmkLayout.map((k: any) => {
          const id = crypto.randomUUID();
          const row = Array.isArray(k.matrix) ? k.matrix[0] : undefined;
          const col = Array.isArray(k.matrix) ? k.matrix[1] : undefined;
          return {
            id,
            x: k.x ?? 0,
            y: k.y ?? 0,
            w: k.w ?? 1,
            h: k.h ?? 1,
            r: k.r ?? 0,
            rx: k.rx ?? (k.x ?? 0),
            ry: k.ry ?? (k.y ?? 0),
            label: k.label || '',
            row,
            col,
            keymap: {}
          };
        });
        return {
          keys,
          name,
          vendorProductId,
          layoutOptions: {},
          pins,
          hardware,
          qmk,
          features
        };
      } else {
        throw new Error("Invalid QMK info.json: Layout definitions found but no layout array detected.");
      }
    } else {
      throw new Error("Invalid keyboard definition: unrecognized format (neither VIA/Vial nor QMK info.json).");
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

  // Align option choices to option 0 choice coordinates (VIA/Vial Style)
  const groupMinX: Record<string, Record<number, number>> = {};
  const groupMinY: Record<string, Record<number, number>> = {};

  keys.forEach(k => {
    if (k.group !== undefined && k.option !== undefined) {
      const g = k.group;
      const o = k.option;
      if (!groupMinX[g]) groupMinX[g] = {};
      if (!groupMinY[g]) groupMinY[g] = {};
      
      groupMinX[g][o] = Math.min(groupMinX[g][o] ?? Infinity, k.x);
      groupMinY[g][o] = Math.min(groupMinY[g][o] ?? Infinity, k.y);
    }
  });

  keys.forEach(k => {
    if (k.group !== undefined && k.option !== undefined && k.option > 0) {
      const g = k.group;
      const o = k.option;
      const minX0 = groupMinX[g]?.[0];
      const minY0 = groupMinY[g]?.[0];
      const minXo = groupMinX[g]?.[o];
      const minYo = groupMinY[g]?.[o];

      if (minX0 !== undefined && minXo !== undefined) {
        const dx = minXo - minX0;
        const dy = minYo - minY0;
        k.x = roundCoord(k.x - dx);
        k.y = roundCoord(k.y - dy);
        if (k.rx !== undefined) k.rx = roundCoord(k.rx - dx);
        if (k.ry !== undefined) k.ry = roundCoord(k.ry - dy);
      }
    }
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
