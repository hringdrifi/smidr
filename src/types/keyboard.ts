// src/types/keyboard.ts
import { UniversalAction } from './actions';

export interface Point { x: number; y: number; }

export interface KeymapData {
  [layerIndex: number]: UniversalAction;
}


export interface PhysicalKey {
  id?: string;   // runtime only - generated on load, stripped on save
  row?: number;  // matrix row (undefined if unassigned)
  col?: number;  // matrix col (undefined if unassigned)
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
  encoderIndex?: number;
}

export interface ProjectSettings {
  name: string;
  manufacturer: string;
  description: string;
  vendorProductId: number; // VIA style: (vid << 16) | pid
  matrix: {
    rows: number;
    cols: number;
  };
  pins: {
    rows: string[];
    cols: string[];
    rgb?: string;
    sda?: string;
    scl?: string;
    encoderA?: string;
    encoderB?: string;
  };
  hardware: {
    mcu: 'rp2040' | 'atmega32u4' | 'other';
    board: string; // e.g. "promicro", "elite_c"
    diodeDirection: 'ROW2COL' | 'COL2ROW';
  };
  features: {
    rgb: boolean;
    encoder: boolean;
    oled: boolean;
    vial: boolean;
    via: boolean;
  };
  layers: number;
  layoutOptions: {
    [groupId: string]: {
      name: string; // e.g. "Backspace"
      type: 'toggle' | 'list';
      choices?: string[]; // only for list type
    }
  };
  activeOptions: Record<string, number>; // index: 0 for Off, 1 for On in toggle; choice index for list
  vialUid?: string; // 64-bit Vial UID (hex string, e.g. "0x123456789ABCDEF0")
  vid?: string; // Legacy optional vid string
  pid?: string; // Legacy optional pid string
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
}

export type SmidrProject = ProjectSettings & {
  id: string;
  updatedAt: number;
  keys: PhysicalKey[];
};
