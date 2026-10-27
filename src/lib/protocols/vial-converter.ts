import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

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

function parseIdNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const text = String(value).trim();
  if (!text) return undefined;

  const parsed = text.toLowerCase().startsWith('0x')
    ? parseInt(text.slice(2), 16)
    : /^[0-9a-f]+$/i.test(text)
    ? parseInt(text, 16)
    : parseInt(text, 10);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getVendorProductId(vialJson: any): number {
  const vid = parseIdNumber(vialJson.vendorId) ?? 0;
  const pid = parseIdNumber(vialJson.productId) ?? 0;
  return (vid << 16) | pid;
}

export function unpackLayoutOptions(options: number, labels: any[]): Record<number, number> {
  const values: Record<number, number> = {};
  let bits = options.toString(2).padStart(100, '0');
  
  // VIA stores option choices backwards
  for (let i = labels.length - 1; i >= 0; i--) {
    const item = labels[i];
    let sz = 1;
    if (Array.isArray(item)) {
      // SelectChoice: [label, opt1, opt2, ...]
      const numOptions = item.length - 1;
      sz = Math.max(1, (numOptions - 1).toString(2).length);
    }
    const valStr = bits.slice(-sz);
    values[i] = parseInt(valStr, 2) || 0;
    bits = bits.slice(0, -sz);
  }
  return values;
}

export function packLayoutOptions(values: Record<string, number>, labels: any[]): number {
  let mask = 0;
  for (let i = 0; i < labels.length; i++) {
    const item = labels[i];
    let sz = 1;
    if (Array.isArray(item)) {
      const numOptions = item.length - 1;
      sz = Math.max(1, (numOptions - 1).toString(2).length);
    }
    const val = values[i.toString()] || 0;
    mask = (mask << sz) | val;
  }
  return mask >>> 0; // Return as unsigned 32-bit
}

