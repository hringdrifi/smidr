import JSZip from 'jszip';
import smidrSymbolsRaw from './kicad-assets/smidr.kicad_sym?raw';
import diodeDo35Raw from './kicad-assets/smidr.pretty/D_Smidr_DO35.kicad_mod?raw';
import diodeSod123Raw from './kicad-assets/smidr.pretty/D_Smidr_SOD123.kicad_mod?raw';
import diodeSod323Raw from './kicad-assets/smidr.pretty/D_Smidr_SOD323.kicad_mod?raw';
import ledBacklightRaw from './kicad-assets/smidr.pretty/LED_Smidr_Backlight.kicad_mod?raw';
import ledRgbRaw from './kicad-assets/smidr.pretty/LED_Smidr_SK6812MINI_E.kicad_mod?raw';
import plateKeyHoleRaw from './kicad-assets/smidr.pretty/Plate_Smidr_Key_Hole.kicad_mod?raw';
import switchChocHotswapRaw from './kicad-assets/smidr.pretty/SW_Smidr_Choc_Hotswap.kicad_mod?raw';
import switchChocSolderRaw from './kicad-assets/smidr.pretty/SW_Smidr_Choc_Solder.kicad_mod?raw';
import switchMxHotswapRaw from './kicad-assets/smidr.pretty/SW_Smidr_MX_Hotswap.kicad_mod?raw';
import switchMxSolderRaw from './kicad-assets/smidr.pretty/SW_Smidr_MX_Solder.kicad_mod?raw';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getFirmwareMatrixPosition, isDirectPinMatrix } from './matrix-utils';

type SwitchFootprintKind = 'mx-solder' | 'mx-hotswap' | 'choc-solder' | 'choc-hotswap';
type DiodeFootprintKind = 'sod123' | 'sod323' | 'do35';
type FootprintMountType = 'through_hole' | 'smd';
type FootprintSide = 'front' | 'back';

export interface KiCadFootprintChoice {
  id: string;
  label: string;
  symbol: string;
  footprint: string;
  footprintSource: string;
  kind?: SwitchFootprintKind | DiodeFootprintKind;
  mountType?: FootprintMountType;
}

export interface KiCadExportOptions {
  switchFootprint: string;
  diodeFootprint: string;
  diodeOffsetX: number;
  diodeOffsetY: number;
  diodeRotation: number;
}

export const KICAD_SWITCH_FOOTPRINTS: KiCadFootprintChoice[] = [
  { id: 'mx-solder', label: 'MX Solder', symbol: 'Smidr:SW_Push', footprint: 'Smidr:SW_Smidr_MX_Solder', footprintSource: 'SW_Smidr_MX_Solder.kicad_mod', kind: 'mx-solder', mountType: 'through_hole' },
  { id: 'mx-hotswap', label: 'MX Hotswap', symbol: 'Smidr:SW_Push', footprint: 'Smidr:SW_Smidr_MX_Hotswap', footprintSource: 'SW_Smidr_MX_Hotswap.kicad_mod', kind: 'mx-hotswap', mountType: 'smd' },
  { id: 'choc-solder', label: 'Choc Solder', symbol: 'Smidr:SW_Push', footprint: 'Smidr:SW_Smidr_Choc_Solder', footprintSource: 'SW_Smidr_Choc_Solder.kicad_mod', kind: 'choc-solder', mountType: 'through_hole' },
  { id: 'choc-hotswap', label: 'Choc Hotswap', symbol: 'Smidr:SW_Push', footprint: 'Smidr:SW_Smidr_Choc_Hotswap', footprintSource: 'SW_Smidr_Choc_Hotswap.kicad_mod', kind: 'choc-hotswap', mountType: 'smd' },
];

export const KICAD_DIODE_FOOTPRINTS: KiCadFootprintChoice[] = [
  { id: 'sod-123', label: 'SOD-123', symbol: 'Device:D', footprint: 'Smidr:D_Smidr_SOD123', footprintSource: 'D_Smidr_SOD123.kicad_mod', kind: 'sod123', mountType: 'smd' },
  { id: 'sod-323', label: 'SOD-323', symbol: 'Device:D', footprint: 'Smidr:D_Smidr_SOD323', footprintSource: 'D_Smidr_SOD323.kicad_mod', kind: 'sod323', mountType: 'smd' },
  { id: 'do-35', label: 'DO-35 THT', symbol: 'Device:D', footprint: 'Smidr:D_Smidr_DO35', footprintSource: 'D_Smidr_DO35.kicad_mod', kind: 'do35', mountType: 'through_hole' },
];

const LED_FOOTPRINTS = {
  backlight: 'Smidr:LED_Smidr_Backlight',
  rgb: 'Smidr:LED_Smidr_SK6812MINI_E',
};
const PLATE_FOOTPRINT = 'Smidr:Plate_Smidr_Key_Hole';

const KICAD_FOOTPRINT_TEMPLATE_FILES: Record<string, string> = {
  'Plate_Smidr_Key_Hole.kicad_mod': plateKeyHoleRaw,
  'SW_Smidr_MX_Solder.kicad_mod': switchMxSolderRaw,
  'SW_Smidr_MX_Hotswap.kicad_mod': switchMxHotswapRaw,
  'SW_Smidr_Choc_Solder.kicad_mod': switchChocSolderRaw,
  'SW_Smidr_Choc_Hotswap.kicad_mod': switchChocHotswapRaw,
  'D_Smidr_SOD123.kicad_mod': diodeSod123Raw,
  'D_Smidr_SOD323.kicad_mod': diodeSod323Raw,
  'D_Smidr_DO35.kicad_mod': diodeDo35Raw,
  'LED_Smidr_Backlight.kicad_mod': ledBacklightRaw,
  'LED_Smidr_SK6812MINI_E.kicad_mod': ledRgbRaw,
};

export const DEFAULT_KICAD_EXPORT_OPTIONS: KiCadExportOptions = {
  switchFootprint: KICAD_SWITCH_FOOTPRINTS[0].footprint,
  diodeFootprint: KICAD_DIODE_FOOTPRINTS[0].footprint,
  diodeOffsetX: 5.08,
  diodeOffsetY: 4,
  diodeRotation: 90,
};

const UNIT_MM = 19.05;
const BOARD_MARGIN_MM = 8;

const sanitizeName = (value: string) => (
  (value || 'smidr_keyboard')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, '')
    .replace(/\s+/g, '_') || 'smidr_keyboard'
);

