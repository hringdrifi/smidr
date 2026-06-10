import { create, StateCreator } from 'zustand';
import { temporal } from 'zundo';
import { EncoderDefinition, PhysicalKey, ProjectSettings, EditorSettings, SmidrProject } from '@/types/keyboard';
import { UniversalAction, MacroAction, ComboEntry, TapDanceEntry } from '@/types/actions';
import { deserializeMacros, serializeMacros } from './protocols/vial-macro-converter';
import { Language } from './i18n';
import { sortKeys } from './sorting';
import { hidTransport } from './transport/hid';
import { ViaProtocol } from './protocols/via';
import { vialCodeToAction } from './protocols/vial-action-converter';
import { parseKeyboardDefinition } from './parser';
import { convertVialToSmidr, packLayoutOptions } from './protocols/vial-converter';
import { VialProtocol } from './protocols/vial';
import { DeviceCapability, ITransport } from './transport/types';
import { ZmkLayerMetadata, ZmkProtocol, zmkProtocol } from './protocols/zmk';
import { qmkStringToAction, viaCodeToAction } from './protocols/via-action-converter';
import {
  getStoredAppMode,
  getStoredEditorMode,
  getStoredTheme,
  setStoredAppMode,
  setStoredEditorMode,
  setStoredTheme,
  getStoredLanguage,
  setStoredLanguage,
  getStoredVisualLayout,
  setStoredVisualLayout
} from './storage';
import { getDefaultDevelopmentBoard } from './mcu-presets';
import { getKeyVertices, PADDING_X } from './canvas-utils';
import { normalizeVisualLayout, VisualLayoutId } from './visual-layouts';
import { createDemoProject, createDemoRemoteKeymap, DEMO_DEVICE, DEMO_TAP_DANCES, isDemoModeEnabled } from './demo';
import {
  getLocalMatrixPosition,
  getMatrixFromPins,
  inferMatrixSideFromGeometry,
  MatrixSide,
} from './matrix-utils';
import { getRgbMatrixBounds, getRgbMatrixLedPosition } from './rgb-matrix';

export { getMatrixFromPins } from './matrix-utils';

export type RuntimeKey = PhysicalKey & { id: string };
type RuntimeEncoder = EncoderDefinition & { id: string };
type EditorMode = 'layout' | 'matrix' | 'hardware' | 'keymap' | 'rgbMatrix';

const createEmptyMacros = (count = 16): MacroAction[][] => Array.from({ length: count }, () => []);

const normalizeMacros = (macros?: MacroAction[][], count = 16): MacroAction[][] => (
  Array.from({ length: Math.max(count, macros?.length || 0) }, (_, idx) => macros?.[idx] || [])
);

const normalizeEncoders = (
  encoders?: EncoderDefinition[],
  keys: PhysicalKey[] = []
): RuntimeEncoder[] => {
  const maxReferencedIndex = keys.reduce((max, key) => (
    key.encoderIndex !== undefined ? Math.max(max, key.encoderIndex) : max
  ), -1);
  const count = Math.max(encoders?.length || 0, maxReferencedIndex + 1);

  return Array.from({ length: count }, (_, index) => ({
    ...(encoders?.[index] || {}),
    id: encoders?.[index]?.id || crypto.randomUUID(),
  }));
};

const assignRuntimeEncoderIds = <T extends PhysicalKey>(
  keys: T[],
  encoders: RuntimeEncoder[]
) => keys.map(key => {
  if (key.encoderId || key.encoderIndex === undefined) return key;
  const encoder = encoders[key.encoderIndex];
  if (!encoder) return key;
  const { encoderIndex, ...keyWithoutIndex } = key;
  return { ...keyWithoutIndex, encoderId: encoder.id };
}) as T[];

const getReferencedEncoders = (
  encoders: RuntimeEncoder[] = [],
  keys: PhysicalKey[] = []
): RuntimeEncoder[] => {
  const referencedEncoderIds = new Set(keys.map(key => key.encoderId).filter(Boolean));
  return encoders.filter(encoder => referencedEncoderIds.has(encoder.id));
};

export const getCenteredTransform = (keys: PhysicalKey[], activeOptions: Record<string, number> = {}) => {
  const visKeys = keys.filter(k => !k.group || (activeOptions[k.group] ?? 0) === k.option);
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  visKeys.forEach(k => {
    const vertices = getKeyVertices(k);
    vertices.forEach(v => {
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });
  });

  const hasKeys = visKeys.length > 0;
  const keyboardWidth = hasKeys ? (maxX - minX) : 0;
  const keyboardCenterX = hasKeys ? (minX + keyboardWidth / 2) : 0;

  const container = typeof document !== 'undefined' ? document.getElementById('keyboard-canvas-container') : null;
  const stageWidth = container ? container.clientWidth : 1000;

  const resetX = stageWidth / 2 - PADDING_X - keyboardCenterX;
  const resetY = 0;

  return { scale: 1, x: resetX, y: resetY };
};

export interface KeyboardState {
  settings: ProjectSettings;
  editorSettings: EditorSettings;
  transform: { scale: number, x: number, y: number };
  keys: RuntimeKey[];
  baseKeys: RuntimeKey[]; // Original keys before overrides

  // History Actions
  undo: () => void;
  redo: () => void;

  // Global Actions
  updateSettings: (settings: Partial<ProjectSettings>) => void;
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  setVisualLayout: (layout: VisualLayoutId) => void;
  setTransform: (transform: { scale: number, x: number, y: number }) => void;
  setActiveOption: (groupId: string, value: number) => void;
  
  // Key Manipulation
  addKey: (key: Partial<PhysicalKey>) => void;
  addKeys: (keys: Partial<PhysicalKey>[], options?: { skipCollision?: boolean }) => void;
  updateKey: (id: string, key: Partial<PhysicalKey>, round?: boolean) => void;
  batchUpdateKeys: (ids: string[], updates: Partial<PhysicalKey> | ((key: PhysicalKey) => Partial<PhysicalKey>), round?: boolean) => void;
  removeKey: (id: string) => void;
  loadKeys: (newKeys: PhysicalKey[]) => void;
  
  // Selection
  selectedKeyIds: string[];
  focusedKeyId: string | null;
  selectionAnchorId: string | null;
  setSelectedKeyIds: (ids: string[]) => void;
  setFocusedKeyId: (id: string | null) => void;
  setSelectionAnchorId: (id: string | null) => void;
  toggleKeySelection: (id: string, multi: boolean) => void;

  // Editor Modes & Layers
  appMode: 'design' | 'remap';
  setAppMode: (mode: 'design' | 'remap') => void;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  currentLayer: number;
  encoderActionDirection: 'counterClockwise' | 'clockwise' | 'button';
  setEncoderActionDirection: (direction: 'counterClockwise' | 'clockwise' | 'button') => void;
  setCurrentLayer: (layer: number) => void;
  addLayer: () => void;
  removeLastLayer: () => void;
  setKeycode: (keyId: string, layer: number, action: UniversalAction) => void;

  // Remap Mode Specific
  connectedDevice: { vid: number; pid: number; productName?: string; manufacturerName?: string; protocolType?: 'via' | 'vial' | 'zmk' } | null;
  setConnectedDevice: (device: KeyboardState['connectedDevice']) => void;
  deviceCapabilities: DeviceCapability | null;
  setDeviceCapabilities: (caps: DeviceCapability | null) => void;
  activeTransport: ITransport | null;
  setActiveTransport: (transport: ITransport | null) => void;
  remoteKeymap: Record<number, UniversalAction[]>; // layer -> array of actions
  setRemoteKeymap: (keymap: Record<number, UniversalAction[]>) => void;
  syncKeymap: () => Promise<void>;
  isKeymapSyncing: boolean;
  zmkLayerMetadata: ZmkLayerMetadata | null;
  setZmkLayerMetadata: (metadata: ZmkLayerMetadata | null) => void;
  zmkTapDanceIds: number[];
  setZmkTapDanceIds: (ids: number[]) => void;
  renameZmkLayer: (layerIndex: number, name: string) => Promise<void>;
  addZmkLayer: () => Promise<void>;
  removeLastZmkLayer: () => Promise<void>;
  zmkLocked: boolean;
  setZmkLocked: (locked: boolean) => void;
  zmkUnsavedChanges: boolean;
  setZmkUnsavedChanges: (unsaved: boolean) => void;
  updateRemoteKeycode: (layer: number, index: number, action: UniversalAction) => void;
  updateDeviceKeycode: (layer: number, row: number, col: number, action: UniversalAction) => Promise<void>;
  
  // Macros & Combos
  remoteMacros: MacroAction[][];
  remoteCombos: ComboEntry[];
  remoteTapDances: TapDanceEntry[];
  macroPanelActiveTab: 'macros' | 'combos' | 'tapDance';
  selectedMacroId: number;
  macroSettingsOpenRequest: number;
  selectedTapDanceId: number;
  tapDanceSettingsOpenRequest: number;
  setRemoteMacros: (macros: MacroAction[][]) => void;
  setRemoteCombos: (combos: ComboEntry[]) => void;
  setRemoteTapDances: (tapDances: TapDanceEntry[]) => void;
  setMacroPanelActiveTab: (tab: KeyboardState['macroPanelActiveTab']) => void;
  setSelectedMacroId: (id: number) => void;
  openMacroSettings: (id: number) => void;
  setSelectedTapDanceId: (id: number) => void;
  openTapDanceSettings: (id: number) => void;
  updateProjectMacro: (id: number, actions: MacroAction[]) => void;
  addProjectCombo: () => void;
  updateProjectCombo: (index: number, combo: ComboEntry) => void;
  removeProjectCombo: (index: number) => void;
  updateRemoteMacro: (id: number, actions: MacroAction[]) => Promise<void>;
  updateRemoteCombo: (index: number, combo: ComboEntry) => Promise<void>;
  updateRemoteTapDance: (index: number, entry: TapDanceEntry) => Promise<void>;
  updateTapDance: (id: number, entry: TapDanceEntry) => void;
  removeTapDance: (id: number) => void;
  syncMacrosAndCombos: (existingProtocol?: VialProtocol) => Promise<void>;

  // Matrix Painting
  setMatrixPosition: (id: string, row: number | undefined, col: number | undefined, side?: MatrixSide) => void;
  addEncoderToKey: (keyId: string) => void;
  addEncoderKey: () => void;
  updateEncoder: (encoderId: string, updates: Partial<EncoderDefinition>) => void;
  painter: { currentRow: number; currentCol: number; currentSide: MatrixSide; autoIncrement: 'matrix' | 'col' | 'row'; };
  setPainter: (painter: Partial<KeyboardState['painter']>) => void;
  paintKey: (id: string) => void;
  matrixPaintMode: boolean;
  setMatrixPaintMode: (enabled: boolean) => void;
  
  // Hardware/Pins
  setPin: (type: 'row' | 'col' | 'splitRow' | 'splitCol' | 'feature', index: number | string, pin: string) => void;
  
