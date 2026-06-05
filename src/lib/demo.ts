import { PhysicalKey, ProjectSettings, SmidrProject } from '@/types/keyboard';
import { TapDanceEntry, UniversalAction, UniversalKey } from '@/types/actions';
import { PRESET_LAYOUTS } from './presets';
import { sortKeys } from './sorting';
import { getDefaultDevelopmentBoard } from './mcu-presets';
import { parseKeyboardDefinition } from './parser';

export const DEMO_PROJECT_ID = 'smidr-demo-project';
export const DEMO_DEVICE = {
  vid: 0xFEED,
  pid: 0xD0D0,
  productName: 'Smiðr Demo Keyboard',
  manufacturerName: 'Smiðr',
  protocolType: 'vial' as const,
};

export const DEMO_TAP_DANCES: TapDanceEntry[] = [
  {
    id: 0,
    tapAction: { action: 'tap', keycode: 'ESC' },
    holdAction: { action: 'tap', keycode: 'LSFT' },
    doubleTapAction: { action: 'tap', keycode: 'CAPS' },
    tapHoldAction: { action: 'tap', keycode: 'LCTL' },
    tappingTerm: 200,
  },
  ...Array.from({ length: 7 }, (_, idx) => ({
    id: idx + 1,
    tapAction: { action: 'tap', keycode: 'A' },
    holdAction: { action: 'none' },
    doubleTapAction: { action: 'tap', keycode: 'B' },
    tapHoldAction: { action: 'none' },
    tappingTerm: 200,
  } satisfies TapDanceEntry)),
];

export const isDemoModeEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('demo')) return false;
  const value = params.get('demo');
  return value === null || value === '' || value === '1' || value.toLowerCase() === 'true';
};

const getDemoSettings = (
  layoutOptions: ProjectSettings['layoutOptions'] = {},
  activeOptions: ProjectSettings['activeOptions'] = {}
): ProjectSettings => ({
  name: 'Smiðr Demo Corne',
  manufacturer: 'Smiðr',
  description: 'Virtual keyboard project for demo mode',
  vendorProductId: (DEMO_DEVICE.vid << 16) | DEMO_DEVICE.pid,
  vialUid: '0x534D49445244454D',
  matrix: { rows: 4, cols: 12 },
  pins: {
    rows: ['GP4', 'GP5', 'GP6', 'GP7'],
    cols: ['GP8', 'GP9', 'GP10', 'GP11', 'GP12', 'GP13', 'GP14', 'GP15', 'GP16', 'GP17', 'GP18', 'GP19'],
    splitRows: [],
    splitCols: [],
    splitSerial: 'GP1',
  },
  hardware: {
    controllerType: 'development_board',
    mcu: 'RP2040',
    bootloader: 'rp2040',
    board: getDefaultDevelopmentBoard('RP2040'),
    diodeDirection: 'COL2ROW',
  },
  qmk: { matrixMasked: false, bootmagic: { enabled: true } },
  features: { rgb: true, encoder: true, oled: false, via: true, split: true },
  layers: 4,
  tapDances: DEMO_TAP_DANCES,
  layoutOptions,
  activeOptions,
  vial: {},
});

const getDemoActionForLabel = (label: string): UniversalAction => {
  const legends = label
    .split('\n')
    .map(part => part.trim())
    .filter(part => part && !/^\d+,\d+$/.test(part));
  const primary = legends[0] || '';

  if (/^[A-Z]$/.test(primary)) return { action: 'tap', keycode: primary as UniversalKey };

  const keyByLegend: Record<string, UniversalAction> = {
    Tab: { action: 'tap', keycode: 'TAB' },
    Bksp: { action: 'tap', keycode: 'BSPC' },
    Esc: { action: 'tap', keycode: 'ESC' },
    Shift: { action: 'tap', keycode: 'LSFT' },
    Alt: { action: 'tap', keycode: 'LALT' },
    Enter: { action: 'tap', keycode: 'ENT' },
    Super: { action: 'tap', keycode: 'LGUI' },
    Lower: { action: 'mo', layerId: 1 },
    Raise: { action: 'mo', layerId: 2 },
    ':': { action: 'tap', keycode: 'SCLN' },
    '<': { action: 'tap', keycode: 'COMM' },
    '>': { action: 'tap', keycode: 'DOT' },
    '?': { action: 'tap', keycode: 'SLSH' },
    '"': { action: 'tap', keycode: 'QUOT' },
  };

  return keyByLegend[primary] || { action: 'none' };
};

export const createDemoProject = (): SmidrProject => {
  const parsed = parseKeyboardDefinition(PRESET_LAYOUTS['Corne (42 keys)']);
  const parsedKeys = parsed.keys;
  const sortedKeys = sortKeys(parsedKeys, 0.25);
  const indexByKey = new Map<PhysicalKey, number>();
  sortedKeys.forEach((key, index) => indexByKey.set(key, index));

  const keys = parsedKeys.map((key) => {
    const index = indexByKey.get(key) ?? 0;
    const row = Math.floor(index / 12);
    const col = index % 12;
    const keymap: Record<number, UniversalAction> = {
      0: getDemoActionForLabel(key.label),
      1: { action: 'trans' },
      2: { action: 'trans' },
      3: { action: 'trans' },
    };

    return {
      ...key,
      row,
      col,
      keymap,
    };
  });

  return {
    id: DEMO_PROJECT_ID,
    updatedAt: Date.now(),
    ...getDemoSettings(parsed.layoutOptions || {}, parsed.activeOptions || {}),
    keys,
  };
};

export const createDemoRemoteKeymap = (keys: PhysicalKey[]): Record<number, UniversalAction[]> => {
  const remoteKeymap: Record<number, UniversalAction[]> = {};
  keys.forEach((key) => {
    if (key.row === undefined || key.col === undefined) return;
    const index = key.row * 32 + key.col;
    for (let layer = 0; layer < 4; layer++) {
      if (!remoteKeymap[layer]) remoteKeymap[layer] = [];
      remoteKeymap[layer][index] = key.keymap?.[layer] || { action: 'trans' };
    }
  });
  return remoteKeymap;
};