const escapeString = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const escapeKiCadText = (value: string) => escapeString(value.replace(/\s+/g, ' ').trim());
const mm = (value: number) => Number.isFinite(value) ? value.toFixed(3) : '0.000';
const getSwitchChoice = (footprint: string) => (
  KICAD_SWITCH_FOOTPRINTS.find(choice => choice.footprint === footprint) ?? KICAD_SWITCH_FOOTPRINTS[0]
);
const getDiodeChoice = (footprint: string) => (
  KICAD_DIODE_FOOTPRINTS.find(choice => choice.footprint === footprint) ?? KICAD_DIODE_FOOTPRINTS[0]
);
const getPcbSide = (mountType?: FootprintMountType): FootprintSide => (
  mountType === 'smd' ? 'back' : 'front'
);
const getSwitchLedOffset = (choice: KiCadFootprintChoice) => {
  const kind = (choice.kind ?? 'mx-solder') as SwitchFootprintKind;
  return kind.startsWith('choc')
    ? { x: 0, y: -4.7 }
    : { x: 0, y: 5.08 };
};
const sideLayer = (side: FootprintSide, frontLayer: string) => (
  side === 'back' && frontLayer.startsWith('F.') ? `B.${frontLayer.slice(2)}` : frontLayer
);
const smdLayers = (side: FootprintSide) => (
  side === 'back' ? '"B.Cu" "B.Paste" "B.Mask"' : '"F.Cu" "F.Paste" "F.Mask"'
);
const normalizeAngle = (angle: number) => {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};
const padAt = (x: number, y: number, angle: number) => `(at ${mm(x)} ${mm(y)} ${mm(normalizeAngle(angle))})`;
const parseNumber = (value: string) => Number.parseFloat(value);

const seededUuid = (seed: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(0, len);
  const a = hex(hash, 8);
  hash = Math.imul(hash ^ 0x9e3779b9, 0x01000193);
  const b = hex(hash, 4);
  hash = Math.imul(hash ^ 0x85ebca6b, 0x01000193);
  const c = hex(hash, 4);
  hash = Math.imul(hash ^ 0xc2b2ae35, 0x01000193);
  const d = hex(hash, 4);
  hash = Math.imul(hash ^ 0x27d4eb2f, 0x01000193);
  const e = `${hex(hash, 8)}${hex(hash ^ 0xa5a5a5a5, 4)}`;
  return `${a}-${b}-${c}-${d}-${e}`;
};

const rotatePoint = (x: number, y: number, cx: number, cy: number, degrees: number) => {
  const rad = degrees * Math.PI / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
};

const getKeyCenter = (key: PhysicalKey) => {
  const center = {
    x: key.x + key.w / 2,
    y: key.y + key.h / 2,
  };
  const rotated = rotatePoint(center.x, center.y, key.rx ?? key.x, key.ry ?? key.y, key.r || 0);
  return {
    x: rotated.x * UNIT_MM,
    y: rotated.y * UNIT_MM,
    r: key.r || 0,
  };
};

const getVisibleKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  keys.filter(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option)
);

const getMatrixNetNames = (
  settings: ProjectSettings,
  key: PhysicalKey,
  keys: PhysicalKey[],
  index: number
) => {
  if (isDirectPinMatrix(settings)) {
    const pin = (key.directPin || `UNASSIGNED_${index + 1}`).replace(/[^A-Za-z0-9_./-]/g, '_');
    return {
      switchA: `PIN_${pin}`,
      switchB: 'GND',
      diodeA: '',
      diodeB: '',
      key: `KEY_DIRECT_${index + 1}`,
      position: `D${index + 1}`,
    };
  }

  const pos = getFirmwareMatrixPosition(settings, key, keys);
  const row = pos?.row ?? key.row ?? 0;
  const col = pos?.col ?? key.col ?? 0;
  const rowNet = `ROW${row}`;
  const colNet = `COL${col}`;
  const keyNet = `KEY_R${row}_C${col}`;

  if (settings.hardware.diodeDirection === 'ROW2COL') {
    return {
      switchA: rowNet,
      switchB: keyNet,
      diodeA: keyNet,
      diodeB: colNet,
      key: keyNet,
      position: `R${row}C${col}`,
    };
  }

  return {
    switchA: colNet,
    switchB: keyNet,
    diodeA: keyNet,
    diodeB: rowNet,
    key: keyNet,
    position: `R${row}C${col}`,
  };
};

const getRgbLedKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  settings.features.rgbMatrix
    ? keys.filter(key => !key.decal && Number.isInteger(key.ledIndex) && key.ledIndex! >= 0)
    : []
);

const collectNets = (
  matrixItems: Array<{ switchA: string; switchB: string; diodeA: string; diodeB: string }>,
  rgbKeys: PhysicalKey[]
) => {
  const names = new Set<string>();
  matrixItems.forEach(item => {
    [item.switchA, item.switchB, item.diodeA, item.diodeB].forEach(name => {
      if (name) names.add(name);
    });
  });
  if (rgbKeys.length > 0) {
    names.add('VCC');
    names.add('GND');
    names.add('RGB_DIN');
    rgbKeys.forEach(key => {
      names.add(`RGB_DOUT_${key.ledIndex}`);
    });
  }
  return ['', ...Array.from(names).sort()];
};

const generateKiCadProject = (settings: ProjectSettings) => JSON.stringify({
  meta: {
    filename: `${sanitizeName(settings.name)}.kicad_pro`,
    version: 1,
  },
  net_settings: {
    classes: [
      {
        bus_width: 12,
        clearance: 0.2,
        diff_pair_gap: 0.25,
        diff_pair_via_gap: 0.25,
        diff_pair_width: 0.2,
        line_style: 0,
        microvia_diameter: 0.3,
        microvia_drill: 0.1,
        name: 'Default',
        pcb_color: 'rgba(0, 0, 0, 0.000)',
        schematic_color: 'rgba(0, 0, 0, 0.000)',
        track_width: 0.25,
        via_diameter: 0.8,
        via_drill: 0.4,
        wire_width: 6,
      },
    ],
  },
}, null, 2);

const generateFpLibTable = () => `(fp_lib_table
  (lib (name "Smidr")(type "KiCad")(uri "\${KIPRJMOD}/smidr.pretty")(options "")(descr "Smiðr generated footprints"))
)`;

const generateSymLibTable = () => `(sym_lib_table
  (lib (name "Smidr")(type "KiCad")(uri "\${KIPRJMOD}/smidr.kicad_sym")(options "")(descr "Smiðr generated symbols"))
)`;

const footprintNet = (netId?: number, netName?: string) => (
  netName ? `(net ${netId ?? 0} "${escapeString(netName)}")` : ''
);

const makeProperty = (name: string, value: string, x: number, y: number, hidden = false) => `
      (property "${name}" "${escapeString(value)}"
        (at ${mm(x)} ${mm(y)} 0)
        (effects (font (size 1.27 1.27))${hidden ? ' hide' : ''})
      )`;

const makeSchematicSymbol = (
  libId: string,
  reference: string,
  value: string,
  footprint: string,
  x: number,
  y: number,
  seed: string
) => `
  (symbol
    (lib_id "${libId}")
    (at ${mm(x)} ${mm(y)} 0)
    (unit 1)
    (exclude_from_sim no)
    (in_bom yes)
    (on_board yes)
    (dnp no)
    (uuid "${seededUuid(seed)}")${makeProperty('Reference', reference, x, y - 2.54)}${makeProperty('Value', value, x, y + 2.54)}${makeProperty('Footprint', footprint, x, y + 5.08, true)}
  )`;