  // Layout Tools
  alignSelectedKeys: (type: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y') => void;
  distributeSelectedKeys: (type: 'horizontal' | 'vertical') => void;

  // Layout Option Group Management
  addLayoutOptionGroup: (name: string) => string;
  removeLayoutOptionGroup: (groupId: string) => void;
  addLayoutOptionChoice: (groupId: string, choiceName: string) => void;
  removeLayoutOptionChoice: (groupId: string, choiceIndex: number) => void;
  renameLayoutOptionChoice: (groupId: string, choiceIndex: number, newName: string) => void;
  setLayoutOptionGroupType: (groupId: string, type: 'toggle' | 'list') => void;

  unlockState: {
    showModal: boolean;
    progress: number;
    status: 'idle' | 'holding' | 'success' | 'failed';
    statusText: string;
    unlockKeys: { row: number; col: number }[];
    cancelRequested: boolean;
  };
  setUnlockState: (state: Partial<KeyboardState['unlockState']>) => void;
  cancelDeviceUnlock: () => void;
  performDeviceUnlock: (protocol: VialProtocol) => Promise<boolean>;

  // Project Management
  currentProjectId: string | null;
  isProjectOpen: boolean;
  loadProject: (project: SmidrProject, preserveTransform?: boolean) => void;
  importKeyboardDefinition: (input: any) => void;
  setIsProjectOpen: (open: boolean) => void;
  isHardwareModalOpen: boolean;
  setIsHardwareModalOpen: (open: boolean) => void;
  resetProject: (keepOpen?: boolean) => void;

  // Matrix Tools
  clearMatrixMap: () => void;
  generateMatrix: (rows: number, cols: number) => void;
  autoAssignMatrix: () => void;
  clearRgbMatrix: () => void;
  autoAssignRgbMatrix: () => void;

  // i18n
  language: Language;
  setLanguage: (lang: Language) => void;
  historyId: number;
  canvasDimensions: { width: number, height: number };
  setCanvasDimensions: (dimensions: { width: number, height: number }) => void;
  previewKeys: RuntimeKey[] | null;
  setPreviewKeys: (keys: RuntimeKey[] | null) => void;
  commitPreviewKeys: () => void;

  // Clipboard
  clipboard: RuntimeKey[];
  matrixClipboard: { row?: number; col?: number; matrixSide?: MatrixSide }[];
  actionClipboard: UniversalAction[];
  copyKeys: () => void;
  pasteKeys: () => void;
  setSelectedKeycode: (action: UniversalAction) => Promise<void>;

  // Demo Mode
  isDemoMode: boolean;
  initializeDemoMode: () => void;
  connectDemoDevice: () => void;
  disconnectDemoDevice: () => void;
}

const generateRandomVialUid = (): string => {
  const p1 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
  const p2 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
  return `0x${p1}${p2}`;
};

const initialState: Partial<KeyboardState> = {
  settings: {
    name: 'New Project',
    manufacturer: 'Custom',
    description: 'A custom keyboard layout',
    vendorProductId: 0xFEED0001,
    vialUid: generateRandomVialUid(),
    matrix: { rows: 0, cols: 0, wiring: 'matrix' },
    pins: { rows: [], cols: [], splitRows: [], splitCols: [] },
    hardware: {
      controllerType: 'development_board',
      mcu: 'RP2040',
      bootloader: 'rp2040',
      board: getDefaultDevelopmentBoard('RP2040'),
      diodeDirection: 'COL2ROW',
    },
    qmk: { matrixMasked: false, bootmagic: { enabled: true } },
    features: { rgb: false, backlight: false, rgbMatrix: false, encoder: false, oled: false, via: true, split: false },
    layers: 4,
    encoders: [],
    macros: createEmptyMacros(),
    combos: [],
    tapDances: [],
    visualLayout: getStoredVisualLayout(),
    layoutOptions: {},
    activeOptions: {},
    vial: {},
    zmk: {},
  },
  editorSettings: { 
    gridSnap: 0.25, 
    gridVisible: true, 
    syncOrigin: true, 
    keepPosOnOriginChange: false, 
    theme: getStoredTheme() ?? 'dark', 
    showMatrixLines: false, 
    sortThresholdY: 0.25,
    debugMode: false
  },
  transform: { scale: 1, x: 0, y: 0 },
  keys: [],
  baseKeys: [],
  selectedKeyIds: [],
  focusedKeyId: null,
  selectionAnchorId: null,
  appMode: isDemoModeEnabled() ? 'remap' : getStoredAppMode(),
  editorMode: getStoredEditorMode(),
  currentLayer: 0,
  encoderActionDirection: 'button',
  connectedDevice: null,
  deviceCapabilities: null,
  activeTransport: null,
  remoteKeymap: {},
  isKeymapSyncing: false,
  zmkLayerMetadata: null,
  zmkTapDanceIds: [],
  remoteMacros: createEmptyMacros(),
  remoteCombos: [],
  remoteTapDances: [],
  macroPanelActiveTab: 'macros',
  selectedMacroId: 0,
  macroSettingsOpenRequest: 0,
  selectedTapDanceId: 0,
  tapDanceSettingsOpenRequest: 0,
  painter: { currentRow: 0, currentCol: 0, currentSide: 'left', autoIncrement: 'matrix' },
  matrixPaintMode: false,
  currentProjectId: null,
  isProjectOpen: false,
  isHardwareModalOpen: false,
  language: getStoredLanguage(),
  historyId: 0,
  canvasDimensions: { width: 1000, height: 800 },
  previewKeys: null,
  clipboard: [],
  matrixClipboard: [],
  actionClipboard: [],
  isDemoMode: isDemoModeEnabled(),
  zmkLocked: false,
  zmkUnsavedChanges: false,
  unlockState: {
    showModal: false,
    progress: 0,
    status: 'idle',
    statusText: '',
    unlockKeys: [],
    cancelRequested: false,
  },
};

const roundCoord = (v: number) => Math.round(v * 10000000) / 10000000;
const roundRot = (v: number) => Math.round(v * 100) / 100;
const isZmkDebugLoggingEnabled = () => (
  typeof localStorage !== 'undefined' && localStorage.getItem('smidr:zmk-debug') === '1'
);

const getMatrixDimensionsFromKeys = (
  keys: PhysicalKey[],
  fallback: ProjectSettings['matrix'] = { rows: 6, cols: 16 }
): ProjectSettings['matrix'] => {
  const matrixKeys = keys.filter(k => k.row !== undefined && k.col !== undefined);
  if (matrixKeys.length === 0) return fallback;

  return {
    rows: Math.max(...matrixKeys.map(k => k.row ?? 0)) + 1,
    cols: Math.max(...matrixKeys.map(k => k.col ?? 0)) + 1,
  };
};

const parseProjectUsbId = (value: unknown): number | undefined => {
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
};

const getProjectVendorProductId = (project: SmidrProject): number | undefined => {
  if (typeof project.vendorProductId === 'number' && Number.isFinite(project.vendorProductId)) {
    return project.vendorProductId;
  }

  const vid = parseProjectUsbId(project.vendorId);
  const pid = parseProjectUsbId(project.productId);
  if (vid === undefined || pid === undefined) return undefined;
  return (vid << 16) | pid;
};

const getGeneratedZmkProjectSettings = (
  state: KeyboardState,
  keys: PhysicalKey[],
  layerCount: number,
  keyboardName?: string
): ProjectSettings => {
  const deviceVendorProductId = state.connectedDevice
    ? (state.connectedDevice.vid << 16) | state.connectedDevice.pid
    : 0;

  return {
    ...state.settings,
    name: keyboardName || state.settings.name || 'ZMK Keyboard',
    manufacturer: state.connectedDevice?.manufacturerName || state.settings.manufacturer || 'ZMK',
    vendorProductId: deviceVendorProductId || state.settings.vendorProductId,
    layers: layerCount,
    matrix: getMatrixDimensionsFromKeys(keys, state.settings.matrix),
  };
};

const getRemoteKeymapIndex = (key: Pick<PhysicalKey, 'row' | 'col' | 'zmkPosition'>): number | undefined => {
  if (key.zmkPosition !== undefined) return key.zmkPosition;
  if (key.row !== undefined && key.col !== undefined) return key.row * 32 + key.col;
  return undefined;
};

const retargetLayerAction = (action: UniversalAction, deletedLayer: number): UniversalAction => {
  if (action.action === 'mo' || action.action === 'tg' || action.action === 'to') {
    return action.layerId === deletedLayer ? { ...action, layerId: 0 } : action;
  }
  if (action.action === 'lt') {
    return action.layerId === deletedLayer ? { ...action, layerId: 0 } : action;
  }
  if (action.action === 'mt') {
    return { ...action, tapAction: retargetLayerAction(action.tapAction, deletedLayer) };
  }
  return action;
};

const retargetTapDance = (entry: TapDanceEntry, deletedLayer: number): TapDanceEntry => ({
  ...entry,
  tapAction: retargetLayerAction(entry.tapAction, deletedLayer),
  doubleTapAction: entry.doubleTapAction ? retargetLayerAction(entry.doubleTapAction, deletedLayer) : undefined,
  holdAction: entry.holdAction ? retargetLayerAction(entry.holdAction, deletedLayer) : undefined,
  tapHoldAction: entry.tapHoldAction ? retargetLayerAction(entry.tapHoldAction, deletedLayer) : undefined,
});

const removeLayerFromKeymap = (
  keymap: Record<number, UniversalAction> | undefined,
  deletedLayer: number
): Record<number, UniversalAction> | undefined => {
  if (!keymap) return keymap;
  const next: Record<number, UniversalAction> = {};
  Object.entries(keymap).forEach(([layer, action]) => {
    const layerIndex = Number(layer);
    if (layerIndex === deletedLayer) return;
    next[layerIndex] = retargetLayerAction(action, deletedLayer);
  });
  return next;
};

const removeLayerFromRemoteKeymap = (
  keymap: Record<number, UniversalAction[]>,
  deletedLayer: number
): Record<number, UniversalAction[]> => {
  const next: Record<number, UniversalAction[]> = {};
  Object.entries(keymap).forEach(([layer, actions]) => {
    const layerIndex = Number(layer);
    if (layerIndex === deletedLayer) return;
    next[layerIndex] = actions.map(action => retargetLayerAction(action, deletedLayer));
  });
  return next;
};

/**
 * Consistency Middleware
 */
const withConsistency = (config: any): any => (set: any, get: any, api: any) => config(
  (args: any) => {
    const currentState = get();
    const nextUpdate = typeof args === 'function' ? (args as any)(currentState) : args;
    const nextState = { ...currentState, ...nextUpdate };

    // Prune selections if keys changed (and not in preview mode)
    if (nextState.keys && nextState.selectedKeyIds && !nextState.previewKeys) {
      const validSelected = nextState.selectedKeyIds.filter((id: string) => 
        nextState.keys.some((k: PhysicalKey) => k.id === id)
      );
      if (validSelected.length !== nextState.selectedKeyIds.length) {
        nextUpdate.selectedKeyIds = validSelected;
      }
    }

    if (nextState.keys && nextState.focusedKeyId && !nextState.previewKeys) {
      const exists = nextState.keys.some((k: PhysicalKey) => k.id === nextState.focusedKeyId);
      if (!exists) {
        nextUpdate.focusedKeyId = null;
      }
    }

    set(nextUpdate);
  },
  get,
  api
);

export const useKeyboardStore = create<KeyboardState>()(
  withConsistency(
    temporal(
      (set, get) => ({
        ...initialState as KeyboardState,

        undo: (): void => (useKeyboardStore as any).temporal.getState().undo(),
        redo: (): void => (useKeyboardStore as any).temporal.getState().redo(),

        setPreviewKeys: (pk: RuntimeKey[] | null) => set({ previewKeys: pk }),
        commitPreviewKeys: () => set((s) => ({
          keys: s.previewKeys || s.keys,
          previewKeys: null
        })),

        setZmkLayerMetadata: (metadata: ZmkLayerMetadata | null) => set({ zmkLayerMetadata: metadata }),
        setZmkTapDanceIds: (ids: number[]) => set({ zmkTapDanceIds: ids }),
        setZmkLocked: (locked: boolean) => set({ zmkLocked: locked }),
        setZmkUnsavedChanges: (unsaved: boolean) => set({ zmkUnsavedChanges: unsaved }),
        initializeDemoMode: () => {
          const project = createDemoProject();
          const projectSettings = (({ id: _id, updatedAt: _updatedAt, keys: _keys, ...settings }) => settings)(project);
          const keys = project.keys.map(k => ({
            ...k,
            id: crypto.randomUUID(),
            keymap: k.keymap as Record<number, UniversalAction> | undefined,
          })) as RuntimeKey[];
          set((state) => ({
            isDemoMode: true,
            appMode: 'remap',
            editorMode: 'layout',
            settings: {
              ...projectSettings,
              macros: normalizeMacros(projectSettings.macros),
              combos: projectSettings.combos || [],
              visualLayout: normalizeVisualLayout(state.settings.visualLayout),
            } as ProjectSettings,
            keys,
            baseKeys: keys,
            currentProjectId: project.id,
            isProjectOpen: true,
            selectedKeyIds: [],
            focusedKeyId: null,
            selectionAnchorId: null,
            currentLayer: 0,
            connectedDevice: DEMO_DEVICE,
            deviceCapabilities: {
              hasMacros: true,
              hasLighting: true,
              hasRotaryEncoder: true,
              hasCombos: true,
              hasTapDance: true,
              hasMouseKeys: true,
            },
            activeTransport: null,
            remoteKeymap: createDemoRemoteKeymap(keys),
            isKeymapSyncing: false,
            remoteMacros: createEmptyMacros(),
            remoteCombos: [],
            remoteTapDances: DEMO_TAP_DANCES,
            zmkLayerMetadata: null,
            zmkTapDanceIds: [],
            zmkLocked: false,
            zmkUnsavedChanges: false,
            transform: getCenteredTransform(keys, project.activeOptions || {}),
          }));
        },
        connectDemoDevice: () => {
          const state = get();
          if (!state.isDemoMode) return;
          if (!state.isProjectOpen || state.keys.length === 0) {
            get().initializeDemoMode();
            return;
          }
          set({
            connectedDevice: DEMO_DEVICE,
            deviceCapabilities: {
              hasMacros: true,
              hasLighting: true,
              hasRotaryEncoder: true,
              hasCombos: true,
              hasTapDance: true,
              hasMouseKeys: true,
            },
            activeTransport: null,
            remoteKeymap: Object.keys(state.remoteKeymap).length > 0
              ? state.remoteKeymap
              : createDemoRemoteKeymap(state.keys),
            remoteTapDances: state.remoteTapDances.length > 0 ? state.remoteTapDances : DEMO_TAP_DANCES,
          });
        },
        disconnectDemoDevice: () => {
          if (!get().isDemoMode) return;
          set({
            connectedDevice: null,
            deviceCapabilities: null,
            activeTransport: null,
            selectedKeyIds: [],
            zmkTapDanceIds: [],
          });
        },

        updateSettings: (sets: Partial<ProjectSettings>) => set((s) => {
          const nextSettings = { ...s.settings, ...sets };
          if (sets.visualLayout) {
            nextSettings.visualLayout = normalizeVisualLayout(sets.visualLayout);
            setStoredVisualLayout(nextSettings.visualLayout);
          }
          if (sets.pins || sets.features?.split !== undefined) {
            const pinMatrix = getMatrixFromPins(nextSettings.pins, nextSettings.features.split);
            if (pinMatrix) {
              nextSettings.matrix = { ...pinMatrix, wiring: nextSettings.matrix?.wiring || 'matrix' };
            }
          }
          return { settings: nextSettings };
        }),

        updateEditorSettings: (es: Partial<EditorSettings>) => {
          if (es.theme) setStoredTheme(es.theme);
          set((s) => ({
            editorSettings: { ...s.editorSettings, ...es }
          }));
        },

        setVisualLayout: (layout: VisualLayoutId) => {
          const nextLayout = normalizeVisualLayout(layout);
          setStoredVisualLayout(nextLayout);
          set((s) => ({
            settings: { ...s.settings, visualLayout: nextLayout }
          }));
        },

        setTransform: (t: { scale: number, x: number, y: number }) => set({ transform: t }),

        setUnlockState: (state: Partial<KeyboardState['unlockState']>) => set((s: any) => ({
          unlockState: { ...s.unlockState, ...state }
        })),

        cancelDeviceUnlock: () => set((s: KeyboardState) => ({
          unlockState: {
            ...s.unlockState,
            showModal: false,
            progress: 0,
            status: 'idle',
            statusText: '',
            unlockKeys: [],
            cancelRequested: true,
          }
        })),

        performDeviceUnlock: async (protocol: VialProtocol): Promise<boolean> => {
          const { setUnlockState } = get();
          const finishCancelledUnlock = async () => {
            try {
              await protocol.lock();
            } catch (lockErr) {
              console.warn('Failed to lock device after unlock cancellation:', lockErr);
            }
            setUnlockState({
              showModal: false,
              progress: 0,
              status: 'idle',
              statusText: '',
              unlockKeys: [],
              cancelRequested: false,
            });
          };

          let unlockKeys: { row: number; col: number }[] = [];
          try {
            unlockKeys = await protocol.getUnlockKeys();
            console.log("Device unlock keys:", unlockKeys);
          } catch (keysErr) {
            console.warn("Failed to fetch unlock keys from device:", keysErr);
          }

          setUnlockState({
            showModal: true,
            progress: 0,
            status: 'holding',
            statusText: 'Press and hold the unlock key combination on your keyboard.',
            unlockKeys,
            cancelRequested: false,
          });

          try {
            await protocol.unlockStart();
            const startTime = Date.now();
            const timeoutMs = 30000;
            let maxCounter = 1;
            
            while (Date.now() - startTime < timeoutMs) {
              if (get().unlockState.cancelRequested) {
                await finishCancelledUnlock();
                return false;
              }

              const poll = await protocol.unlockPoll();
              if (get().unlockState.cancelRequested) {
                await finishCancelledUnlock();
                return false;
              }

              if (poll.unlocked === 1) {
                setUnlockState({
                  progress: 100,
                  status: 'success',
                  statusText: 'Unlock successful! Continuing write operation...'
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
                setUnlockState({ showModal: false });
                return true;
              }
              
              const curVal = poll.unlockCounter;
              maxCounter = Math.max(maxCounter, curVal);
              const progressPercent = maxCounter > 0 
                ? Math.round(((maxCounter - curVal) / maxCounter) * 100)
                : 0;
              
              setUnlockState({
                progress: Math.min(99, Math.max(0, progressPercent)),
                status: 'holding',
                statusText: `Holding... ${progressPercent}%`
              });

              await new Promise(resolve => setTimeout(resolve, 200));
              if (get().unlockState.cancelRequested) {
                await finishCancelledUnlock();
                return false;
              }
            }
            
            setUnlockState({
              status: 'failed',
              statusText: 'Unlock timed out. Please try again.'
            });
            try {
              await protocol.lock();
            } catch (lockErr) {
              console.warn('Failed to lock device on timeout:', lockErr);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            setUnlockState({ showModal: false });
            return false;
          } catch (err: any) {
            console.error('Unlock error:', err);
            setUnlockState({
              status: 'failed',
              statusText: err.message || 'Unlock failed.'
            });
            try {
              await protocol.lock();
            } catch (lockErr) {
              console.warn('Failed to lock device on error:', lockErr);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            setUnlockState({ showModal: false });
            return false;
          }
        },

        syncKeymap: async () => {
          const s = get();
          if (!s.connectedDevice) return;
          if (s.isDemoMode) {
            set({
              isKeymapSyncing: false,
              remoteKeymap: Object.keys(s.remoteKeymap).length > 0
                ? s.remoteKeymap
                : createDemoRemoteKeymap(s.keys),
            });
            return;
          }
          
          set({ isKeymapSyncing: true, zmkLocked: false, zmkUnsavedChanges: false, zmkLayerMetadata: null, zmkTapDanceIds: [] });

          try {
            const isZmk = s.connectedDevice?.protocolType === 'zmk';
            const isVial = s.connectedDevice?.protocolType === 'vial';
            const protocol = isZmk
              ? zmkProtocol
              : (isVial ? new VialProtocol() : new ViaProtocol());

            if (isZmk) {
              (protocol as ZmkProtocol).setNotificationHandler((notification) => {
                const nextState: Partial<KeyboardState> = {};
                let shouldSyncAfterUnlock = false;
                if (notification.lockStateChanged !== undefined) {
                  const wasLocked = get().zmkLocked;
                  nextState.zmkLocked = notification.lockStateChanged !== 1;
                  shouldSyncAfterUnlock = wasLocked && !nextState.zmkLocked;
                }
                if (notification.unsavedChangesStatusChanged !== undefined) {
                  nextState.zmkUnsavedChanges = notification.unsavedChangesStatusChanged;
                }
                set(nextState);
                if (shouldSyncAfterUnlock) {
                  void get().syncKeymap();
                }
              });
            }

            await protocol.initialize(s.activeTransport || hidTransport);
            set({ deviceCapabilities: protocol.capabilities });

            let positions: Array<{ row: number; col: number; index: number }> = [];
            let layerCount = 3;

            if (isZmk) {
              try {
                const success = await (protocol as ZmkProtocol).fetchMetadata();
                if (!success) {
                  console.error('[syncKeymap:ZMK] ZMK Metadata Failure: Could not read keyboard layout from device. Aborting keymap sync.');
                  throw new Error('ZMK Metadata Failure: Could not read keyboard layout from device.');
                }
              } catch (err: any) {
                if (err.message && (err.message.includes('locked') || err.message.includes('Unlock'))) {
                  console.warn('[syncKeymap:ZMK] ZMK lock state detected. Aborting keymap sync.');
                  set({ zmkLocked: true });
                  return;
                }
                throw err;
              }
              
              const zmkProto = protocol as ZmkProtocol;
              await zmkProto.fetchBehaviorMetadata();
              const hasPhysicalLayout = zmkProto.selectedLayoutName != null && zmkProto.physicalKeys.length > 0;
              const hasKeymap = zmkProto.keymapAvailable === true;

              if (!hasPhysicalLayout) {
                console.warn('[syncKeymap:ZMK] Layout metadata is unavailable. Skipping keymap sync completely.');
                return;
              }

              positions = await zmkProto.getKeyPositions();
              layerCount = zmkProto.layerCount;
              const selectedLayoutName = zmkProto.selectedLayoutName;
              const zmkLayerMetadata = zmkProto.getLayerMetadata();
              const zmkTapDanceIds = zmkProto.getSmidrTapDanceIds();

              if (isZmkDebugLoggingEnabled()) {
                console.log('[ZMK sync]', {
                  layerCount,
                  physicalLayout: selectedLayoutName,
                  positionCount: zmkProto.physicalKeys.length,
                  layerMetadata: zmkLayerMetadata,
                  tapDanceIds: zmkTapDanceIds,
                });
              }

              set((state) => ({
                settings: {
                  ...state.settings,
                  layers: layerCount,
                  name: state.keys.length === 0 ? (zmkProto.keyboardName || state.settings.name) : state.settings.name
                },
                zmkLayerMetadata,
                zmkTapDanceIds
              }));

              if (!hasKeymap) {
                console.warn('[syncKeymap:ZMK] Physical layout loaded, but keymap unavailable. Generating layout-only runtime keys.');
                let updatedKeys = [...s.keys];
                if (s.keys.length === 0) {
                  if (zmkProto.physicalKeys && zmkProto.physicalKeys.length > 0) {
                    updatedKeys = zmkProto.physicalKeys.map((pk) => {
                      return {
                        id: crypto.randomUUID(),
                        label: `P${pk.zmkPosition}`,
                        x: pk.x,
                        y: pk.y,
                        w: pk.w,
                        h: pk.h,
                        r: pk.r,
                        rx: pk.rx,
                        ry: pk.ry,
                        zmkPosition: pk.zmkPosition,
                        keymap: {}
                      } as RuntimeKey;
                    });
                  } else if (positions.length > 0) {
                    updatedKeys = positions.map((p) => {
                      const col = p.col;
                      const row = p.row;
                      const x = col * 1.25;
                      const y = row * 1.25;
                      return {
                        id: crypto.randomUUID(),
                        label: `R${row}C${col}`,
                        x,
                        y,
                        w: 1,
                        h: 1,
                        r: 0,
                        rx: x,
                        ry: y,
                        row,
                        col,
                        keymap: {}
                      } as RuntimeKey;
                    });
                  }
                }
                const shouldOpenGeneratedZmkProject = s.keys.length === 0 && updatedKeys.length > 0;
                set((state) => ({
                  keys: updatedKeys,
                  baseKeys: updatedKeys,
                  ...(shouldOpenGeneratedZmkProject ? {
                    settings: getGeneratedZmkProjectSettings(state, updatedKeys, layerCount, zmkProto.keyboardName),
                    currentProjectId: crypto.randomUUID(),
                    isProjectOpen: true,
                    selectedKeyIds: [],
                    focusedKeyId: null,
                    selectionAnchorId: null,
                    currentLayer: 0,
                    transform: getCenteredTransform(updatedKeys, state.settings.activeOptions || {}),
                  } : {})
                }));

                // Background lock probe for ZMK
                setTimeout(async () => {
                  try {
                    if (isZmkDebugLoggingEnabled()) {
                      console.log('[ZmkProtocol] Running background keymap lock probe on Layer 0, Position 0...');
                    }
                    const succeeded = await zmkProto.testReadBinding(0, 0);
                    if (succeeded) {
                      if (isZmkDebugLoggingEnabled()) {
                        console.log('[ZmkProtocol] Background probe succeeded! Device is unlocked.');
                      }
                      set({ zmkLocked: false });
                    } else {
                      console.warn('[ZmkProtocol] Background probe failed or unsupported.');
                    }
                  } catch (probeErr: any) {
                    console.warn('[ZmkProtocol] Background probe failed:', probeErr);
                    if (probeErr.message && (probeErr.message.includes('locked') || probeErr.message.includes('Unlock'))) {
                      set({ zmkLocked: true });
                    }
                  }
                }, 50);

                return;
              }
            } else {
              layerCount = await protocol.getLayerCount();
            }

            if (!isZmk) {
              set((state) => ({
                settings: {
                  ...state.settings,
                  layers: layerCount,
                  name: state.settings.name
                }
              }));
            }

            const matrixRows = s.settings.matrix?.rows || 6;
            const matrixCols = s.settings.matrix?.cols || 16;
            
            let newRemoteKeymap: Record<number, UniversalAction[]> = {};
            if (isZmk) {
              newRemoteKeymap = (protocol as ZmkProtocol).getCachedKeymapActions();
            } else {
              for (let l = 0; l < Math.min(layerCount, 16); l++) {
                const layerActions: UniversalAction[] = [];
                const keysToFetch = matrixRows * matrixCols; 
                const keysPerPacket = 14;

                if (!isZmk) {
                  // High-speed batch fetch for VIA/Vial
                  const layerOffset = l * matrixRows * matrixCols * 2;
                  console.log(`Layer ${l}: Syncing ${keysToFetch} keys (Matrix: ${matrixRows}x${matrixCols}) at offset ${layerOffset}`);
                  for (let k = 0; k < keysToFetch; k += keysPerPacket) {
                    try {
                      const offset = layerOffset + k * 2;
                      const buffer = await (protocol as ViaProtocol | VialProtocol).getKeymapBuffer(offset, keysPerPacket * 2);
                      
                      if (!buffer || buffer.length === 0) {
                        throw new Error(`Empty buffer returned for offset ${offset}`);
                      }

                      for (let i = 0; i < keysPerPacket; i++) {
                        const keyIdx = k + i;
                        if (keyIdx >= keysToFetch) break;
                        
                        const bIdx = i * 2;
                        if (bIdx + 1 >= buffer.length) break;

                        const val = (buffer[bIdx] << 8) | buffer[bIdx + 1];
                        const row = Math.floor(keyIdx / matrixCols);
                        const col = keyIdx % matrixCols;
                        
                        // Safety check for matrix bounds
                        const targetIdx = row * 32 + col;
                        layerActions[targetIdx] = isVial ? vialCodeToAction(val) : viaCodeToAction(val);
                      }
                    } catch (e) {
                      console.error(`Layer ${l} Error: Failed at key offset ${k}. Error:`, e);
                      break;
                    }
                  }
                } else {
                  // Fallback for VIA or ZMK: fetch one by one
                  const coords = new Set<string>();
                  if (isZmk) {
                    positions.forEach(p => {
                      coords.add(`${p.row},${p.col}`);
                    });
                  } else {
                    s.keys.forEach(k => {
                      if (k.row !== undefined && k.col !== undefined) {
                        coords.add(`${k.row},${k.col}`);
                      }
                    });
                  }

                  for (const coord of Array.from(coords)) {
                    try {
                      const [row, col] = coord.split(',').map(Number);
                      const action = await protocol.getKey(l, row, col);
                      layerActions[row * 32 + col] = action;
                    } catch (e) {
                      console.warn(`[syncKeymap] Failed to fetch Layer:${l} Row:${coord.split(',')[0]} Col:${coord.split(',')[1]}:`, e);
                    }
                  }
                }
                newRemoteKeymap[l] = layerActions;
              }
            }

            // If no project is loaded for ZMK, dynamically generate runtime layout keys from positions
            let updatedKeys = [...s.keys];
            if (isZmk && s.keys.length === 0 && ((protocol as ZmkProtocol).physicalKeys.length > 0 || positions.length > 0)) {
              const zmkProto = protocol as ZmkProtocol;
              const hasPhysicalLayout = zmkProto.selectedLayoutName != null && zmkProto.physicalKeys.length > 0;
              const hasKeymap = zmkProto.keymapAvailable === true;

              if (hasPhysicalLayout && !hasKeymap) {
                if (isZmkDebugLoggingEnabled()) {
                  console.log('[syncKeymap:ZMK] Physical layout loaded, but keymap unavailable. Generating layout-only runtime keys.');
                }
              } else {
                if (isZmkDebugLoggingEnabled()) {
                  console.log('[syncKeymap:ZMK] No project open. Generating runtime keys from physical layout and fetched keymap.');
                }
              }
              if (zmkProto.physicalKeys && zmkProto.physicalKeys.length > 0) {
                updatedKeys = zmkProto.physicalKeys.map((pk) => {
                  const keymap: Record<number, UniversalAction> = {};
                  Object.keys(newRemoteKeymap).forEach(lStr => {
                    const l = Number(lStr);
                    const action = newRemoteKeymap[l]?.[pk.zmkPosition];
                    if (action) {
                      keymap[l] = action;
                    }
                  });

                  return {
                    id: crypto.randomUUID(),
                    label: `P${pk.zmkPosition}`,
                    x: pk.x,
                    y: pk.y,
                    w: pk.w,
                    h: pk.h,
                    r: pk.r,
                    rx: pk.rx,
                    ry: pk.ry,
                    zmkPosition: pk.zmkPosition,
                    keymap
                  } as RuntimeKey;
                });
              } else {
                updatedKeys = positions.map((p) => {
                  const col = p.col;
                  const row = p.row;
                  const x = col * 1.25;
                  const y = row * 1.25;
                  
                  const keymap: Record<number, UniversalAction> = {};
                  Object.keys(newRemoteKeymap).forEach(lStr => {
                    const l = Number(lStr);
                    const flatIndex = row * 32 + col;
                    const action = newRemoteKeymap[l]?.[flatIndex];
                    if (action) {
                      keymap[l] = action;
                    }
                  });

                  return {
                    id: crypto.randomUUID(),
                    label: `R${row}C${col}`,
                    x,
                    y,
                    w: 1,
                    h: 1,
                    r: 0,
                    rx: x,
                    ry: y,
                    row,
                    col,
                    keymap
                  } as RuntimeKey;
                });
              }
            } else {
              // Standard merge: merge fetched physical keymap directly into editor keys
              updatedKeys = s.keys.map(k => {
                const flatIndex = k.zmkPosition ?? (
                  k.row !== undefined && k.col !== undefined ? k.row * 32 + k.col : undefined
                );
                if (flatIndex === undefined) return k;
                const keymap = { ...k.keymap };
                Object.keys(newRemoteKeymap).forEach(lStr => {
                  const l = Number(lStr);
                  const action = newRemoteKeymap[l]?.[flatIndex];
                  if (action) {
                    keymap[l] = action;
                  }
                });
                return { ...k, keymap };
              });
            }

            const shouldOpenGeneratedZmkProject = isZmk && s.keys.length === 0 && updatedKeys.length > 0;
            const finalMatrixRows = isZmk && s.keys.length === 0 ? 6 : matrixRows;
            const finalMatrixCols = isZmk && s.keys.length === 0 ? 16 : matrixCols;

            set((state) => {
              const generatedZmkSettings = shouldOpenGeneratedZmkProject
                ? getGeneratedZmkProjectSettings(state, updatedKeys, layerCount, (protocol as ZmkProtocol).keyboardName)
                : null;

              return {
                remoteKeymap: newRemoteKeymap,
                keys: updatedKeys,
                baseKeys: updatedKeys,
                settings: generatedZmkSettings || {
                  ...state.settings,
                  matrix: { rows: finalMatrixRows, cols: finalMatrixCols }
                },
                ...(shouldOpenGeneratedZmkProject ? {
                  currentProjectId: crypto.randomUUID(),
                  isProjectOpen: true,
                  selectedKeyIds: [],
                  focusedKeyId: null,
                  selectionAnchorId: null,
                  currentLayer: 0,
                  transform: getCenteredTransform(updatedKeys, state.settings.activeOptions || {}),
                } : {})
              };
            });
            
            // Auto-sync macros and combos if it is a Vial device
            if (isVial) {
              try {
                await get().syncMacrosAndCombos(protocol as VialProtocol);
              } catch (macroErr) {
                console.error('Failed to sync macros and combos inside syncKeymap:', macroErr);
              }
            }
          } catch (err) {
            console.error('Keymap sync failed:', err);
            throw err;
          } finally {
            set({ isKeymapSyncing: false });
          }
        },

        setRemoteMacros: (macros: MacroAction[][]) => set({ remoteMacros: macros }),
        setRemoteCombos: (combos: ComboEntry[]) => set({ remoteCombos: combos }),
        setRemoteTapDances: (tapDances: TapDanceEntry[]) => set({ remoteTapDances: tapDances }),
        setMacroPanelActiveTab: (tab: KeyboardState['macroPanelActiveTab']) => set({ macroPanelActiveTab: tab }),
        setSelectedMacroId: (id: number) => set({ selectedMacroId: id }),
        openMacroSettings: (id: number) => set((s) => ({
          macroPanelActiveTab: 'macros',
          selectedMacroId: id,
          macroSettingsOpenRequest: s.macroSettingsOpenRequest + 1,
        })),
        setSelectedTapDanceId: (id: number) => set({ selectedTapDanceId: id }),
        openTapDanceSettings: (id: number) => set((s) => ({
          macroPanelActiveTab: 'tapDance',
          selectedTapDanceId: id,
          tapDanceSettingsOpenRequest: s.tapDanceSettingsOpenRequest + 1,
        })),
        updateProjectMacro: (id: number, actions: MacroAction[]) => set((s) => {
          const macros = normalizeMacros(s.settings.macros);
          macros[id] = actions;
          return {
            settings: {
              ...s.settings,
              macros,
            }
          };
        }),
        addProjectCombo: () => set((s) => ({
          settings: {
            ...s.settings,
            combos: [
              ...(s.settings.combos || []),
              {
                inputs: [{ action: 'tap', keycode: 'A' }, { action: 'tap', keycode: 'B' }],
                output: { action: 'tap', keycode: 'ESC' },
              },
            ],
          }
        })),
        updateProjectCombo: (index: number, combo: ComboEntry) => set((s) => {
          const combos = [...(s.settings.combos || [])];
          combos[index] = combo;
          return {
            settings: {
              ...s.settings,
              combos,
            }
          };
        }),
        removeProjectCombo: (index: number) => set((s) => ({
          settings: {
            ...s.settings,
            combos: (s.settings.combos || []).filter((_, idx) => idx !== index),
          }
        })),
        updateTapDance: (id: number, entry: TapDanceEntry) => set((s) => {
          const current = s.settings.tapDances || [];
          const exists = current.some(td => td.id === id);
          const nextTapDances = exists
            ? current.map(td => td.id === id ? entry : td)
            : [...current, entry];
          return {
            settings: {
              ...s.settings,
              tapDances: nextTapDances.sort((a, b) => a.id - b.id)
            }
          };
        }),
        removeTapDance: (id: number) => set((s) => ({
          settings: {
            ...s.settings,
            tapDances: (s.settings.tapDances || []).filter(td => td.id !== id),
          }
        })),

        syncMacrosAndCombos: async (existingProtocol?: VialProtocol) => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'vial') return;
          
          try {
            console.log('Syncing macros and combos from device...');
            let protocol: VialProtocol;
            if (existingProtocol) {
              protocol = existingProtocol;
            } else {
              protocol = new VialProtocol();
              await protocol.initialize(s.activeTransport || hidTransport);
            }
            
            // 1. Fetch Macros
            const macroCount = await protocol.getMacrosCount();
            const memorySize = await protocol.getMacroMemorySize();
            console.log(`Device reported macros count: ${macroCount}, memory size: ${memorySize}`);
            
            const rawBuffer = await protocol.getMacrosBuffer(memorySize, macroCount);
            const vialVer = await protocol.getVialVersion();
            const isAdvanced = (vialVer & 0xFFFF) >= 2;
            const deserialized = deserializeMacros(rawBuffer, macroCount, isAdvanced ? 2 : 1);
            
            // 2. Fetch Vial dynamic entries
            const entriesCount = await protocol.getDynamicEntriesCount();
            console.log(`Device reported tap dances: ${entriesCount.tapDance}, combos: ${entriesCount.combos}`);
            let fetchedCombos: ComboEntry[] = [];
            if (entriesCount.combos > 0) {
              fetchedCombos = await protocol.getCombos(entriesCount.combos);
            }
            let fetchedTapDances: TapDanceEntry[] = [];
            if (entriesCount.tapDance > 0) {
              fetchedTapDances = await protocol.getTapDances(entriesCount.tapDance);
            }
            
            set({ remoteMacros: deserialized, remoteCombos: fetchedCombos, remoteTapDances: fetchedTapDances });
            console.log('Macros and combos sync completed successfully.');
          } catch (err) {
            console.error('Failed to sync macros and combos:', err);
          }
        },

        updateRemoteMacro: async (id: number, actions: MacroAction[]) => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'vial') return;
          
          try {
            const protocol = new VialProtocol();
            await protocol.initialize(s.activeTransport || hidTransport);
            
            const unlockStatus = await protocol.getUnlockStatus();
            if (unlockStatus === 0) {
              console.log("Device is locked, starting unlock flow...");
              const success = await get().performDeviceUnlock(protocol);
              if (!success) {
                throw new Error("Unlock cancelled or failed.");
              }
            }
            
            const memorySize = await protocol.getMacroMemorySize();
            const vialVer = await protocol.getVialVersion();
            const isAdvanced = (vialVer & 0xFFFF) >= 2;
            
            // Clone and update the local macro state
            const updatedMacros = s.remoteMacros.map((m, idx) => idx === id ? actions : m);
            
            // Serialize
            const buffer = serializeMacros(updatedMacros, isAdvanced ? 2 : 1);
            console.log(`Writing macros buffer: ${buffer.length} bytes / max ${memorySize} bytes`);
            
            await protocol.setMacrosBuffer(buffer, memorySize);
            set({ remoteMacros: updatedMacros });
            console.log(`Macro ${id} updated on device.`);
          } catch (err) {
            console.error(`Failed to update macro ${id}:`, err);
            throw err;
          }
        },

        updateRemoteCombo: async (index: number, combo: ComboEntry) => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'vial') return;
          
          try {
            const protocol = new VialProtocol();
            await protocol.initialize(s.activeTransport || hidTransport);
            
            const unlockStatus = await protocol.getUnlockStatus();
            if (unlockStatus === 0) {
              console.log("Device is locked, starting unlock flow...");
              const success = await get().performDeviceUnlock(protocol);
              if (!success) {
                throw new Error("Unlock cancelled or failed.");
              }
            }
            
            await protocol.setCombo(index, combo);
            
            const updatedCombos = [...s.remoteCombos];
            updatedCombos[index] = combo;
            set({ remoteCombos: updatedCombos });
            console.log(`Combo ${index} updated on device.`);
          } catch (err) {
            console.error(`Failed to update combo ${index}:`, err);
            throw err;
          }
        },

        updateRemoteTapDance: async (index: number, entry: TapDanceEntry) => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'vial') return;

          if (s.isDemoMode) {
            const nextEntry = { ...entry, id: index };
            const updatedTapDances = [...s.remoteTapDances];
            updatedTapDances[index] = nextEntry;
            set({ remoteTapDances: updatedTapDances });
            return;
          }

          try {
            const protocol = new VialProtocol();
            await protocol.initialize(s.activeTransport || hidTransport);

            const unlockStatus = await protocol.getUnlockStatus();
            if (unlockStatus === 0) {
              console.log("Device is locked, starting unlock flow...");
              const success = await get().performDeviceUnlock(protocol);
              if (!success) {
                throw new Error("Unlock cancelled or failed.");
              }
            }

            const nextEntry = { ...entry, id: index };
            await protocol.setTapDance(index, nextEntry);

            const updatedTapDances = [...s.remoteTapDances];
            updatedTapDances[index] = nextEntry;
            set({ remoteTapDances: updatedTapDances });
            console.log(`Tap Dance ${index} updated on device.`);
          } catch (err) {
            console.error(`Failed to update Tap Dance ${index}:`, err);
            throw err;
          }
        },
 
        setActiveOption: (g: string, i: number) => set((s) => {
          const newActiveOptions = { ...s.settings.activeOptions, [g]: i };
          
          let newKeys = [...(s.baseKeys && s.baseKeys.length > 0 ? s.baseKeys : s.keys)];
          
          // 1. If it's a Vial keyboard, sync layout options to physical device if connected
          if (s.connectedDevice?.protocolType === 'vial') {
            // Update physical device if connected
            if (s.connectedDevice) {
              const labels = Object.keys(s.settings.layoutOptions || {})
                .sort((a, b) => Number(a) - Number(b))
                .map(key => {
                  const opt = s.settings.layoutOptions[key];
                  if (opt.type === 'toggle') {
                    return opt.name;
                  } else {
                    return [opt.name, ...(opt.choices || [])];
                  }
                });
              const mask = packLayoutOptions(newActiveOptions, labels);
              const protocol = new VialProtocol();
              protocol.initialize(s.activeTransport || hidTransport)
                .then(() => protocol.setLayoutOptions(mask))
                .then(() => {
                  console.log('Successfully synced layout options to device.');
                }).catch(err => {
                  console.error('Failed to sync layout options to device:', err);
                });
            }
          } 
          // 3. Auto-align to (0,0) if not in Design-Layout mode
          const isDesignLayout = s.appMode === 'design' && s.editorMode === 'layout';
          if (!isDesignLayout && newKeys.length > 0) {
            // Find visible keys to determine the bounding box
            const visibleKeys = newKeys.filter(k => {
              if (!k.group) return true;
              return newActiveOptions[k.group] === k.option;
            });

            if (visibleKeys.length > 0) {
              let minX = Math.min(...visibleKeys.map(k => k.x));
              let minY = Math.min(...visibleKeys.map(k => k.y));

              if (minX !== 0 || minY !== 0) {
                newKeys = newKeys.map(k => ({
                  ...k,
                  x: roundCoord(k.x - minX),
                  y: roundCoord(k.y - minY),
                  rx: roundCoord((k.rx ?? k.x) - minX),
                  ry: roundCoord((k.ry ?? k.y) - minY),
                }));
              }
            }
          }
          
          return {
            settings: { ...s.settings, activeOptions: newActiveOptions },
            keys: newKeys
          };
        }),

        addKey: (k: Partial<PhysicalKey>) => get().addKeys([k]),

        addKeys: (ks: Partial<PhysicalKey>[], options?: { skipCollision?: boolean }) => set((s) => {
          const newKeysList = [...s.keys];
          const newSelectedIds: string[] = [];
          let lastId = s.focusedKeyId;

          ks.forEach(k => {
            const id = crypto.randomUUID();
            const fk = lastId ? newKeysList.find(i => i.id === lastId) : null;
            
            let nx = k.x !== undefined ? roundCoord(k.x) : (fk ? roundCoord(fk.x + (fk.w || 1)) : 0);
            let ny = k.y !== undefined ? roundCoord(k.y) : (fk ? roundCoord(fk.y) : 0);
            const w = roundCoord(k.w ?? 1);
            const h = roundCoord(k.h ?? 1);

            const isOcc = (x: number, y: number) => newKeysList.some(i => {
              if (i.group && i.option !== s.settings.activeOptions[i.group]) return false;
              const EPS = 0.001;
              return x < i.x + i.w - EPS && x + w > i.x + EPS && y < i.y + i.h - EPS && y + h > i.y + EPS;
            });

            if (!options?.skipCollision && isOcc(nx, ny)) {
              let f = false;
              const sn = s.editorSettings.gridSnap;
              for (let y = ny; y < 20 && !f; y = roundCoord(y + sn)) {
                for (let x = (y === ny ? nx : 0); x < 20 && !f; x = roundCoord(x + sn)) {
                  if (!isOcc(x, y)) { nx = x; ny = y; f = true; }
                }
              }
            }

            const newKey: PhysicalKey = {
              label: '',
              ...k,
              id,
              x: nx,
              y: ny,
              w,
              h,
              r: roundRot(k.r ?? 0),
              rx: roundCoord(k.rx ?? nx),
              ry: roundCoord(k.ry ?? ny),
            };
            
            newKeysList.push(newKey as RuntimeKey);
            newSelectedIds.push(id);
            lastId = id;
          });

          return { 
            keys: newKeysList, 
            baseKeys: newKeysList,
            selectedKeyIds: newSelectedIds, 
            focusedKeyId: lastId,
            selectionAnchorId: lastId
          };
        }),

        updateKey: (id: string, uk: Partial<PhysicalKey>, r: boolean = false) => set((s) => {
          const u = { ...uk };
          if (u.x !== undefined) u.x = r ? roundCoord(Number(u.x)) : Number(u.x);
          if (u.y !== undefined) u.y = r ? roundCoord(Number(u.y)) : Number(u.y);
          if (u.rx !== undefined) u.rx = r ? roundCoord(Number(u.rx)) : Number(u.rx);
          if (u.ry !== undefined) u.ry = r ? roundCoord(Number(u.ry)) : Number(u.ry);
          if (u.w !== undefined) u.w = r ? roundCoord(Number(u.w)) : Number(u.w);
          if (u.h !== undefined) u.h = r ? roundCoord(Number(u.h)) : Number(u.h);
          if (u.r !== undefined) u.r = r ? roundRot(Number(u.r)) : Number(u.r);
          return { keys: s.keys.map(k => k.id === id ? { ...k, ...u } : k) };
        }),

        batchUpdateKeys: (ids: string[], updates: Partial<PhysicalKey> | ((key: PhysicalKey) => Partial<PhysicalKey>), r: boolean = false) => set((s) => ({
          keys: s.keys.map(k => {
            if (!ids.includes(k.id)) return k;
            const u = typeof updates === 'function' ? updates(k) : updates;
            const pu = { ...u };
            if (pu.x !== undefined) pu.x = r ? roundCoord(Number(pu.x)) : Number(pu.x);
            if (pu.y !== undefined) pu.y = r ? roundCoord(Number(pu.y)) : Number(pu.y);
            if (pu.rx !== undefined) pu.rx = r ? roundCoord(Number(pu.rx)) : Number(pu.rx);
            if (pu.ry !== undefined) pu.ry = r ? roundCoord(Number(pu.ry)) : Number(pu.ry);
            if (pu.w !== undefined) pu.w = r ? roundCoord(Number(pu.w)) : Number(pu.w);
            if (pu.h !== undefined) pu.h = r ? roundCoord(Number(pu.h)) : Number(pu.h);
            if (pu.r !== undefined) pu.r = r ? roundRot(Number(pu.r)) : Number(pu.r);
            return { ...k, ...pu };
          })
        })),

        removeKey: (id: string) => set((s) => {
          const removedKey = s.keys.find(k => k.id === id);
          const newKeys = s.keys.filter(k => k.id !== id);
          const removedEncoderId = removedKey?.encoderId;
          const encoders = removedEncoderId && !newKeys.some(k => k.encoderId === removedEncoderId)
            ? (s.settings.encoders || []).filter(encoder => encoder.id !== removedEncoderId)
            : s.settings.encoders || [];
          return { 
            keys: newKeys,
            baseKeys: newKeys,
            settings: {
              ...s.settings,
              encoders,
              features: { ...s.settings.features, encoder: encoders.length > 0 },
            },
            selectedKeyIds: s.selectedKeyIds.filter(i => i !== id),
            focusedKeyId: s.focusedKeyId === id ? null : s.focusedKeyId,
            selectionAnchorId: s.selectionAnchorId === id ? null : s.selectionAnchorId
          };
        }),

        loadKeys: (newKeys: PhysicalKey[]) => set({ 
          keys: newKeys.map(k => ({ ...k, id: k.id || crypto.randomUUID() })) as RuntimeKey[], 
          baseKeys: newKeys.map(k => ({ ...k, id: k.id || crypto.randomUUID() })) as RuntimeKey[],
          selectedKeyIds: [],
          focusedKeyId: null,
          selectionAnchorId: null,
        }),

        setSelectedKeyIds: (ids: string[]) => set({ selectedKeyIds: ids }),
        setFocusedKeyId: (id: string | null) => set({ focusedKeyId: id }),
        setSelectionAnchorId: (id: string | null) => set({ selectionAnchorId: id }),
        
        toggleKeySelection: (id: string, multi: boolean) => set((s) => {
          if (multi) {
            const isSelected = s.selectedKeyIds.includes(id);
            const newIds = isSelected ? s.selectedKeyIds.filter(i => i !== id) : [...s.selectedKeyIds, id];
            return { selectedKeyIds: newIds, focusedKeyId: id, selectionAnchorId: id };
          } else {
            return { selectedKeyIds: [id], focusedKeyId: id, selectionAnchorId: id };
          }
        }),

        setAppMode: (m: 'design' | 'remap') => {
          if (!get().isDemoMode) setStoredAppMode(m);
          if (get().isDemoMode) {
            set({ appMode: m, selectedKeyIds: [] });
            return;
          }
          if (m === 'design') {
            const transport = get().activeTransport || hidTransport;
            transport.disconnect().catch(err => {
              console.error('Failed to disconnect keyboard on design mode switch:', err);
            });
            set((s) => ({
              appMode: m,
              selectedKeyIds: [],
              connectedDevice: null,
              deviceCapabilities: null,
              activeTransport: null,
              zmkLayerMetadata: null,
            }));
          } else {
            set({ appMode: m, selectedKeyIds: [] });
          }
        },
        setEditorMode: (m: EditorMode) => {
          if (!get().isDemoMode) setStoredEditorMode(m);
          set({ editorMode: m, selectedKeyIds: [] });
        },

        setConnectedDevice: (d: KeyboardState['connectedDevice']) => set({
          connectedDevice: d,
          zmkLayerMetadata: null
        }),
        setDeviceCapabilities: (caps: DeviceCapability | null) => set({ deviceCapabilities: caps }),
        setActiveTransport: (t: ITransport | null) => set({ activeTransport: t }),
        setRemoteKeymap: (km: Record<number, UniversalAction[]>) => set({ remoteKeymap: km }),
        renameZmkLayer: async (layerIndex: number, name: string) => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'zmk') return;

