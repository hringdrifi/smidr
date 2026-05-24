// src/lib/parser/types.ts

export interface KLEFormatting {
  c?: string; // key color
  t?: string; // text color
  a?: number; // alignment
  f?: number; // font size
}

export interface KLERotation {
  r?: number; // rotation angle
  rx?: number; // rotation x origin
  ry?: number; // rotation y origin
}

export interface KLEDimensions {
  w?: number;
  h?: number;
  w2?: number;
  h2?: number;
  x2?: number;
  y2?: number;
}

export interface KLEOffset {
  x?: number;
  y?: number;
}

export type KLEItem = (KLEFormatting & KLERotation & KLEDimensions & KLEOffset & { d?: boolean; l?: boolean }) | string;

export interface ParsedKey extends KLERotation, KLEDimensions {
  x: number;
  y: number;
  label: string;
  color?: string;
  textColor?: string;
  stepped?: boolean;
  decal?: boolean;
  
  // Extracted data
  matrixRow?: number;
  matrixCol?: number;
  encoderIndex?: number;
  ledIndex?: number;
  optionGroup?: number;
  optionChoice?: number;
}

export interface KeyboardDefinition {
  name?: string;
  vendorProductId?: number;
  layouts: {
    keymap: string | any[][];
    labels?: (string | string[])[];
    optionKeys?: Record<string, Record<string, any>>;
  };
}