const findMatchingParen = (value: string, start: number) => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < value.length; i++) {
    const char = value[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const generateEmbeddedSymbols = () => {
  const embeddedNames: Record<string, string> = {
    SW_Push: 'Smidr:SW_Push',
    D: 'Device:D',
    LED: 'Device:LED',
    SK6812MINI_E: 'Smidr:SK6812MINI_E',
  };
  const symbols: string[] = [];
  let index = 0;
  while (index < smidrSymbolsRaw.length) {
    const start = smidrSymbolsRaw.indexOf('(symbol "', index);
    if (start === -1) break;
    const end = findMatchingParen(smidrSymbolsRaw, start);
    if (end === -1) break;
    const symbol = smidrSymbolsRaw.slice(start, end + 1).trim().replace(
      /^\(symbol "([^"]+)"/,
      (match, name: string) => `(symbol "${embeddedNames[name] ?? name}"`
    );
    symbols.push(`  ${symbol}`);
    index = end + 1;
  }
  return symbols.join('\n');
};

const keyOutline = (key: Pick<PhysicalKey, 'w' | 'h'>, clearance = 0) => {
  const halfWidth = ((key.w || 1) * UNIT_MM / 2) + clearance;
  const halfHeight = ((key.h || 1) * UNIT_MM / 2) + clearance;
  return { halfWidth, halfHeight };
};

const makeRect = (layer: string, halfWidth: number, halfHeight: number, seed: string, width = 0.12) => `
    (fp_rect (start ${mm(-halfWidth)} ${mm(-halfHeight)}) (end ${mm(halfWidth)} ${mm(halfHeight)}) (stroke (width ${mm(width)}) (type solid)) (fill none) (layer "${layer}") (tstamp ${seededUuid(seed)}))`;

const getFootprintTemplate = (source: string) => KICAD_FOOTPRINT_TEMPLATE_FILES[source] ?? '';

export const getKiCadFootprintPreviewTemplate = (footprint: string) => {
  const choice = [...KICAD_SWITCH_FOOTPRINTS, ...KICAD_DIODE_FOOTPRINTS]
    .find(item => item.footprint === footprint);
  return choice ? getFootprintTemplate(choice.footprintSource) : '';
};

const removeLibraryOnlyFootprintForms = (footprint: string) => footprint
  .replace(/\n\s*\((version|generator|generator_version|embedded_fonts)\s+[^()\n]*\)/g, '');

const replaceFirstRectOnLayer = (
  footprint: string,
  layer: string,
  halfWidth: number,
  halfHeight: number,
  strokeWidth: number
) => {
  let index = 0;
  while (index < footprint.length) {
    const start = footprint.indexOf('(fp_rect', index);
    if (start === -1) return footprint;
    const end = findMatchingParen(footprint, start);
    if (end === -1) return footprint;
    const block = footprint.slice(start, end + 1);
    if (block.includes(`(layer "${layer}")`)) {
      const replacement = `(fp_rect
    (start ${mm(-halfWidth)} ${mm(-halfHeight)})
    (end ${mm(halfWidth)} ${mm(halfHeight)})
    (stroke (width ${mm(strokeWidth)}) (type solid))
    (fill no)
    (layer "${layer}")
  )`;
      return `${footprint.slice(0, start)}${replacement}${footprint.slice(end + 1)}`;
    }
    index = end + 1;
  }
  return footprint;
};

const applySwitchOutline = (footprint: string, key: PhysicalKey) => {
  const outline = keyOutline(key, 0);
  return replaceFirstRectOnLayer(
    replaceFirstRectOnLayer(
      replaceFirstRectOnLayer(footprint, 'Dwgs.User', outline.halfWidth, outline.halfHeight, 0.12),
      'F.CrtYd',
      outline.halfWidth,
      outline.halfHeight,
      0.05
    ),
    'F.Fab',
    outline.halfWidth,
    outline.halfHeight,
    0.10
  );
};

const mirrorCoordinateFormsForBack = (footprint: string) => {
  const number = '[-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?';
  const mirrorPoint = (match: string, form: string, x: string, y: string) => (
    `(${form} ${mm(parseNumber(x))} ${mm(-parseNumber(y))}`
  );
  return footprint
    .replace(new RegExp(`\\((start|end|center|mid|xy)\\s+(${number})\\s+(${number})`, 'g'), mirrorPoint)
    .replace(new RegExp(`\\(at\\s+(${number})\\s+(${number})(?:\\s+(${number}))?`, 'g'), (match, x: string, y: string, angle?: string) => (
      `(at ${mm(parseNumber(x))} ${mm(-parseNumber(y))}${angle === undefined ? '' : ` ${mm(normalizeAngle(180 - parseNumber(angle)))}`}`
    ));
};

const convertFootprintLayersToBack = (footprint: string) => footprint
  .replace(/"F\./g, '"__SMIDR_FRONT_LAYER__')
  .replace(/"B\./g, '"F.')
  .replace(/"__SMIDR_FRONT_LAYER__/g, '"B.');

const adjustPadAngles = (footprint: string, rotation: number) => {
  let result = '';
  let index = 0;
  while (index < footprint.length) {
    const start = footprint.indexOf('(pad ', index);
    if (start === -1) {
      result += footprint.slice(index);
      break;
    }
    const end = findMatchingParen(footprint, start);
    if (end === -1) {
      result += footprint.slice(index);
      break;
    }
    result += footprint.slice(index, start);
    const block = footprint.slice(start, end + 1).replace(
      /\(at\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(?:\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?))?\)/,
      (match, x: string, y: string, angle?: string) => (
        `(at ${mm(parseNumber(x))} ${mm(parseNumber(y))} ${mm(normalizeAngle((angle === undefined ? 0 : parseNumber(angle)) + rotation))})`
      )
    );
    result += block;
    index = end + 1;
  }
  return result;
};

const injectPadNets = (footprint: string, padNets: Record<string, string>) => {
  let result = '';
  let index = 0;
  while (index < footprint.length) {
    const start = footprint.indexOf('(pad ', index);
    if (start === -1) {
      result += footprint.slice(index);
      break;
    }
    const end = findMatchingParen(footprint, start);
    if (end === -1) {
      result += footprint.slice(index);
      break;
    }
    result += footprint.slice(index, start);
    const original = footprint.slice(start, end + 1);
    const padName = original.match(/^\(pad\s+"([^"]+)"/)?.[1] ?? '';
    const net = padNets[padName];
    let block = original.replace(/\s+\(net\s+\d+\s+"[^"]*"\)/g, '');
    if (net) {
      const insertAt = block.lastIndexOf(')');
      block = `${block.slice(0, insertAt)}\n    ${net}${block.slice(insertAt)}`;
    }
    result += block;
    index = end + 1;
  }
  return result;
};

const addBackSideMirroredTextJustification = (footprint: string) => {
  let result = '';
  let index = 0;
  while (index < footprint.length) {
    const start = footprint.indexOf('(effects', index);
    if (start === -1) {
      result += footprint.slice(index);
      break;
    }
    const end = findMatchingParen(footprint, start);
    if (end === -1) {
      result += footprint.slice(index);
      break;
    }
    result += footprint.slice(index, start);
    const block = footprint.slice(start, end + 1);
    result += block.includes('(justify')
      ? block.replace(/\(justify[^)]*\)/, '(justify mirror)')
      : `${block.slice(0, -1)}\n      (justify mirror)\n    )`;
    index = end + 1;
  }
  return result;
};

const uniquifyFootprintUuids = (footprint: string, seed: string) => {
  let index = 0;
  return footprint.replace(/\(uuid\s+"[^"]+"\)/g, () => {
    index += 1;
    return `(uuid "${seededUuid(`${seed}-item-${index}`)}")`;
  });
};

const instantiateFootprintTemplate = (
  rawFootprint: string,
  libId: string,
  reference: string,
  value: string,
  x: number,
  y: number,
  rotation: number,
  uuid: string,
  padNets: Record<string, string>,
  side: FootprintSide,
  key?: PhysicalKey
) => {
  let footprint = rawFootprint.trim().replace(/^\(footprint\s+"[^"]+"/, `(footprint "${escapeString(libId)}"`);
  if (key) footprint = applySwitchOutline(footprint, key);
  footprint = removeLibraryOnlyFootprintForms(footprint);
  footprint = footprint
    .replace(/(\(property\s+"Reference"\s+)"[^"]+"/, `$1"${escapeKiCadText(reference)}"`)
    .replace(/(\(property\s+"Value"\s+)"[^"]+"/, `$1"${escapeKiCadText(value)}"`)
    .replace(/\(fp_text\s+reference\s+"[^"]+"/, `(fp_text reference "${escapeKiCadText(reference)}"`)
    .replace(/\(fp_text\s+value\s+"[^"]+"/, `(fp_text value "${escapeKiCadText(value)}"`);
  if (side === 'back') {
    footprint = convertFootprintLayersToBack(mirrorCoordinateFormsForBack(footprint));
    footprint = addBackSideMirroredTextJustification(footprint);
  }
  const footprintRotation = side === 'back' ? normalizeAngle(rotation + 180) : rotation;
  footprint = adjustPadAngles(footprint, footprintRotation);
  footprint = injectPadNets(footprint, padNets);
  footprint = uniquifyFootprintUuids(footprint, uuid);
  footprint = footprint.replace(
    /\(\s*layer\s+"[^"]+"\s*\)/,
    `(layer "${sideLayer(side, 'F.Cu')}")\n    (uuid "${uuid}")\n    (at ${mm(x)} ${mm(y)} ${mm(footprintRotation)})`
  );
  return `\n  ${footprint}`;
};

const makeSwitchPads = (kind: SwitchFootprintKind, uuid: string, pad1Net: string, pad2Net: string, side: FootprintSide, rotation: number) => {
  const isChoc = kind.startsWith('choc');
  const isHotswap = kind.endsWith('hotswap');
  const centerHole = isChoc ? '' : `
    (pad "" np_thru_hole circle ${padAt(0, 0, rotation)} (size 4.000 4.000) (drill 4.000) (layers "*.Cu" "*.Mask") (tstamp ${seededUuid(`${uuid}-center`)}))`;
  const locatingPins = isChoc
    ? `
    (pad "" np_thru_hole circle ${padAt(-5.5, 0, rotation)} (size 1.900 1.900) (drill 1.900) (layers "*.Cu" "*.Mask") (tstamp ${seededUuid(`${uuid}-pin-left`)}))
    (pad "" np_thru_hole circle ${padAt(5.5, 0, rotation)} (size 1.900 1.900) (drill 1.900) (layers "*.Cu" "*.Mask") (tstamp ${seededUuid(`${uuid}-pin-right`)}))`
    : `
    (pad "" np_thru_hole circle ${padAt(-5.08, 0, rotation)} (size 1.700 1.700) (drill 1.700) (layers "*.Cu" "*.Mask") (tstamp ${seededUuid(`${uuid}-pin-left`)}))
    (pad "" np_thru_hole circle ${padAt(5.08, 0, rotation)} (size 1.700 1.700) (drill 1.700) (layers "*.Cu" "*.Mask") (tstamp ${seededUuid(`${uuid}-pin-right`)}))`;
  if (isHotswap) {
    const pads = isChoc
      ? `
    (pad "1" smd roundrect ${padAt(-5, -3.8, rotation)} (size 3.000 2.200) (layers ${smdLayers(side)}) (roundrect_rratio 0.18) ${pad1Net})
    (pad "2" smd roundrect ${padAt(5, -3.8, rotation)} (size 3.000 2.200) (layers ${smdLayers(side)}) (roundrect_rratio 0.18) ${pad2Net})`
      : `
    (pad "1" smd roundrect ${padAt(-3.81, -4.7, rotation)} (size 3.000 2.200) (layers ${smdLayers(side)}) (roundrect_rratio 0.18) ${pad1Net})
    (pad "2" smd roundrect ${padAt(2.54, -6.9, rotation)} (size 3.000 2.200) (layers ${smdLayers(side)}) (roundrect_rratio 0.18) ${pad2Net})`;
    return `${centerHole}${locatingPins}${pads}`;
  }
  const pads = isChoc
    ? `
    (pad "1" thru_hole circle ${padAt(-5, -3.8, rotation)} (size 2.200 2.200) (drill 1.300) (layers "*.Cu" "*.Mask") ${pad1Net})
    (pad "2" thru_hole circle ${padAt(5, -3.8, rotation)} (size 2.200 2.200) (drill 1.300) (layers "*.Cu" "*.Mask") ${pad2Net})`
    : `
    (pad "1" thru_hole circle ${padAt(-3.81, -2.54, rotation)} (size 2.500 2.500) (drill 1.500) (layers "*.Cu" "*.Mask") ${pad1Net})
    (pad "2" thru_hole circle ${padAt(2.54, -5.08, rotation)} (size 2.500 2.500) (drill 1.500) (layers "*.Cu" "*.Mask") ${pad2Net})`;
  return `${centerHole}${locatingPins}${pads}`;
};

const makeGeneratedSwitchFootprint = (
  choice: KiCadFootprintChoice,
  reference: string,
  value: string,
  x: number,
  y: number,
  rotation: number,
  uuid: string,
  pad1Net: string,
  pad2Net: string,
  key: PhysicalKey,
  side: FootprintSide = 'front'
) => {
  const kind = (choice.kind ?? 'mx-solder') as SwitchFootprintKind;
  const isChoc = kind.startsWith('choc');
  const bodyHalf = isChoc ? 7.0 : 7.0;
  const cap = keyOutline(key, 0);
  const courtyard = keyOutline(key, 0);
  return `
  (footprint "${escapeString(choice.footprint)}"
    (layer "${sideLayer(side, 'F.Cu')}")
    (uuid "${uuid}")
    (at ${mm(x)} ${mm(y)} ${mm(rotation)})
    (descr "Smiðr ${choice.label} keyboard switch, center-origin generated footprint")
    (tags "Smiðr keyboard switch center origin ${choice.id}")
    (fp_text reference "${escapeString(reference)}" (at 0 ${mm(-cap.halfHeight - 1.5)} 0) (layer "${sideLayer(side, 'F.SilkS')}") (effects (font (size 1 1) (thickness 0.15))) (tstamp ${seededUuid(`${uuid}-ref`)}))
    (fp_text value "${escapeString(value)}" (at 0 ${mm(cap.halfHeight + 1.5)} 0) (layer "${sideLayer(side, 'F.Fab')}") (effects (font (size 1 1) (thickness 0.15))) (tstamp ${seededUuid(`${uuid}-value`)}))
    (fp_text user "\${REFERENCE}" (at 0 0 0) (layer "${sideLayer(side, 'F.Fab')}") (effects (font (size 1 1) (thickness 0.15))) (tstamp ${seededUuid(`${uuid}-user`)}))
    (attr ${choice.mountType ?? 'through_hole'})
${makeRect('Dwgs.User', cap.halfWidth, cap.halfHeight, `${uuid}-keycap`)}
${makeRect(sideLayer(side, 'F.CrtYd'), courtyard.halfWidth, courtyard.halfHeight, `${uuid}-courtyard`, 0.05)}
${makeRect(sideLayer(side, 'F.Fab'), cap.halfWidth, cap.halfHeight, `${uuid}-fab-keycap`, 0.10)}
${makeRect(sideLayer(side, 'F.Fab'), bodyHalf, bodyHalf, `${uuid}-body`, 0.10)}
    (fp_line (start ${mm(-bodyHalf)} ${mm(-bodyHalf)}) (end ${mm(bodyHalf)} ${mm(-bodyHalf)}) (stroke (width 0.12) (type solid)) (layer "${sideLayer(side, 'F.SilkS')}") (tstamp ${seededUuid(`${uuid}-silk-top`)}))
    (fp_line (start ${mm(-bodyHalf)} ${mm(bodyHalf)}) (end ${mm(bodyHalf)} ${mm(bodyHalf)}) (stroke (width 0.12) (type solid)) (layer "${sideLayer(side, 'F.SilkS')}") (tstamp ${seededUuid(`${uuid}-silk-bottom`)}))
    (fp_circle (center 0 0) (end 0.900 0) (stroke (width 0.10) (type solid)) (fill none) (layer "Dwgs.User") (tstamp ${seededUuid(`${uuid}-center-mark`)}))
${makeSwitchPads(kind, uuid, pad1Net, pad2Net, side, rotation)}
  )`;
};

const makeGeneratedDiodeFootprint = (
  choice: KiCadFootprintChoice,
  reference: string,
  value: string,
  x: number,
  y: number,
  rotation: number,
  uuid: string,
  pad1Net: string,
  pad2Net: string,
  side: FootprintSide = 'front'
) => {
  const kind = (choice.kind ?? 'sod123') as DiodeFootprintKind;
  if (kind === 'do35') {
    return `
  (footprint "${escapeString(choice.footprint)}"
    (layer "F.Cu")
    (uuid "${uuid}")
    (at ${mm(x)} ${mm(y)} ${mm(rotation)})
    (descr "Smiðr DO-35 horizontal diode, center-origin generated footprint")
    (tags "Smiðr DO-35 horizontal diode")
    (fp_text reference "${escapeString(reference)}" (at 0 -2.4 0) (layer "F.SilkS") (effects (font (size 0.8 0.8) (thickness 0.12))) (tstamp ${seededUuid(`${uuid}-ref`)}))
    (fp_text value "${escapeString(value)}" (at 0 2.4 0) (layer "F.Fab") (effects (font (size 0.8 0.8) (thickness 0.12))) (tstamp ${seededUuid(`${uuid}-value`)}))
    (attr through_hole)
    (fp_rect (start -2.200 -1.000) (end 2.200 1.000) (stroke (width 0.10) (type solid)) (fill none) (layer "F.Fab") (tstamp ${seededUuid(`${uuid}-body`)}))
    (fp_line (start -1.350 -1.000) (end -1.350 1.000) (stroke (width 0.12) (type solid)) (layer "F.SilkS") (tstamp ${seededUuid(`${uuid}-silk-k`)}))
    (fp_line (start -2.200 -1.100) (end 2.200 -1.100) (stroke (width 0.12) (type solid)) (layer "F.SilkS") (tstamp ${seededUuid(`${uuid}-silk-top`)}))
    (fp_line (start -2.200 1.100) (end 2.200 1.100) (stroke (width 0.12) (type solid)) (layer "F.SilkS") (tstamp ${seededUuid(`${uuid}-silk-bottom`)}))
    (fp_rect (start -4.900 -1.600) (end 4.900 1.600) (stroke (width 0.05) (type solid)) (fill none) (layer "F.CrtYd") (tstamp ${seededUuid(`${uuid}-courtyard`)}))
    (pad "1" thru_hole rect ${padAt(-3.81, 0, rotation)} (size 1.800 1.800) (drill 0.800) (layers "*.Cu" "*.Mask") ${pad1Net})
    (pad "2" thru_hole circle ${padAt(3.81, 0, rotation)} (size 1.800 1.800) (drill 0.800) (layers "*.Cu" "*.Mask") ${pad2Net})
  )`;
  }
  const isSod323 = kind === 'sod323';
  const padX = isSod323 ? 1.200 : 1.650;
  const padW = isSod323 ? 0.650 : 0.900;
  const padH = isSod323 ? 0.800 : 1.200;
  const bodyW = isSod323 ? 1.700 : 2.700;
  const bodyH = isSod323 ? 1.250 : 1.600;
  const courtyardW = isSod323 ? 2.500 : 3.800;
  const courtyardH = isSod323 ? 1.400 : 1.800;
  return `
  (footprint "${escapeString(choice.footprint)}"
    (layer "${sideLayer(side, 'F.Cu')}")
    (uuid "${uuid}")
    (at ${mm(x)} ${mm(y)} ${mm(rotation)})
    (descr "Smiðr ${choice.label} diode, center-origin generated footprint")
    (tags "Smiðr ${choice.label} diode")
    (fp_text reference "${escapeString(reference)}" (at 0 ${mm(-courtyardH / 2 - 1.0)} 0) (layer "${sideLayer(side, 'F.SilkS')}") (effects (font (size 0.8 0.8) (thickness 0.12))) (tstamp ${seededUuid(`${uuid}-ref`)}))
    (fp_text value "${escapeString(value)}" (at 0 ${mm(courtyardH / 2 + 1.0)} 0) (layer "${sideLayer(side, 'F.Fab')}") (effects (font (size 0.8 0.8) (thickness 0.12))) (tstamp ${seededUuid(`${uuid}-value`)}))
    (attr smd)
    (fp_rect (start ${mm(-bodyW / 2)} ${mm(-bodyH / 2)}) (end ${mm(bodyW / 2)} ${mm(bodyH / 2)}) (stroke (width 0.10) (type solid)) (fill none) (layer "${sideLayer(side, 'F.Fab')}") (tstamp ${seededUuid(`${uuid}-fab`)}))
    (fp_line (start ${mm(-bodyW / 2)} ${mm(-bodyH / 2)}) (end ${mm(-bodyW / 2)} ${mm(bodyH / 2)}) (stroke (width 0.12) (type solid)) (layer "${sideLayer(side, 'F.SilkS')}") (tstamp ${seededUuid(`${uuid}-silk-k`)}))
    (fp_rect (start ${mm(-courtyardW / 2)} ${mm(-courtyardH / 2)}) (end ${mm(courtyardW / 2)} ${mm(courtyardH / 2)}) (stroke (width 0.05) (type solid)) (fill none) (layer "${sideLayer(side, 'F.CrtYd')}") (tstamp ${seededUuid(`${uuid}-courtyard`)}))
    (fp_line (start -0.400 -0.550) (end -0.400 0.550) (stroke (width 0.10) (type solid)) (layer "${sideLayer(side, 'F.Fab')}") (tstamp ${seededUuid(`${uuid}-symbol-k`)}))
    (fp_line (start -0.400 0.550) (end 0.500 0) (stroke (width 0.10) (type solid)) (layer "${sideLayer(side, 'F.Fab')}") (tstamp ${seededUuid(`${uuid}-symbol-a1`)}))
    (fp_line (start 0.500 0) (end -0.400 -0.550) (stroke (width 0.10) (type solid)) (layer "${sideLayer(side, 'F.Fab')}") (tstamp ${seededUuid(`${uuid}-symbol-a2`)}))
    (pad "1" smd roundrect ${padAt(-padX, 0, rotation)} (size ${mm(padW)} ${mm(padH)}) (layers ${smdLayers(side)}) (roundrect_rratio 0.2) ${pad1Net})
    (pad "2" smd roundrect ${padAt(padX, 0, rotation)} (size ${mm(padW)} ${mm(padH)}) (layers ${smdLayers(side)}) (roundrect_rratio 0.2) ${pad2Net})
  )`;
};

const makeGeneratedRgbLedFootprint = (
  reference: string,
  value: string,
  x: number,
  y: number,
  rotation: number,
  uuid: string,
  vddNet: string,
  doutNet: string,
  gndNet: string,
  dinNet: string,
  side: FootprintSide = 'front'
) => `
  (footprint "${LED_FOOTPRINTS.rgb}"
    (layer "${sideLayer(side, 'F.Cu')}")
    (uuid "${uuid}")
    (at ${mm(x)} ${mm(y)} ${mm(rotation)})
    (descr "Smiðr SK6812MINI-E RGB LED, center-origin generated footprint")
    (tags "Smiðr RGB LED SK6812MINI-E")
    (fp_text reference "${escapeString(reference)}" (at 0 -3.1 0) (layer "${sideLayer(side, 'F.SilkS')}") (effects (font (size 0.7 0.7) (thickness 0.10))) (tstamp ${seededUuid(`${uuid}-ref`)}))
    (fp_text value "${escapeString(value)}" (at 0 3.1 0) (layer "${sideLayer(side, 'F.Fab')}") (effects (font (size 0.7 0.7) (thickness 0.10))) (tstamp ${seededUuid(`${uuid}-value`)}))
    (attr smd)
    (fp_rect (start -1.750 -1.750) (end 1.750 1.750) (stroke (width 0.10) (type solid)) (fill none) (layer "${sideLayer(side, 'F.Fab')}") (tstamp ${seededUuid(`${uuid}-fab`)}))
    (fp_rect (start -2.000 -2.000) (end 2.000 2.000) (stroke (width 0.05) (type solid)) (fill none) (layer "${sideLayer(side, 'F.CrtYd')}") (tstamp ${seededUuid(`${uuid}-courtyard`)}))
    (fp_line (start -1.750 -1.750) (end -1.000 -1.750) (stroke (width 0.12) (type solid)) (layer "${sideLayer(side, 'F.SilkS')}") (tstamp ${seededUuid(`${uuid}-pin1-mark-a`)}))
    (fp_line (start -1.750 -1.750) (end -1.750 -1.000) (stroke (width 0.12) (type solid)) (layer "${sideLayer(side, 'F.SilkS')}") (tstamp ${seededUuid(`${uuid}-pin1-mark-b`)}))
    (pad "1" smd roundrect ${padAt(-1.4, -0.85, rotation)} (size 0.800 0.700) (layers ${smdLayers(side)}) (roundrect_rratio 0.20) ${vddNet})
    (pad "2" smd roundrect ${padAt(1.4, -0.85, rotation)} (size 0.800 0.700) (layers ${smdLayers(side)}) (roundrect_rratio 0.20) ${doutNet})
    (pad "3" smd roundrect ${padAt(1.4, 0.85, rotation)} (size 0.800 0.700) (layers ${smdLayers(side)}) (roundrect_rratio 0.20) ${gndNet})
    (pad "4" smd roundrect ${padAt(-1.4, 0.85, rotation)} (size 0.800 0.700) (layers ${smdLayers(side)}) (roundrect_rratio 0.20) ${dinNet})
  )`;

const generateKiCadSchematic = (
  settings: ProjectSettings,
  keys: PhysicalKey[],
  options: KiCadExportOptions
) => {
  const visibleKeys = getVisibleKeys(settings, keys).filter(key => !key.decal);
  const title = escapeString(settings.name || 'Smiðr Keyboard');
  const switchChoice = getSwitchChoice(options.switchFootprint);
  const diodeChoice = getDiodeChoice(options.diodeFootprint);
  const rgbKeys = getRgbLedKeys(settings, visibleKeys).sort((a, b) => (a.ledIndex ?? 0) - (b.ledIndex ?? 0));
  const symbols = visibleKeys.flatMap((key, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    const x = 25 + col * 28;
    const y = 25 + row * 24;
    const nets = getMatrixNetNames(settings, key, keys, index);
    const entries = [
      makeSchematicSymbol(switchChoice.symbol, `SW${index + 1}`, nets.position, switchChoice.footprint, x, y, `sch-sw-${index}`),
    ];
    if (!isDirectPinMatrix(settings)) {
      entries.push(makeSchematicSymbol(diodeChoice.symbol, `D${index + 1}`, nets.position, diodeChoice.footprint, x + 12, y, `sch-d-${index}`));
    }
    return entries;
  });

  rgbKeys.forEach((key, index) => {
    const x = 25 + (index % 6) * 34;
    const y = 25 + Math.ceil(visibleKeys.length / 8) * 24 + 24 + Math.floor(index / 6) * 24;
    symbols.push(makeSchematicSymbol('Smidr:SK6812MINI_E', `LED${key.ledIndex}`, `RGB${key.ledIndex}`, LED_FOOTPRINTS.rgb, x, y, `sch-rgb-${key.ledIndex}`));
  });

  const labels = visibleKeys.map((key, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    const x = 25 + col * 28;
    const y = 25 + row * 24;
    const nets = getMatrixNetNames(settings, key, keys, index);
    const diodeLabels = isDirectPinMatrix(settings)
      ? ''
      : `
  (label "${nets.diodeA}" (at ${mm(x + 8)} ${mm(y - 4)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-da-${index}`)}"))
  (label "${nets.diodeB}" (at ${mm(x + 16)} ${mm(y + 4)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-db-${index}`)}"))`;
    return `
  (label "${nets.switchA}" (at ${mm(x - 6)} ${mm(y - 4)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-sa-${index}`)}"))
  (label "${nets.switchB}" (at ${mm(x + 6)} ${mm(y + 4)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-sb-${index}`)}"))${diodeLabels}`;
  });

  rgbKeys.forEach((key, index) => {
    const x = 25 + (index % 6) * 34;
    const y = 25 + Math.ceil(visibleKeys.length / 8) * 24 + 24 + Math.floor(index / 6) * 24;
    const din = index === 0 ? 'RGB_DIN' : `RGB_DOUT_${rgbKeys[index - 1].ledIndex}`;
    const dout = `RGB_DOUT_${key.ledIndex}`;
    labels.push(`
  (label "VCC" (at ${mm(x - 10)} ${mm(y - 6)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-rgb-vcc-${key.ledIndex}`)}"))
  (label "GND" (at ${mm(x - 10)} ${mm(y + 6)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-rgb-gnd-${key.ledIndex}`)}"))
  (label "${din}" (at ${mm(x + 10)} ${mm(y + 6)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-rgb-din-${key.ledIndex}`)}"))
  (label "${dout}" (at ${mm(x + 10)} ${mm(y - 6)} 0) (effects (font (size 1.27 1.27))) (uuid "${seededUuid(`label-rgb-dout-${key.ledIndex}`)}"))`);
  });

  return `(kicad_sch
  (version 20230121)
  (generator "Smiðr")
  (uuid "${seededUuid(`sch-${settings.name}`)}")
  (paper "A3")
  (title_block
    (title "${title}")
    (company "${escapeString(settings.manufacturer || '')}")
    (comment 1 "Generated by Smiðr KiCad MVP export")
    (comment 2 "Switch footprint: ${escapeString(switchChoice.footprint)}")
    (comment 3 "Diode footprint: ${escapeString(diodeChoice.footprint)}")
  )
  (lib_symbols
${generateEmbeddedSymbols()}
  )
${symbols.join('\n')}
${labels.join('\n')}
  (sheet_instances
    (path "/" (page "1"))
  )
)`;
};

const makeSwitchFootprint = (
  index: number,
  key: PhysicalKey,
  netIds: Map<string, number>,
  options: KiCadExportOptions,
  nets: ReturnType<typeof getMatrixNetNames>
) => {
  const center = getKeyCenter(key);
  const pcbRotation = -center.r;
  const switchChoice = getSwitchChoice(options.switchFootprint);
  return instantiateFootprintTemplate(
    getFootprintTemplate(switchChoice.footprintSource),
    switchChoice.footprint,
    `SW${index + 1}`,
    nets.position,
    center.x,
    center.y,
    pcbRotation,
    seededUuid(`pcb-sw-${index}`),
    {
      1: footprintNet(netIds.get(nets.switchA) ?? 0, nets.switchA),
      2: footprintNet(netIds.get(nets.switchB) ?? 0, nets.switchB),
    },
    getPcbSide(switchChoice.mountType),
    key
  );
};

const makeDiodeFootprint = (
  index: number,
  key: PhysicalKey,
  netIds: Map<string, number>,
  options: KiCadExportOptions,
  nets: ReturnType<typeof getMatrixNetNames>
) => {
  const center = getKeyCenter(key);
  const offsetX = Number.isFinite(options.diodeOffsetX) ? options.diodeOffsetX : DEFAULT_KICAD_EXPORT_OPTIONS.diodeOffsetX;
  const offsetY = Number.isFinite(options.diodeOffsetY) ? options.diodeOffsetY : DEFAULT_KICAD_EXPORT_OPTIONS.diodeOffsetY;
  const offset = rotatePoint(center.x + offsetX, center.y + offsetY, center.x, center.y, center.r);
  const diodeRotation = Number.isFinite(options.diodeRotation) ? options.diodeRotation : DEFAULT_KICAD_EXPORT_OPTIONS.diodeRotation;
  const pcbRotation = -center.r - diodeRotation;
  const diodeChoice = getDiodeChoice(options.diodeFootprint);
  return instantiateFootprintTemplate(
    getFootprintTemplate(diodeChoice.footprintSource),
    diodeChoice.footprint,
    `D${index + 1}`,
    nets.position,
    offset.x,
    offset.y,
    pcbRotation,
    seededUuid(`pcb-d-${index}`),
    {
      1: footprintNet(netIds.get(nets.diodeA) ?? 0, nets.diodeA),
      2: footprintNet(netIds.get(nets.diodeB) ?? 0, nets.diodeB),
    },
    getPcbSide(diodeChoice.mountType)
  );
};

const makeRgbLedFootprint = (
  key: PhysicalKey,
  index: number,
  rgbKeys: PhysicalKey[],
  netIds: Map<string, number>,
  options: KiCadExportOptions
) => {
  const center = getKeyCenter(key);
  const pcbRotation = -center.r;
  const switchChoice = getSwitchChoice(options.switchFootprint);
  const ledOffset = getSwitchLedOffset(switchChoice);
  const ledPosition = rotatePoint(
    center.x + ledOffset.x,
    center.y + ledOffset.y,
    center.x,
    center.y,
    center.r
  );
  const din = index === 0 ? 'RGB_DIN' : `RGB_DOUT_${rgbKeys[index - 1].ledIndex}`;
  const dout = `RGB_DOUT_${key.ledIndex}`;
  return instantiateFootprintTemplate(
    getFootprintTemplate('LED_Smidr_SK6812MINI_E.kicad_mod'),
    LED_FOOTPRINTS.rgb,
    `LED${key.ledIndex}`,
    `RGB${key.ledIndex}`,
    ledPosition.x,
    ledPosition.y,
    pcbRotation,
    seededUuid(`pcb-rgb-${key.ledIndex}`),
    {
      1: footprintNet(netIds.get('VCC') ?? 0, 'VCC'),
      2: footprintNet(netIds.get(dout) ?? 0, dout),
      3: footprintNet(netIds.get('GND') ?? 0, 'GND'),
      4: footprintNet(netIds.get(din) ?? 0, din),
    },
    'back'
  );
};

const makePlateHoleFootprint = (index: number, key: PhysicalKey) => {
  const center = getKeyCenter(key);
  return instantiateFootprintTemplate(
    getFootprintTemplate('Plate_Smidr_Key_Hole.kicad_mod'),
    PLATE_FOOTPRINT,
    `PH${index + 1}`,
    key.label || `R${key.row ?? 0}C${key.col ?? index}`,
    center.x,
    center.y,
    -center.r,
    seededUuid(`plate-hole-${index}`),
    {},
    'front',
    key
  );
};

const getBoardBounds = (keys: PhysicalKey[]) => {
  if (keys.length === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 60 };
  }

  const corners = keys.flatMap(key => {
    const center = getKeyCenter(key);
    const halfWidth = key.w * UNIT_MM / 2;
    const halfHeight = key.h * UNIT_MM / 2;
    return [
      { x: center.x - halfWidth, y: center.y - halfHeight },
      { x: center.x + halfWidth, y: center.y + halfHeight },
    ];
  });
  const minX = Math.min(...corners.map(corner => corner.x)) - BOARD_MARGIN_MM;
  const minY = Math.min(...corners.map(corner => corner.y)) - BOARD_MARGIN_MM;
  const maxX = Math.max(...corners.map(corner => corner.x)) + BOARD_MARGIN_MM;
  const maxY = Math.max(...corners.map(corner => corner.y)) + BOARD_MARGIN_MM;
  return { minX, minY, maxX, maxY };
};

const makeEdgeCuts = (keys: PhysicalKey[]) => {
  const b = getBoardBounds(keys);
  return `
  (gr_rect
    (start ${mm(b.minX)} ${mm(b.minY)})
    (end ${mm(b.maxX)} ${mm(b.maxY)})
    (stroke (width 0.15) (type solid))
    (fill none)
    (layer "Edge.Cuts")
    (uuid "${seededUuid('edge-cuts')}")
  )`;
};

const generateKiCadPcb = (
  settings: ProjectSettings,
  keys: PhysicalKey[],
  options: KiCadExportOptions
) => {
  const visibleKeys = getVisibleKeys(settings, keys).filter(key => !key.decal);
  const keyNets = visibleKeys.map((key, index) => getMatrixNetNames(settings, key, keys, index));
  const rgbKeys = getRgbLedKeys(settings, visibleKeys).sort((a, b) => (a.ledIndex ?? 0) - (b.ledIndex ?? 0));
  const netNames = collectNets(keyNets, rgbKeys);
  const netIds = new Map(netNames.map((name, index) => [name, index]));
  const nets = netNames.map((name, index) => `  (net ${index} "${escapeString(name)}")`).join('\n');
  const switchFootprints = visibleKeys.map((key, index) => {
    const itemNets = keyNets[index];
    const sw = makeSwitchFootprint(index, key, netIds, options, itemNets);
    const diode = isDirectPinMatrix(settings) ? '' : makeDiodeFootprint(index, key, netIds, options, itemNets);
    return `${sw}${diode}`;
  }).join('\n');
  const rgbFootprints = rgbKeys.map((key, index) => makeRgbLedFootprint(key, index, rgbKeys, netIds, options)).join('\n');

  return `(kicad_pcb
  (version 20230121)
  (generator "Smiðr")
  (general
    (thickness 1.6)
  )
  (paper "A3")
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user)
    (33 "F.Adhes" user)
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user)
    (37 "F.SilkS" user)
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user)
    (47 "F.CrtYd" user)
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )
${nets}
${switchFootprints}
${rgbFootprints}
${makeEdgeCuts(visibleKeys)}
)`;
};

const generateKiCadPlatePcb = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const visibleKeys = getVisibleKeys(settings, keys).filter(key => !key.decal);
  const plateFootprints = visibleKeys.map((key, index) => makePlateHoleFootprint(index, key)).join('\n');

  return `(kicad_pcb
  (version 20230121)
  (generator "Smiðr")
  (general
    (thickness 1.6)
  )
  (paper "A3")
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user)
    (33 "F.Adhes" user)
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user)
    (37 "F.SilkS" user)
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user)
    (47 "F.CrtYd" user)
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )
${plateFootprints}
${makeEdgeCuts(visibleKeys)}
)`;
};

const makeFootprintTemplateFiles = () => {
  const files: Record<string, string> = {};
  Object.entries(KICAD_FOOTPRINT_TEMPLATE_FILES).forEach(([filename, content]) => {
    files[`smidr.pretty/${filename}`] = content.trim();
  });
  return files;
};

export const generateKiCadZip = async (
  state: { settings: ProjectSettings; keys: PhysicalKey[] },
  options: KiCadExportOptions = DEFAULT_KICAD_EXPORT_OPTIONS
) => {
  const projectName = sanitizeName(state.settings.name);
  const switchChoice = getSwitchChoice(options.switchFootprint);
  const diodeChoice = getDiodeChoice(options.diodeFootprint);
  const zip = new JSZip();
  zip.file(`${projectName}.kicad_pro`, generateKiCadProject(state.settings));
  zip.file('sym-lib-table', generateSymLibTable());
  zip.file('fp-lib-table', generateFpLibTable());
  zip.file('smidr.kicad_sym', smidrSymbolsRaw.trim());
  zip.file(`${projectName}.kicad_sch`, generateKiCadSchematic(state.settings, state.keys, options));
  zip.file(`${projectName}.kicad_pcb`, generateKiCadPcb(state.settings, state.keys, options));
  zip.file(`${projectName}_plate.kicad_pcb`, generateKiCadPlatePcb(state.settings, state.keys));
  Object.entries(makeFootprintTemplateFiles()).forEach(([path, content]) => {
    zip.file(path, content);
  });
  zip.file('README.md', `# ${state.settings.name || 'Smiðr Keyboard'} KiCad export

Generated by Smiðr.

This MVP export places center-origin Smiðr switch footprints from the physical layout and emits a matching schematic with keyboard matrix nets.

- Plate PCB: ${projectName}_plate.kicad_pcb contains center-origin key-hole footprints for the same physical layout.
- Switch footprint: ${switchChoice.footprint}
- Diode footprint: ${diodeChoice.footprint}
- Footprint library: smidr.pretty is included in this ZIP and referenced by fp-lib-table.
- Switch outlines: keycap, fab, and courtyard geometry are generated from each key's w/h.
- RGB Matrix: ${getRgbLedKeys(state.settings, state.keys).length > 0 ? `${getRgbLedKeys(state.settings, state.keys).length} SK6812MINI-E LED footprints are placed with switch-specific LED offsets.` : 'no per-key RGB LEDs placed.'}
- Direct-pin projects connect each switch between its direct GPIO net and GND.
- Matrix projects connect switches and diodes using ROWn/COLn nets.
`);

  return await zip.generateAsync({ type: 'blob' });
};