export function convertVialToSmidr(vialJson: any, layoutOptions: number = 0): { keys: PhysicalKey[], settings: Partial<ProjectSettings> } {
  const keys: PhysicalKey[] = [];
  
  const rows = vialJson.layouts?.keymap || [];
  const labelsList = vialJson.layouts?.labels || [];
  const currentOptionsRaw = unpackLayoutOptions(layoutOptions, labelsList);
  
  // Convert definitions to Smiðr format
  const layoutOptionSettings: Record<string, { name: string, type: 'toggle' | 'list', choices?: string[] }> = {};
  const activeOptions: Record<string, number> = {};
  
  labelsList.forEach((label: any, idx: number) => {
    const id = idx.toString();
    if (typeof label === 'string') {
      layoutOptionSettings[id] = { name: label, type: 'toggle' };
    } else if (Array.isArray(label)) {
      const [name, ...choices] = label;
      layoutOptionSettings[id] = { name, type: 'list', choices };
    }
    activeOptions[id] = currentOptionsRaw[idx] || 0;
  });

  const currentOptions = currentOptionsRaw;
  console.log('Vial Converter: Current Unpacked Options:', activeOptions);
  
  // KLE State
  let currentX = 0;
  let currentY = 0;
  let currentW = 1;
  let currentH = 1;
  let rotationX = 0;
  let rotationY = 0;
  let rotationAngle = 0;
  let align = 4;
  let keyCount = 0;
  let currentDecal = false;
  let currentW2: number | undefined = undefined;
  let currentH2: number | undefined = undefined;
  let currentX2: number | undefined = undefined;
  let currentY2: number | undefined = undefined;
  let skippedOptions = 0;
  let skippedNoMatrix = 0;
  let skippedDecals = 0;

  const allRawKeys: any[] = [];

  try {
    rows.forEach((row: any) => {
      if (Array.isArray(row)) {
        row.forEach((item: any) => {
          if (typeof item === 'string') {
            // It's a key
            const parts = item.split('\n');
            const logicalLabels = reorderLabels(parts, align);
            
            // Extract matrix coordinates (Label 0)
            let r = -1, c = -1;
            const matrixLabel = logicalLabels[0];
            if (matrixLabel && matrixLabel.includes(',')) {
              const [tr, tc] = matrixLabel.split(',').map(Number);
              if (!isNaN(tr) && !isNaN(tc)) {
                r = tr; c = tc;
              }
            }

            // Extract layout option (Label 8)
            let g = undefined, o = undefined;
            const optionLabel = logicalLabels[8];
            if (optionLabel && optionLabel.includes(',')) {
              const [idx, opt] = optionLabel.split(',').map(Number);
              if (!isNaN(idx) && !isNaN(opt)) {
                g = idx; o = opt;
              }
            }

            // Add to raw keys list regardless of matching
            allRawKeys.push({
              x: currentX,
              y: currentY,
              w: currentW,
              h: currentH,
              r: rotationAngle,
              rx: rotationX,
              ry: rotationY,
              w2: currentW2,
              h2: currentH2,
              x2: currentX2,
              y2: currentY2,
              decal: currentDecal,
              matrix: r !== -1 && c !== -1 ? { row: r, col: c } : null,
              group: g,
              option: o
            });

            // ALWAYS advance currentX for every key in the stream
            currentX += currentW;
            currentW = 1;
            currentH = 1;
            currentW2 = undefined; currentH2 = undefined; currentX2 = undefined; currentY2 = undefined;
            currentDecal = false; // Reset for next key
          } else {
            // It's a property object
            if (item.r !== undefined) rotationAngle = item.r;
            if (item.rx !== undefined) {
              rotationX = item.rx;
              currentX = rotationX;
              currentY = rotationY;
            }
            if (item.ry !== undefined) {
              rotationY = item.ry;
              currentX = rotationX;
              currentY = rotationY;
            }
            if (item.a !== undefined) align = item.a;
            if (item.x !== undefined) currentX += item.x;
            if (item.y !== undefined) currentY += item.y;
            if (item.w !== undefined) currentW = item.w;
            if (item.h !== undefined) currentH = item.h;
            if (item.w2 !== undefined) currentW2 = item.w2;
            if (item.h2 !== undefined) currentH2 = item.h2;
            if (item.x2 !== undefined) currentX2 = item.x2;
            if (item.y2 !== undefined) currentY2 = item.y2;
            if (item.d !== undefined) currentDecal = item.d;
          }
        });
        // End of row
        currentY += 1;
        currentX = rotationX;
        currentW = 1; currentH = 1;
        currentW2 = undefined; currentH2 = undefined; currentX2 = undefined; currentY2 = undefined;
      }
    });
  } catch (err) {
    console.error('Vial Converter Error:', err);
  }

  // ALIGNMENT PASS (VIA/Vial Style)
  const groupMinX: Record<number, Record<number, number>> = {};
  const groupMinY: Record<number, Record<number, number>> = {};

  allRawKeys.forEach(k => {
    if (k.group !== undefined && k.option !== undefined) {
      const g = k.group;
      const o = k.option;
      if (!groupMinX[g]) groupMinX[g] = {};
      if (!groupMinY[g]) groupMinY[g] = {};
      
      groupMinX[g][o] = Math.min(groupMinX[g][o] ?? Infinity, k.x);
      groupMinY[g][o] = Math.min(groupMinY[g][o] ?? Infinity, k.y);
    }
  });

  // Apply shifts to all keys
  allRawKeys.forEach(k => {
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
        k.x -= dx;
        k.y -= dy;
        // Shift rotation origin if they were key-specific
        if (k.rx !== undefined) k.rx -= dx;
        if (k.ry !== undefined) k.ry -= dy;
      }
    }
  });

  // FILTER AND FINALIZE
  allRawKeys.forEach(k => {
    if (k.decal) {
      skippedDecals++;
    } else {
      keyCount++;
      if (!k.matrix) skippedNoMatrix++;
      keys.push({
        id: crypto.randomUUID(),
        row: k.matrix?.row,
        col: k.matrix?.col,
        x: k.x,
        y: k.y,
        w: k.w,
        h: k.h,
        r: k.r,
        rx: k.rx,
        ry: k.ry,
        w2: k.w2,
        h2: k.h2,
        x2: k.x2,
        y2: k.y2,
        label: '',
        group: k.group?.toString(),
        option: k.option
      });
    }
  });

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  console.log(`Vial Converter: Finished. Added ${keys.length} keys.`);
  console.log(`Vial Converter: Skipped ${skippedOptions} options, ${skippedDecals} decals, ${skippedNoMatrix} non-matrix.`);
  
  keys.forEach(k => {
    minX = Math.min(minX, k.x); maxX = Math.max(maxX, k.x + k.w);
    minY = Math.min(minY, k.y); maxY = Math.max(maxY, k.y + k.h);
  });

  console.log(`Vial Converter: Coordinate Range - X: [${minX.toFixed(2)}, ${maxX.toFixed(2)}], Y: [${minY.toFixed(2)}, ${maxY.toFixed(2)}]`);

  if (keys.length > 0) {
    console.log('Vial Converter: Sample Keys (First 10):');
    keys.slice(0, 10).forEach(k => {
      console.log(`  Pos: (${k.x.toFixed(2)}, ${k.y.toFixed(2)}) | Matrix: ${k.row !== undefined ? `${k.row},${k.col}` : 'None'}`);
    });
  }
  
  // Update debug console once at the end
  if (typeof window !== 'undefined' && (window as any).setAppDebug) {
    (window as any).setAppDebug({
      type: 'import',
      raw: vialJson,
      parsed: { keys: keys.length, name: vialJson.name }
    });
    
    (window as any).setAppDebug({
      type: 'live',
      layoutOptions,
      decodedOptions: currentOptions,
      vialLabels: labelsList
    });
  }

  return {
    keys,
    settings: {
      name: vialJson.name || 'Imported Vial Keyboard',
      vendorProductId: getVendorProductId(vialJson),
      matrix: vialJson.matrix || { rows: 0, cols: 0 },
      layoutOptions: layoutOptionSettings,
      activeOptions: activeOptions
    }
  };
}