          const normalizedName = name.trim();
          if (!normalizedName) {
            throw new Error('Layer name cannot be empty.');
          }

          const maxLength = s.zmkLayerMetadata?.maxLayerNameLength || 0;
          const encodedLength = new TextEncoder().encode(normalizedName).length;
          if (maxLength > 0 && encodedLength > maxLength) {
            throw new Error(`Layer name is too long. Max ${maxLength} bytes.`);
          }

          const protocol = zmkProtocol;
          await protocol.initialize(s.activeTransport || hidTransport);
          await protocol.renameLayer(layerIndex, normalizedName);
          const metadata = protocol.getLayerMetadata();

          set((state) => ({
            zmkLayerMetadata: metadata,
            settings: {
              ...state.settings,
              layers: protocol.layerCount
            }
          }));
        },
        addZmkLayer: async () => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'zmk') return;
          if (!s.zmkLayerMetadata || s.zmkLayerMetadata.availableLayers <= 0) {
            throw new Error('No available ZMK layers remain.');
          }

          const protocol = zmkProtocol;
          await protocol.initialize(s.activeTransport || hidTransport);
          const addedIndex = await protocol.addLayer();
          const metadata = protocol.getLayerMetadata();
          const remoteKeymap = protocol.getCachedKeymapActions();

          set((state) => ({
            zmkLayerMetadata: metadata,
            remoteKeymap,
            currentLayer: addedIndex,
            settings: {
              ...state.settings,
              layers: protocol.layerCount
            }
          }));
        },
        removeLastZmkLayer: async () => {
          const s = get();
          if (!s.connectedDevice || s.connectedDevice.protocolType !== 'zmk') return;
          if ((s.settings.layers || 1) <= 1) {
            throw new Error('Cannot remove the last remaining layer.');
          }

          const protocol = zmkProtocol;
          await protocol.initialize(s.activeTransport || hidTransport);
          const deletedLayer = await protocol.removeLastLayer();
          const metadata = protocol.getLayerMetadata();
          const nextLayers = protocol.layerCount;
          const nextKeys = get().keys.map(k => ({
            ...k,
            keymap: removeLayerFromKeymap(k.keymap, deletedLayer)
          }));

          set((state) => ({
            zmkLayerMetadata: metadata,
            settings: { ...state.settings, layers: nextLayers },
            currentLayer: Math.min(state.currentLayer, nextLayers - 1),
            keys: nextKeys,
            baseKeys: nextKeys,
            remoteKeymap: removeLayerFromRemoteKeymap(state.remoteKeymap, deletedLayer)
          }));
        },
        updateRemoteKeycode: (l: number, i: number, action: UniversalAction) => set((s) => {
          const newKm = { ...s.remoteKeymap };
          if (!newKm[l]) newKm[l] = [];
          const newLayer = [...newKm[l]];
          newLayer[i] = action;
          newKm[l] = newLayer;
          return { remoteKeymap: newKm };
        }),
        updateDeviceKeycode: async (layer: number, row: number, col: number, action: UniversalAction) => {
          const { connectedDevice, updateRemoteKeycode, isDemoMode } = get();
          if (!connectedDevice) return;
          if (isDemoMode) {
            const remoteIndex = col < 0 ? row : row * 32 + col;
            updateRemoteKeycode(layer, remoteIndex, action);
            set((state) => {
              const updatedKeys = state.keys.map(k => {
                if ((col < 0 && k.zmkPosition === row) || (k.row === row && k.col === col)) {
                  return { ...k, keymap: { ...k.keymap, [layer]: action } };
                }
                return k;
              });
              return { keys: updatedKeys, baseKeys: updatedKeys };
            });
            return;
          }
          try {
            const isZmk = connectedDevice?.protocolType === 'zmk';
            const isVial = connectedDevice?.protocolType === 'vial';
            const protocol = isZmk
              ? zmkProtocol
              : (isVial ? new VialProtocol() : new ViaProtocol());

            await protocol.initialize(get().activeTransport || hidTransport);
            
            console.log(`[ZMK/VIA/Vial Write via AST] Layer:${layer} Row:${row} Col:${col}`, action);
            await protocol.setKey(layer, row, col, action);

            if (isZmk) {
              const remoteIndex = col < 0 ? row : row * 32 + col;
              updateRemoteKeycode(layer, remoteIndex, action);
              set((state) => {
                const updatedKeys = state.keys.map(k => {
                  if ((col < 0 && k.zmkPosition === row) || (k.row === row && k.col === col)) {
                    return { ...k, keymap: { ...k.keymap, [layer]: action } };
                  }
                  return k;
                });
                return { keys: updatedKeys, baseKeys: updatedKeys };
              });
            } else {
              updateRemoteKeycode(layer, row * 32 + col, action);

              // ALSO update corresponding key in editor keys state
              set((s) => {
                const updatedKeys = s.keys.map(k => {
                  if (k.row === row && k.col === col) {
                    return { ...k, keymap: { ...k.keymap, [layer]: action } };
                  }
                  return k;
                });
                return { keys: updatedKeys, baseKeys: updatedKeys };
              });
            }
          } catch (err) {
            console.error('Failed to update device keycode:', err);
          }
        },

        copyKeys: () => set((s) => {
          const selectedKeys = s.keys.filter(k => s.selectedKeyIds.includes(k.id));
          const sortedSelectedKeys = sortKeys(selectedKeys, s.editorSettings.sortThresholdY) as RuntimeKey[];

          if (s.editorMode === 'matrix') {
            return {
                matrixClipboard: sortedSelectedKeys.map(k => ({ row: k.row, col: k.col, matrixSide: k.matrixSide }))
            };
          } else if (s.editorMode === 'keymap') {
            return {
              actionClipboard: sortedSelectedKeys.map(k => {
                if (s.appMode === 'remap') {
                  const flatIndex = getRemoteKeymapIndex(k);
                  if (flatIndex !== undefined) {
                    return s.remoteKeymap[s.currentLayer]?.[flatIndex] || { action: 'trans' as const };
                  }
                  return { action: 'trans' as const };
                } else {
                  return k.keymap?.[s.currentLayer] || { action: 'trans' as const };
                }
              })
            };
          } else {
            // Layout mode copy (only if not in remap mode)
            if (s.appMode === 'remap') return {};
            return {
              clipboard: sortedSelectedKeys.map(k => ({ ...k }))
            };
          }
        }),

        pasteKeys: () => {
          const { appMode, editorMode, currentLayer, clipboard, matrixClipboard, actionClipboard, addKeys } = get();

          if (editorMode === 'matrix') {
            if (matrixClipboard.length === 0) return;
            set((s) => {
              const targetKeys = sortKeys(s.keys.filter(k => s.selectedKeyIds.includes(k.id)), s.editorSettings.sortThresholdY) as RuntimeKey[];
              if (targetKeys.length === 0) return {};

              const updatedKeys = s.keys.map(k => {
                const targetIdx = targetKeys.findIndex(tk => tk.id === k.id);
                if (targetIdx !== -1) {
                  const clipItem = matrixClipboard.length === 1 ? matrixClipboard[0] : matrixClipboard[targetIdx];
                  if (clipItem) {
                    return { ...k, row: clipItem.row, col: clipItem.col, matrixSide: clipItem.matrixSide };
                  }
                }
                return k;
              });

              return { keys: updatedKeys, baseKeys: updatedKeys };
            });
          } else if (editorMode === 'keymap') {
            if (actionClipboard.length === 0) return;
            const s = get();
            const targetKeys = sortKeys(s.keys.filter(k => s.selectedKeyIds.includes(k.id)), s.editorSettings.sortThresholdY) as RuntimeKey[];
            if (targetKeys.length === 0) return;

            // 1. Instantly update the local UI state
            set((state) => {
              const updatedKeys = state.keys.map(k => {
                const targetIdx = targetKeys.findIndex(tk => tk.id === k.id);
                if (targetIdx !== -1) {
                  const action = actionClipboard.length === 1 ? actionClipboard[0] : actionClipboard[targetIdx];
                  if (action) {
                    return { ...k, keymap: { ...k.keymap, [currentLayer]: action } };
                  }
                }
                return k;
              });

              let newRemoteKeymap = { ...state.remoteKeymap };
              if (appMode === 'remap') {
                if (!newRemoteKeymap[currentLayer]) newRemoteKeymap[currentLayer] = [];
                const newLayer = [...newRemoteKeymap[currentLayer]];
                targetKeys.forEach((tk, idx) => {
                  const remoteIndex = getRemoteKeymapIndex(tk);
                  if (remoteIndex !== undefined) {
                    const action = actionClipboard.length === 1 ? actionClipboard[0] : actionClipboard[idx];
                    if (action) {
                      newLayer[remoteIndex] = action;
                    }
                  }
                });
                newRemoteKeymap[currentLayer] = newLayer;
              }

              return { keys: updatedKeys, baseKeys: updatedKeys, remoteKeymap: newRemoteKeymap };
            });

            // 2. If connected to a device in remap mode, sync to device
            if (appMode === 'remap' && s.connectedDevice && !s.isDemoMode) {
              const runDeviceUpdates = async () => {
                try {
                  const isZmk = s.connectedDevice?.protocolType === 'zmk';
                  const isVial = s.connectedDevice?.protocolType === 'vial';
                  const protocol = isZmk
                    ? zmkProtocol
                    : (isVial ? new VialProtocol() : new ViaProtocol());
                  await protocol.initialize(s.activeTransport || hidTransport);

                  // Set each key sequentially
                  for (let i = 0; i < targetKeys.length; i++) {
                    const tk = targetKeys[i];
                    const targetRow = isZmk && tk.zmkPosition !== undefined ? tk.zmkPosition : tk.row;
                    const targetCol = isZmk && tk.zmkPosition !== undefined ? -1 : tk.col;
                    if (targetRow !== undefined && targetCol !== undefined) {
                      const action = actionClipboard.length === 1 ? actionClipboard[0] : actionClipboard[i];
                      if (action) {
                        console.log(`[ZMK/VIA/Vial Paste Write] Layer:${currentLayer} Row:${targetRow} Col:${targetCol}`, action);
                        await protocol.setKey(currentLayer, targetRow, targetCol, action);
                      }
                    }
                  }

                  if (isZmk) {
                    const zmkProto = protocol as ZmkProtocol;
                    console.log('[ZMK Sync] Syncing local UI store state after paste...');
                    const newRemoteKeymap = { ...get().remoteKeymap };
                    const updatedKeys = await Promise.all(get().keys.map(async (k) => {
                      const remoteIndex = getRemoteKeymapIndex(k);
                      const targetRow = k.zmkPosition !== undefined ? k.zmkPosition : k.row;
                      const targetCol = k.zmkPosition !== undefined ? -1 : k.col;
                      if (remoteIndex === undefined || targetRow === undefined || targetCol === undefined) return k;
                      const keymap = { ...k.keymap };
                      for (let l = 0; l < zmkProto.layerCount; l++) {
                        const actionVal = await zmkProto.getKey(l, targetRow, targetCol);
                        keymap[l] = actionVal;
                        if (!newRemoteKeymap[l]) newRemoteKeymap[l] = [];
                        newRemoteKeymap[l][remoteIndex] = actionVal;
                      }
                      return { ...k, keymap };
                    }));
                    set({
                      remoteKeymap: newRemoteKeymap,
                      keys: updatedKeys,
                      baseKeys: updatedKeys
                    });
                    console.log('[ZMK Sync SUCCESS] Local UI store state synchronized after paste.');
                  }
                } catch (err) {
                  console.error('Failed to paste to device:', err);
                }
              };
              runDeviceUpdates();
            }
          } else {
            // Layout mode paste (only if not in remap mode)
            if (appMode === 'remap') return;
            if (clipboard.length > 0) {
              // Apply a slight offset (0.25u) to avoid perfect overlap
              const offset = 0.25;
              const s = get();
              const newEncoders: RuntimeEncoder[] = [];
              const newKeys = clipboard.map(k => {
                const { id, encoderId, encoderIndex, ...keyData } = k;
                let nextEncoderId: string | undefined;
                if (encoderId) {
                  const sourceEncoder = (s.settings.encoders || []).find(encoder => encoder.id === encoderId);
                  if (sourceEncoder) {
                    const { id: _sourceEncoderId, ...encoderData } = sourceEncoder;
                    nextEncoderId = crypto.randomUUID();
                    newEncoders.push({ ...encoderData, id: nextEncoderId });
                  }
                } else if (encoderIndex !== undefined) {
                  const sourceEncoder = (s.settings.encoders || [])[encoderIndex];
                  if (sourceEncoder) {
                    const { id: _sourceEncoderId, ...encoderData } = sourceEncoder;
                    nextEncoderId = crypto.randomUUID();
                    newEncoders.push({ ...encoderData, id: nextEncoderId });
                  }
                }
                return {
                  ...keyData,
                  id: undefined, // remove ID so addKeys generates new ones
                  encoderId: nextEncoderId,
                  encoderIndex: undefined,
                  x: roundCoord((k.x ?? 0) + offset),
                  y: roundCoord((k.y ?? 0) + offset),
                  rx: roundCoord((k.rx ?? 0) + offset),
                  ry: roundCoord((k.ry ?? 0) + offset),
                };
              });
              if (newEncoders.length > 0) {
                set((state) => ({
                  settings: {
                    ...state.settings,
                    features: { ...state.settings.features, encoder: true },
                    encoders: [...getReferencedEncoders(state.settings.encoders as RuntimeEncoder[], state.keys), ...newEncoders],
                  },
                }));
              }
              addKeys(newKeys as Partial<PhysicalKey>[], { skipCollision: true });
            }
          }
        },

        setSelectedKeycode: async (action: UniversalAction) => {
          const s = get();
          const { appMode, currentLayer, selectedKeyIds, keys, connectedDevice } = s;
          if (selectedKeyIds.length === 0) return;

          const targetKeys = keys.filter(k => selectedKeyIds.includes(k.id));

          // 1. Update local state instantly
          set((state) => {
            const updatedKeys = state.keys.map(k => {
              if (selectedKeyIds.includes(k.id)) {
                return { ...k, keymap: { ...k.keymap, [currentLayer]: action } };
              }
              return k;
            });

            let newRemoteKeymap = { ...state.remoteKeymap };
            if (appMode === 'remap') {
              if (!newRemoteKeymap[currentLayer]) newRemoteKeymap[currentLayer] = [];
              const newLayer = [...newRemoteKeymap[currentLayer]];
              targetKeys.forEach(tk => {
                const remoteIndex = getRemoteKeymapIndex(tk);
                if (remoteIndex !== undefined) {
                  newLayer[remoteIndex] = action;
                }
              });
              newRemoteKeymap[currentLayer] = newLayer;
            }

            return { keys: updatedKeys, baseKeys: updatedKeys, remoteKeymap: newRemoteKeymap };
          });

          // 2. If connected to a device in remap mode, sync to device sequentially
          if (appMode === 'remap' && connectedDevice && !s.isDemoMode) {
            try {
              const isZmk = connectedDevice?.protocolType === 'zmk';
              const isVial = connectedDevice?.protocolType === 'vial';
              const protocol = isZmk
                ? zmkProtocol
                : (isVial ? new VialProtocol() : new ViaProtocol());
              await protocol.initialize(s.activeTransport || hidTransport);

              // Set each key sequentially
              for (const tk of targetKeys) {
                const targetRow = isZmk && tk.zmkPosition !== undefined ? tk.zmkPosition : tk.row;
                const targetCol = isZmk && tk.zmkPosition !== undefined ? -1 : tk.col;
                if (targetRow !== undefined && targetCol !== undefined) {
                  console.log(`[ZMK/VIA/Vial Bulk Write] Layer:${currentLayer} Row:${targetRow} Col:${targetCol}`, action);
                  await protocol.setKey(currentLayer, targetRow, targetCol, action);
                }
              }

              if (isZmk) {
                const zmkProto = protocol as ZmkProtocol;
                console.log('[ZMK Sync] Syncing local UI store state after bulk write...');
                const newRemoteKeymap = { ...get().remoteKeymap };
                const updatedKeys = await Promise.all(get().keys.map(async (k) => {
                  const remoteIndex = getRemoteKeymapIndex(k);
                  const targetRow = k.zmkPosition !== undefined ? k.zmkPosition : k.row;
                  const targetCol = k.zmkPosition !== undefined ? -1 : k.col;
                  if (remoteIndex === undefined || targetRow === undefined || targetCol === undefined) return k;
                  const keymap = { ...k.keymap };
                  for (let l = 0; l < zmkProto.layerCount; l++) {
                    const actionVal = await zmkProto.getKey(l, targetRow, targetCol);
                    keymap[l] = actionVal;
                    if (!newRemoteKeymap[l]) newRemoteKeymap[l] = [];
                    newRemoteKeymap[l][remoteIndex] = actionVal;
                  }
                  return { ...k, keymap };
                }));
                set({
                  remoteKeymap: newRemoteKeymap,
                  keys: updatedKeys,
                  baseKeys: updatedKeys
                });
                console.log('[ZMK Sync SUCCESS] Local UI store state synchronized after bulk write.');
              }
            } catch (err) {
              console.error('Failed to update keycodes on device:', err);
            }
          }
        },
        setCurrentLayer: (l: number) => set({ currentLayer: l }),
        setEncoderActionDirection: (direction) => set({ encoderActionDirection: direction }),
        addLayer: () => set((s) => {
          const layers = Math.min(32, (s.settings.layers || 1) + 1);
          return {
            settings: { ...s.settings, layers }
          };
        }),
        removeLastLayer: () => set((s) => {
          const currentLayers = s.settings.layers || 1;
          if (currentLayers <= 1) return s;

          const deletedLayer = currentLayers - 1;
          const nextLayers = deletedLayer;
          const nextRemoteKeymap = removeLayerFromRemoteKeymap(s.remoteKeymap, deletedLayer);
          const nextKeys = s.keys.map(k => ({
            ...k,
            keymap: removeLayerFromKeymap(k.keymap, deletedLayer)
          }));

          return {
            settings: {
              ...s.settings,
              layers: nextLayers,
              tapDances: (s.settings.tapDances || []).map(entry => retargetTapDance(entry, deletedLayer))
            },
            currentLayer: Math.min(s.currentLayer, nextLayers - 1),
            keys: nextKeys,
            baseKeys: nextKeys,
            remoteKeymap: nextRemoteKeymap
          };
        }),

        setKeycode: (id: string, l: number, action: UniversalAction) => set((s) => ({
          keys: s.keys.map(k => k.id === id ? { ...k, keymap: { ...k.keymap, [l]: action } } : k)
        })),

        setMatrixPosition: (id: string, row: number | undefined, col: number | undefined, side?: MatrixSide) => set((s) => ({
          keys: s.keys.map(k => {
            if (k.id !== id) return k;
            const matrixSide = s.settings.features.split
              ? side || k.matrixSide || inferMatrixSideFromGeometry(k, s.keys)
              : undefined;
            return {
              ...k,
              row,
              col,
              matrixSide,
              directPin: row !== undefined || col !== undefined ? undefined : k.directPin,
            };
          })
        })),

        addEncoderToKey: (keyId: string) => set((s) => {
          const key = s.keys.find(k => k.id === keyId);
          if (!key) return s;
          if (key.encoderId && (s.settings.encoders || []).some(encoder => encoder.id === key.encoderId)) {
            return s;
          }

          const encoder: RuntimeEncoder = { id: crypto.randomUUID(), keymap: {} };
          const referencedEncoders = getReferencedEncoders(s.settings.encoders as RuntimeEncoder[], s.keys);
          return {
            keys: s.keys.map(k => k.id === keyId ? {
              ...k,
              kind: 'encoder',
              encoderId: encoder.id,
              encoderIndex: undefined,
              w2: undefined,
              h2: undefined,
              x2: undefined,
              y2: undefined,
              stepped: undefined,
            } : k),
            settings: {
              ...s.settings,
              features: { ...s.settings.features, encoder: true },
              encoders: [...referencedEncoders, encoder],
            },
          };
        }),

        addEncoderKey: () => {
          const encoderId = crypto.randomUUID();
          set((s) => {
            const fk = s.focusedKeyId ? s.keys.find(i => i.id === s.focusedKeyId) : null;
            const id = crypto.randomUUID();
            const nx = fk ? roundCoord(fk.x + (fk.w || 1)) : 0;
            const ny = fk ? roundCoord(fk.y) : 0;
            const newKey: RuntimeKey = {
              id,
              kind: 'encoder',
              encoderId,
              label: '',
              x: nx,
              y: ny,
              w: 1,
              h: 1,
              r: 0,
              rx: nx,
              ry: ny,
            };
            const keys = [...s.keys, newKey];
            const referencedEncoders = getReferencedEncoders(s.settings.encoders as RuntimeEncoder[], s.keys);
            return {
              keys,
              baseKeys: keys,
              selectedKeyIds: [id],
              focusedKeyId: id,
              selectionAnchorId: id,
              settings: {
                ...s.settings,
                features: { ...s.settings.features, encoder: true },
                encoders: [...referencedEncoders, { id: encoderId, keymap: {} }],
              },
            };
          });
        },

        updateEncoder: (encoderId: string, updates: Partial<EncoderDefinition>) => set((s) => ({
          settings: {
            ...s.settings,
            encoders: (s.settings.encoders || []).map(encoder => (
              encoder.id === encoderId ? { ...encoder, ...updates, id: encoder.id } : encoder
            )),
          },
        })),

        setPainter: (p: Partial<KeyboardState['painter']>) => set((s) => ({ painter: { ...s.painter, ...p } })),
        
        paintKey: (id: string) => set((s) => {
          const { currentRow: r, currentCol: c, currentSide, autoIncrement: a } = s.painter;
          const matrixColCount = getMatrixFromPins(s.settings.pins, s.settings.features.split)?.cols || s.settings.matrix.cols || 1;
          const matrixNextCol = c + 1;
          const nextRow = a === 'row' || (a === 'matrix' && matrixNextCol >= matrixColCount) ? r + 1 : r;
          const nextCol = a === 'col' ? c + 1 : a === 'matrix' ? matrixNextCol % matrixColCount : c;
          return {
            keys: s.keys.map(k => k.id === id ? {
              ...k,
              row: r,
              col: c,
              matrixSide: s.settings.features.split ? currentSide : undefined,
            } : k),
            painter: { ...s.painter, currentRow: nextRow, currentCol: nextCol }
          };
        }),

        setMatrixPaintMode: (enabled: boolean) => set({ matrixPaintMode: enabled }),

        setPin: (type: 'row' | 'col' | 'splitRow' | 'splitCol' | 'feature', idx: number | string, pin: string) => set((s) => {
          const p = { ...s.settings.pins };
          if (type === 'row') { p.rows = [...p.rows]; (p.rows as any)[idx as number] = pin; }
          if (type === 'col') { p.cols = [...p.cols]; (p.cols as any)[idx as number] = pin; }
          if (type === 'splitRow') {
            p.splitRows = p.splitRows ? [...p.splitRows] : [];
            (p.splitRows as any)[idx as number] = pin;
          }
          if (type === 'splitCol') {
            p.splitCols = p.splitCols ? [...p.splitCols] : [];
            (p.splitCols as any)[idx as number] = pin;
          }
          if (type === 'feature') (p as any)[idx as string] = pin;
          const pinMatrix = getMatrixFromPins(p, s.settings.features.split);
          return {
            settings: { ...s.settings, pins: p, ...(pinMatrix ? { matrix: { ...pinMatrix, wiring: s.settings.matrix?.wiring || 'matrix' } } : {}) }
          };
        }),

        alignSelectedKeys: (t: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y') => set((s) => {
          const sk = s.keys.filter(k => s.selectedKeyIds.includes(k.id));
          if (sk.length < 2) return s;

          const minX = Math.min(...sk.map(k => k.x));
          const maxX = Math.max(...sk.map(k => k.x + k.w));
          const minY = Math.min(...sk.map(k => k.y));
          const maxY = Math.max(...sk.map(k => k.y + k.h));
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          return {
            keys: s.keys.map(k => {
              if (!s.selectedKeyIds.includes(k.id)) return k;
              let u: Partial<PhysicalKey> = {};
              if (t === 'left') u.x = minX;
              if (t === 'right') u.x = maxX - k.w;
              if (t === 'top') u.y = minY;
              if (t === 'bottom') u.y = maxY - k.h;
              if (t === 'center-x') u.x = midX - k.w / 2;
              if (t === 'center-y') u.y = midY - k.h / 2;

              const dx = u.x !== undefined ? u.x - k.x : 0;
              const dy = u.y !== undefined ? u.y - k.y : 0;
              u.rx = k.rx + dx;
              u.ry = k.ry + dy;
              
              if (u.x !== undefined) u.x = roundCoord(u.x);
              if (u.y !== undefined) u.y = roundCoord(u.y);
              if (u.rx !== undefined) u.rx = roundCoord(u.rx);
              if (u.ry !== undefined) u.ry = roundCoord(u.ry);

              return { ...k, ...u };
            })
          };
        }),

        distributeSelectedKeys: (t: 'horizontal' | 'vertical') => set((s) => {
          const sk = s.keys.filter(k => s.selectedKeyIds.includes(k.id));
          if (sk.length < 3) return s;
          const updates: Record<string, Partial<PhysicalKey>> = {};
          
          if (t === 'horizontal') {
            const sorted = [...sk].sort((a, b) => a.x - b.x);
            const minX = sorted[0].x;
            const maxX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w;
            const totalW = sorted.reduce((sum, k) => sum + k.w, 0);
            const gap = (maxX - minX - totalW) / (sk.length - 1);
            let curX = minX;
            sorted.forEach(k => {
              const fx = roundCoord(curX);
              const dx = fx - k.x;
              updates[k.id] = { x: fx, rx: roundCoord(k.rx + dx) };
              curX += k.w + gap;
            });
          } else {
            const sorted = [...sk].sort((a, b) => a.y - b.y);
            const minY = sorted[0].y;
            const maxY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h;
            const totalH = sorted.reduce((sum, k) => sum + k.h, 0);
            const gap = (maxY - minY - totalH) / (sk.length - 1);
            let curY = minY;
            sorted.forEach(k => {
              const fy = roundCoord(curY);
              const dy = fy - k.y;
              updates[k.id] = { y: fy, ry: roundCoord(k.ry + dy) };
              curY += k.h + gap;
            });
          }
          return { keys: s.keys.map(k => updates[k.id] ? { ...k, ...updates[k.id] } : k) };
        }),

        addLayoutOptionGroup: (name: string) => {
          const id = crypto.randomUUID();
          set((s) => ({
            settings: {
              ...s.settings,
              layoutOptions: { ...s.settings.layoutOptions, [id]: { name, type: 'toggle' } },
              activeOptions: { ...s.settings.activeOptions, [id]: 0 }
            }
          }));
          return id;
        },

        removeLayoutOptionGroup: (id: string) => set((s) => {
          const { [id]: _, ...remOpt } = s.settings.layoutOptions;
          const { [id]: __, ...remAct } = s.settings.activeOptions;
          return {
            settings: { ...s.settings, layoutOptions: remOpt, activeOptions: remAct },
            keys: s.keys.map(k => k.group === id ? { ...k, group: undefined, option: undefined } : k)
          };
        }),

        addLayoutOptionChoice: (id: string, name: string) => set((s) => {
          const g = s.settings.layoutOptions[id];
          if (!g || g.type === 'toggle') return s;
          return {
            settings: {
              ...s.settings,
              layoutOptions: { ...s.settings.layoutOptions, [id]: { ...g, choices: [...(g.choices || []), name] } }
            }
          };
        }),

        removeLayoutOptionChoice: (id: string, idx: number) => set((s: KeyboardState) => {
          const g = s.settings.layoutOptions[id];
          if (!g || g.type === 'toggle' || !g.choices) return s;
          const newChoices = g.choices.filter((_, i) => i !== idx);
          return {
            settings: {
              ...s.settings,
              layoutOptions: { ...s.settings.layoutOptions, [id]: { ...g, choices: newChoices } },
              activeOptions: { ...s.settings.activeOptions, [id]: Math.min(s.settings.activeOptions[id] || 0, Math.max(0, newChoices.length - 1)) }
            },
            keys: s.keys.map(k => {
              if (k.group !== id || k.option === undefined) return k;
              if (k.option === idx) return { ...k, option: 0 };
              if (k.option > idx) return { ...k, option: k.option - 1 };
              return k;
            })
          };
        }),

        renameLayoutOptionChoice: (id: string, idx: number, name: string) => set((s: KeyboardState) => {
          const g = s.settings.layoutOptions[id];
          if (!g || g.type === 'toggle' || !g.choices) return s;
          const newChoices = [...g.choices];
          newChoices[idx] = name;
          return {
            settings: { ...s.settings, layoutOptions: { ...s.settings.layoutOptions, [id]: { ...g, choices: newChoices } } }
          };
        }),

        setLayoutOptionGroupType: (id: string, type: 'toggle' | 'list') => set((s: KeyboardState) => {
          const g = s.settings.layoutOptions[id];
          if (!g) return s;
          const newChoices = type === 'list' ? ['Default'] : undefined;
          return {
            settings: {
              ...s.settings,
              layoutOptions: { ...s.settings.layoutOptions, [id]: { ...g, type, choices: newChoices } },
              activeOptions: { ...s.settings.activeOptions, [id]: 0 }
            }
          };
        }),

        loadProject: (project: SmidrProject, preserveTransform = false) => set((s: KeyboardState) => {
          // Extract keys and id/updatedAt, rest is settings
          const { id, updatedAt, keys: rawKeys, vendorId, productId, vendorProductId, ...settings } = project;
          const normalizedVendorProductId = getProjectVendorProductId(project) ?? s.settings.vendorProductId;
          const runtimeEncoders = normalizeEncoders(settings.encoders, rawKeys);
          const settingsWithDefaultMatrix = {
            ...settings,
            vendorProductId: normalizedVendorProductId,
            visualLayout: normalizeVisualLayout(s.settings.visualLayout),
            qmk: {
              matrixMasked: false,
              ...(settings.qmk || {}),
              bootmagic: { enabled: true, ...(settings.qmk?.bootmagic || {}) },
            },
            vial: settings.vial || {},
            zmk: settings.zmk || {},
            macros: normalizeMacros(settings.macros),
            encoders: runtimeEncoders,
            combos: settings.combos || [],
            tapDances: settings.tapDances || [],
            matrix: {
              wiring: 'matrix',
              ...(settings.matrix || {
              rows: settings.pins?.rows?.length || 0,
              cols: settings.pins?.cols?.length || 0
              }),
            }
          };

          // Assign fresh runtime IDs to all keys (id is not persisted)
          let newKeys = assignRuntimeEncoderIds(rawKeys, runtimeEncoders).map(k => ({
            ...k,
            id: crypto.randomUUID(),
            keymap: k.keymap as Record<number, UniversalAction> | undefined
          })) as RuntimeKey[];

          const isDesignLayout = s.appMode === 'design';
          if (!isDesignLayout && newKeys.length > 0) {
            const visibleKeys = newKeys.filter(k => {
              if (!k.group) return true;
              return (settings.activeOptions[k.group] ?? 0) === k.option;
            });
            if (visibleKeys.length > 0) {
              let minX = Math.min(...visibleKeys.map(k => k.x));
              let minY = Math.min(...visibleKeys.map(k => k.y));
              if (minX !== 0 || minY !== 0) {
                newKeys = newKeys.map(k => ({
                  ...k,
                  x: roundCoord(k.x - minX),
                  y: roundCoord(k.y - minY),
                  rx: roundCoord((k.rx ?? k.x) - minX),
                  ry: roundCoord((k.ry ?? k.y) - minY),
                }));
              }
            }
          }

          const sameProject = s.currentProjectId === id;
          const nextTransform = (preserveTransform || sameProject)
            ? s.transform
            : getCenteredTransform(newKeys, settings.activeOptions || {});

          return {
            settings: settingsWithDefaultMatrix as ProjectSettings,
            keys: newKeys,
            baseKeys: newKeys,
            currentProjectId: id || null,
            isProjectOpen: true,
            selectedKeyIds: [],
            focusedKeyId: null,
            currentLayer: 0,
            transform: nextTransform,
          };
        }),

        importKeyboardDefinition: (input: any) => {
          const isDebug = get().editorSettings.debugMode;
          console.log('[Import] Debug Mode State:', isDebug);
          
          if (isDebug) console.log('[Import] Input received:', input);

          try {
            // Update debug console immediately with raw input
            if (typeof window !== 'undefined' && (window as any).setAppDebug) {
              (window as any).setAppDebug({
                type: 'import',
                raw: input
              });
            }

            const result = parseKeyboardDefinition(input);
            const { keys, name, vendorProductId, layoutOptions, activeOptions, matrix, pins, encoders, hardware, qmk, features } = result;
            const initialActiveOptions = activeOptions
              ?? Object.fromEntries(Object.keys(layoutOptions || {}).map(id => [id, 0]));
            
            // Update again with parsed info if successful
            if (typeof window !== 'undefined' && (window as any).setAppDebug) {
              (window as any).setAppDebug({
                type: 'import',
                raw: input,
                parsed: { keys: keys.length, name, vendorProductId }
              });
            }
            
            if (isDebug) {
              console.log('[Import] Parsed Keys:', keys.length);
              console.log('[Import] Metadata:', { name, vendorProductId });
            }

            // Calculate matrix size from key row/col
            let maxRow = 0;
            let maxCol = 0;
            keys.forEach(k => {
              if (k.row !== undefined && k.row > maxRow) maxRow = k.row;
              if (k.col !== undefined && k.col > maxCol) maxCol = k.col;
            });
            const hasMatrix = keys.some(k => k.row !== undefined);

            set((s: KeyboardState) => {
              const existingPinMatrix = getMatrixFromPins(s.settings.pins, s.settings.features.split);
              const importedPins = pins ? { ...s.settings.pins, ...pins } : s.settings.pins;
              const importedPinMatrix = getMatrixFromPins(importedPins, s.settings.features.split);
              const pinMatrix = importedPinMatrix ?? existingPinMatrix;
              const inferredMatrix = hasMatrix
                ? { rows: maxRow + 1, cols: maxCol + 1 }
                : s.settings.matrix;
              let nextMatrix = pinMatrix ?? matrix ?? inferredMatrix;

              if (
                matrix &&
                pinMatrix &&
                (matrix.rows !== pinMatrix.rows || matrix.cols !== pinMatrix.cols)
              ) {
                alert(`Imported matrix (${matrix.rows}x${matrix.cols}) differs from configured pins (${pinMatrix.rows}x${pinMatrix.cols}). Keeping pin-based matrix.`);
              }

              // Assign fresh runtime IDs first so keys and baseKeys share the exact same key list and references
              let appliedKeys: RuntimeKey[] = keys.map(k => ({ ...k, id: crypto.randomUUID() }));
              
              // 3. Auto-align to (0,0) considering layout options
              if (appliedKeys.length > 0) {
                // Find visible keys under initial activeOptions (initially empty, so choice index is 0)
                const visibleKeys = appliedKeys.filter(k => {
                  if (!k.group) return true;
                  return k.option === 0;
                });

                if (visibleKeys.length > 0) {
                  let minX = Math.min(...visibleKeys.map(k => k.x));
                  let minY = Math.min(...visibleKeys.map(k => k.y));
                  if (minX !== 0 || minY !== 0) {
                    appliedKeys = appliedKeys.map(k => ({
                      ...k,
                      x: roundCoord(k.x - minX),
                      y: roundCoord(k.y - minY),
                      rx: roundCoord((k.rx ?? k.x) - minX),
                      ry: roundCoord((k.ry ?? k.y) - minY),
                    }));
                  }
                }
              }

              const finalEncoders = normalizeEncoders(encoders || s.settings.encoders, appliedKeys);
              const finalKeys = assignRuntimeEncoderIds(appliedKeys, finalEncoders).filter(k => !k.decal);

              return {
                keys: finalKeys,
                baseKeys: finalKeys,
                settings: {
                  ...s.settings,
                  name: name || s.settings.name,
                  vendorProductId: vendorProductId ?? s.settings.vendorProductId,
                  visualLayout: normalizeVisualLayout(s.settings.visualLayout),
                  layoutOptions: layoutOptions || {},
                  activeOptions: initialActiveOptions,
                  pins: importedPins,
                  hardware: hardware ? { ...s.settings.hardware, ...hardware } : s.settings.hardware,
                  qmk: qmk ? { ...(s.settings.qmk || {}), ...qmk } : s.settings.qmk,
                  features: features ? { ...s.settings.features, ...features } : s.settings.features,
                  encoders: finalEncoders,
                  tapDances: s.settings.tapDances || [],
                matrix: { ...nextMatrix, wiring: matrix?.wiring || s.settings.matrix?.wiring || 'matrix' }
                },
                isProjectOpen: true,
                selectedKeyIds: [],
                focusedKeyId: null,
                currentLayer: 0,
                transform: getCenteredTransform(finalKeys, initialActiveOptions),
              };
            });
          } catch (err: any) {
            if (isDebug) console.error('[Import] Error:', err);
            throw err;
          }
        },

        setIsProjectOpen: (o: boolean) => set({ isProjectOpen: o }),
        setIsHardwareModalOpen: (o: boolean) => set({ isHardwareModalOpen: o }),

        resetProject: (keepOpen = false) => set((s: KeyboardState) => ({
          settings: {
            ...initialState.settings,
            vialUid: generateRandomVialUid(),
            macros: createEmptyMacros(),
            combos: [],
            tapDances: [],
            visualLayout: normalizeVisualLayout(s.settings.visualLayout)
          } as ProjectSettings,
          keys: [],
          currentProjectId: null,
          isProjectOpen: keepOpen,
          selectedKeyIds: [],
          focusedKeyId: null,
          currentLayer: 0,
          transform: { scale: 1, x: 0, y: 0 },
        })),

        clearMatrixMap: () => set((s: KeyboardState) => ({
          keys: s.keys.map(k => ({ ...k, row: undefined, col: undefined, matrixSide: undefined, directPin: undefined }))
        })),

        clearRgbMatrix: () => set((s: KeyboardState) => ({
          keys: s.keys.map(k => ({ ...k, ledIndex: undefined, ledX: undefined, ledY: undefined, ledFlags: undefined }))
        })),

        generateMatrix: (rows: number, cols: number) => {
          const newKeys: Partial<PhysicalKey>[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              newKeys.push({ x: c, y: r, w: 1, h: 1, label: '' });
            }
          }
          get().addKeys(newKeys, { skipCollision: true });
        },

        autoAssignMatrix: () => set((s: KeyboardState) => {
          const visKeys = s.keys.filter(k => !k.group || s.settings.activeOptions[k.group] === k.option);
          const idToMatrix: Record<string, { row: number, col: number, matrixSide?: MatrixSide }> = {};
          const assignGroup = (groupKeys: RuntimeKey[], matrixSide?: MatrixSide) => {
            const sorted = sortKeys(groupKeys, s.editorSettings.sortThresholdY);
            let currentRow = 0;
            let currentCol = 0;
            sorted.forEach((k: PhysicalKey, i: number) => {
              if (i > 0) {
                const prev = sorted[i - 1];
                if (Math.abs(k.y - prev.y) > s.editorSettings.sortThresholdY) {
                  currentRow++;
                  currentCol = 0;
                } else {
                  currentCol++;
                }
              }
              idToMatrix[k.id!] = { row: currentRow, col: currentCol, matrixSide };
            });
          };
          if (s.settings.features.split) {
            assignGroup(visKeys.filter(k => inferMatrixSideFromGeometry(k, visKeys) === 'left'), 'left');
            assignGroup(visKeys.filter(k => inferMatrixSideFromGeometry(k, visKeys) === 'right'), 'right');
          } else {
            assignGroup(visKeys);
          }
          return {
            keys: s.keys.map(k => idToMatrix[k.id!] ? { ...k, ...idToMatrix[k.id!] } : k),
            painter: { ...s.painter, currentRow: 0, currentCol: 0 }
          };
        }),

        autoAssignRgbMatrix: () => set((s: KeyboardState) => {
          const visKeys = s.keys.filter(k => !k.group || s.settings.activeOptions[k.group] === k.option);
          const sortedKeys = sortKeys(visKeys, s.editorSettings.sortThresholdY);
          if (sortedKeys.length === 0) return s;
          const bounds = getRgbMatrixBounds(sortedKeys);
          const updates = new Map(sortedKeys.map((key, index) => {
            return [key.id, {
              ledIndex: index,
              ...getRgbMatrixLedPosition(key, bounds),
              ledFlags: key.ledFlags ?? 4,
            }];
          }));
          return {
            settings: {
              ...s.settings,
              features: { ...s.settings.features, rgbMatrix: true },
            },
            keys: s.keys.map(k => updates.has(k.id) ? { ...k, ...updates.get(k.id)! } : k),
          };
        }),

        setLanguage: (lang: Language) => {
          setStoredLanguage(lang);
          set({ language: lang });
        },

        setCanvasDimensions: (d: { width: number, height: number }) => {
          set({ canvasDimensions: d });
        },
      }),
      {
        partialize: (state: KeyboardState) => {
          return {
            settings: state.settings,
            keys: state.keys,
            historyId: state.historyId,
          };
        },
        equality: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
        limit: 50,
      }

    )
  )
);

// Register UI Keys Provider for ZMK Protocol to avoid circular dependencies
zmkProtocol.registerUiKeysProvider(() => useKeyboardStore.getState().keys);
