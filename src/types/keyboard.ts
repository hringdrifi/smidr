// src/types/keyboard.ts
import { UniversalAction, MacroAction, ComboEntry, TapDanceEntry } from './actions';
import type { QmkMcu } from '@/lib/mcu-presets';
import type { VisualLayoutId } from '@/lib/visual-layouts';

export interface Point { x: number; y: number; }

export interface KeymapData {
  [layerIndex: number]: UniversalAction;
}

export interface EncoderLayerMap {
  clockwise?: UniversalAction;
  counterClockwise?: UniversalAction;
}

export interface EncoderDefinition {
  id?: string; // runtime only - generated on load, stripped on save
  pinA?: string;
  pinB?: string;
  keymap?: {
    [layerIndex: number]: EncoderLayerMap;
  };
}

export interface TrackballDefinition {
  id?: string; // runtime only - generated on load, stripped on save
  sclk?: string;
  sdio?: string;
  cs?: string;
  motion?: string;
  cpi?: number;
  swapXy?: boolean;
  invertX?: boolean;
  invertY?: boolean;
}

export interface PhysicalKey {
  id?: string;   // runtime only - generated on load, stripped on save
  encoderId?: string; // runtime only - links to ProjectSettings.encoders
  trackballId?: string; // runtime only - links to ProjectSettings.trackballs
  kind?: 'key' | 'encoder' | 'trackball';
  row?: number;  // matrix row (undefined if unassigned)
  col?: number;  // matrix col (undefined if unassigned)
  matrixSide?: 'left' | 'right'; // split matrix half for local row/col assignments
  directIndex?: number; // logical D0.. index for matrix.wiring === 'direct'
  directPin?: string; // legacy direct GPIO value; migrated to directIndex on load
  ledIndex?: number; // QMK/Vial RGB Matrix LED index, 0-based
  ledX?: number; // QMK/Vial RGB Matrix x coordinate (0-224)
  ledY?: number; // QMK/Vial RGB Matrix y coordinate (0-64)
  ledFlags?: number; // QMK/Vial RGB Matrix LED flags
  zmkPosition?: number; // ZMK Studio keymap position index (runtime/source import aid)
  x: number;
  y: number;
  w: number; // default: 1
  h: number; // default: 1
  r: number; // rotation
  rx: number;
  ry: number;
  
  // Secondary dimensions for polygonal keys (ISO Enter, etc.)
  w2?: number;
  h2?: number;
  x2?: number;
  y2?: number;
  stepped?: boolean; // KLE compatible flag for stepped keys

  label: string; // Keycap legend
  
  // VIA Layout Options integration
  group?: string; // e.g. "0"
  option?: number; // e.g. 0

  keymap?: KeymapData;
  decal?: boolean;
  encoderIndex?: number; // persisted/exported encoder index, converted to encoderId at runtime
  trackballIndex?: number; // persisted/exported trackball index, converted to trackballId at runtime
}

export interface ProjectSettings {
  name: string;
  manufacturer: string;
  description: string;
  vendorProductId: number; // VIA style: (vid << 16) | pid
  matrix: {
    rows: number;
    cols: number;
    wiring?: 'matrix' | 'direct';
  };
  pins: {
    rows: string[];
    cols: string[];
    rgb?: string;
    backlight?: string;
    sda?: string;
    scl?: string;
    splitSerial?: string; // Serial transport pin (e.g. GP1 for RP2040)
    splitRows?: string[]; // Right side row pins for split keyboards
    splitCols?: string[]; // Right side col pins for split keyboards
    direct?: string[]; // Available direct pins for the primary/left side
    splitDirect?: string[]; // Available direct pins for the right side of split keyboards
  };
  hardware: {
    controllerType?: 'mcu' | 'development_board';
    mcu: QmkMcu | string;
    bootloader?: string;
    board: string; // QMK development_board, e.g. "promicro", "elite_c"
    diodeDirection: 'ROW2COL' | 'COL2ROW';
  };
  qmk?: {
    matrixMasked?: boolean;
    bootmagic?: {
      enabled?: boolean;
      row?: number;
      col?: number;
    };
  };
  features: {
    rgb: boolean;
    backlight?: boolean;
    rgbMatrix?: boolean;
    encoder: boolean;
    oled: boolean;
    via: boolean;
    split: boolean;
  };
  layers: number;
  encoders?: EncoderDefinition[];
  trackballs?: TrackballDefinition[];
  macros?: MacroAction[][];
  combos?: ComboEntry[];
  tapDances?: TapDanceEntry[];
  visualLayout?: VisualLayoutId;
  layoutOptions: {
    [groupId: string]: {
      name: string; // e.g. "Backspace"
      type: 'toggle' | 'list';
      choices?: string[]; // only for list type
    }
  };
  activeOptions: Record<string, number>; // index: 0 for Off, 1 for On in toggle; choice index for list
  vialUid?: string; // 64-bit Vial UID (hex string, e.g. "0x123456789ABCDEF0")
  vial?: {
    unlockCombo?: {
      key1?: { row?: number; col?: number };
      key2?: { row?: number; col?: number };
    };
  };
  zmk?: {
    splitTransport?: 'ble' | 'wired';
    wiredSplitDevice?: string;
  };
}

export interface SmidrProjectData {
  'source.json': string;
  'keyboard.json': string;
  'via.json': string;
}

export interface EditorSettings {
  gridSnap: number;
  gridVisible: boolean;
  syncOrigin: boolean;
  keepPosOnOriginChange: boolean;
  theme: 'dark' | 'light';
  showMatrixLines: boolean;
  sortThresholdY: number;
  debugMode: boolean;
  layoutUnit?: 'u' | 'mm';
}

export type SmidrProject = Omit<ProjectSettings, 'vendorProductId'> & {
  id: string;
  updatedAt: number;
  keys: PhysicalKey[];
  vendorProductId?: number; // internal/localStorage and legacy .smidr
  vendorId?: string; // .smidr external representation
  productId?: string; // .smidr external representation
};

export interface SmidrProjectFileV05 {
  schemaVersion: '0.5';
  id: string;
  updatedAt: number;
  metadata: Pick<ProjectSettings, 'name' | 'manufacturer' | 'description'>;
  layout: {
    keys: PhysicalKey[];
    layoutOptions: ProjectSettings['layoutOptions'];
    activeOptions: ProjectSettings['activeOptions'];
  };
  hardware: {
    controllerType?: ProjectSettings['hardware']['controllerType'];
    mcu: ProjectSettings['hardware']['mcu'];
    board: ProjectSettings['hardware']['board'];
    diodeDirection: ProjectSettings['hardware']['diodeDirection'];
    matrix: ProjectSettings['matrix'];
    pins: ProjectSettings['pins'];
    split: boolean;
    encoders?: EncoderDefinition[];
    trackballs?: TrackballDefinition[];
  };
  firmware: {
    vendorId: string;
    productId: string;
    bootloader?: string;
    layers: number;
    features: Omit<ProjectSettings['features'], 'split'>;
    qmk?: ProjectSettings['qmk'];
    vialUid?: string;
    vial?: ProjectSettings['vial'];
    zmk?: ProjectSettings['zmk'];
    macros?: ProjectSettings['macros'];
    combos?: ProjectSettings['combos'];
    tapDances?: ProjectSettings['tapDances'];
  };
}
