import { create, StateCreator } from 'zustand';
import { temporal } from 'zundo';
import { PhysicalKey, ProjectSettings, EditorSettings, SmidrProject } from '@/types/keyboard';
import { UniversalAction, MacroAction, ComboEntry } from '@/types/actions';
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
import { ZmkProtocol } from './protocols/zmk';
import { qmkStringToAction, actionToQmkString } from './protocols/via-action-converter';
import { getStoredTheme, setStoredTheme, getStoredLanguage, setStoredLanguage } from './storage';
import { getKeyVertices, PADDING_X } from './canvas-utils';

export type RuntimeKey = PhysicalKey & { id: string };

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
  editorMode: 'layout' | 'matrix' | 'hardware' | 'keymap';
  setEditorMode: (mode: 'layout' | 'matrix' | 'hardware' | 'keymap') => void;
  currentLayer: number;
  setCurrentLayer: (layer: number) => void;
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
  zmkLocked: boolean;
  setZmkLocked: (locked: boolean) => void;
  syncOfflineState: () => Promise<void>;
  updateRemoteKeycode: (layer: number, index: number, action: UniversalAction) => void;
  updateDeviceKeycode: (layer: number, row: number, col: number, action: UniversalAction) => Promise<void>;
  
  // Macros & Combos
  remoteMacros: MacroAction[][];
  remoteCombos: ComboEntry[];
  setRemoteMacros: (macros: MacroAction[][]) => void;
  setRemoteCombos: (combos: ComboEntry[]) => void;
  updateRemoteMacro: (id: number, actions: MacroAction[]) => Promise<void>;
  updateRemoteCombo: (index: number, combo: ComboEntry) => Promise<void>;
  syncMacrosAndCombos: (existingProtocol?: VialProtocol) => Promise<void>;

  // Matrix Painting
  setMatrixPosition: (id: string, row: number | undefined, col: number | undefined) => void;
  painter: { currentRow: number; currentCol: number; autoIncrement: 'col' | 'row' | 'none'; };
  setPainter: (painter: Partial<KeyboardState['painter']>) => void;
  paintKey: (id: string) => void;
  matrixSubMode: 'paint' | 'manual';
  setMatrixSubMode: (mode: 'paint' | 'manual') => void;
  
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
  };
  setUnlockState: (state: Partial<KeyboardState['unlockState']>) => void;
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
  matrixClipboard: { row?: number; col?: number }[];
  actionClipboard: UniversalAction[];
  copyKeys: () => void;
  pasteKeys: () => void;
  deleteSelectedKeycodes: () => Promise<void>;
  setSelectedKeycode: (action: UniversalAction) => Promise<void>;

  // Parameter Capture
  isCapturingParam: boolean;
  setIsCapturingParam: (capturing: boolean) => void;
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
    matrix: { rows: 0, cols: 0 },
    pins: { rows: [], cols: [], splitRows: [], splitCols: [] },
    hardware: { mcu: 'rp2040', board: 'promicro', diodeDirection: 'COL2ROW' },
    features: { rgb: false, encoder: false, oled: false, via: true, split: false },
    layers: 4,
    layoutOptions: {},
    activeOptions: {},
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
  appMode: 'remap',
  editorMode: 'layout',
  currentLayer: 0,
  connectedDevice: null,
  deviceCapabilities: null,
  activeTransport: null,
  remoteKeymap: {},
  remoteMacros: Array(16).fill(null).map(() => []),
  remoteCombos: [],
  painter: { currentRow: 0, currentCol: 0, autoIncrement: 'col' },
  matrixSubMode: 'paint',
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
  isCapturingParam: false,
  zmkLocked: false,
  unlockState: {
    showModal: false,
    progress: 0,
    status: 'idle',
    statusText: '',
    unlockKeys: [],
  },
};

const roundCoord = (v: number) => Math.round(v * 10000000) / 10000000;
const roundRot = (v: number) => Math.round(v * 100) / 100;

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

        setIsCapturingParam: (capturing: boolean) => set({ isCapturingParam: capturing }),
        setZmkLocked: (locked: boolean) => set({ zmkLocked: locked }),

        updateSettings: (sets: Partial<ProjectSettings>) => set((s) => ({ 
          settings: { ...s.settings, ...sets } 
        })),

        updateEditorSettings: (es: Partial<EditorSettings>) => {
          if (es.theme) setStoredTheme(es.theme);
          set((s) => ({
            editorSettings: { ...s.editorSettings, ...es }
          }));
        },

        setTransform: (t: { scale: number, x: number, y: number }) => set({ transform: t }),

        setUnlockState: (state: Partial<KeyboardState['unlockState']>) => set((s: any) => ({
          unlockState: { ...s.unlockState, ...state }
        })),

        performDeviceUnlock: async (protocol: VialProtocol): Promise<boolean> => {
          const { setUnlockState } = get();

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
            unlockKeys
          });

          try {
            await protocol.unlockStart();
            const startTime = Date.now();
            const timeoutMs = 30000;
            let maxCounter = 1;
            
            while (Date.now() - startTime < timeoutMs) {
              const poll = await protocol.unlockPoll();
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
          
          set({ zmkLocked: false });

          try {
            const isZmk = s.connectedDevice?.protocolType === 'zmk';
            const isVial = s.connectedDevice?.protocolType === 'vial';
            const protocol = isZmk
              ? new ZmkProtocol()
              : (isVial ? new VialProtocol() : new ViaProtocol());

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
              const hasPhysicalLayout = zmkProto.selectedLayoutName != null && zmkProto.physicalPositions.length > 0;
              const hasKeymap = zmkProto.keymapAvailable === true;

              if (!hasPhysicalLayout) {
                console.warn('[syncKeymap:ZMK] Layout metadata is unavailable. Skipping keymap sync completely.');
                return;
              }

              positions = await zmkProto.getKeyPositions();
              layerCount = zmkProto.layerCount;
              const selectedLayoutName = zmkProto.selectedLayoutName;

              console.log('[ZMK sync]', {
                layerCount,
                physicalLayout: selectedLayoutName,
                positionCount: positions.length,
              });

              set((state) => ({
                settings: {
                  ...state.settings,
                  layers: layerCount,
                  name: state.keys.length === 0 ? (zmkProto.keyboardName || state.settings.name) : state.settings.name
                }
              }));

              if (!hasKeymap) {
                console.warn('[syncKeymap:ZMK] Physical layout loaded, but keymap unavailable. Generating layout-only runtime keys.');
                let updatedKeys = [...s.keys];
                if (s.keys.length === 0) {
                  if (zmkProto.physicalKeys && zmkProto.physicalKeys.length > 0) {
                    updatedKeys = zmkProto.physicalKeys.map((pk) => {
                      return {
                        id: crypto.randomUUID(),
                        label: `R${pk.row}C${pk.col}`,
                        x: pk.x,
                        y: pk.y,
                        w: pk.w,
                        h: pk.h,
                        row: pk.row,
                        col: pk.col,
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
                        row,
                        col,
                        keymap: {}
                      } as RuntimeKey;
                    });
                  }
                }
                set({
                  keys: updatedKeys,
                  baseKeys: updatedKeys
                });
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
            
            const newRemoteKeymap: Record<number, UniversalAction[]> = {};
              for (let l = 0; l < Math.min(layerCount, 16); l++) {
                const layerActions: UniversalAction[] = [];
                const keysToFetch = matrixRows * matrixCols; 
                const keysPerPacket = 14;

                if (isVial) {
                  // High-speed batch fetch for Vial
                  const layerOffset = l * matrixRows * matrixCols * 2;
                  console.log(`Layer ${l}: Syncing ${keysToFetch} keys (Matrix: ${matrixRows}x${matrixCols}) at offset ${layerOffset}`);
                  for (let k = 0; k < keysToFetch; k += keysPerPacket) {
                    try {
                      const offset = layerOffset + k * 2;
                      const buffer = await (protocol as VialProtocol).getKeymapBuffer(offset, keysPerPacket * 2);
                      
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
                        layerActions[targetIdx] = vialCodeToAction(val);
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

            // If no project is loaded for ZMK, dynamically generate runtime layout keys from positions
            let updatedKeys = [...s.keys];
            if (isZmk && s.keys.length === 0 && positions.length > 0) {
              const zmkProto = protocol as ZmkProtocol;
              const hasPhysicalLayout = zmkProto.selectedLayoutName != null && zmkProto.physicalPositions.length > 0;
              const hasKeymap = zmkProto.keymapAvailable === true;

              if (hasPhysicalLayout && !hasKeymap) {
                console.log('[syncKeymap:ZMK] Physical layout loaded, but keymap unavailable. Generating layout-only runtime keys.');
              } else {
                console.log('[syncKeymap:ZMK] No project open. Generating temporary runtime keys from physical positions.');
              }
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
                  row,
                  col,
                  keymap
                } as RuntimeKey;
              });
            } else {
              // Standard merge: merge fetched physical keymap directly into editor keys
              updatedKeys = s.keys.map(k => {
                if (k.row === undefined || k.col === undefined) return k;
                const flatIndex = k.row * 32 + k.col;
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

            const finalMatrixRows = isZmk && s.keys.length === 0 ? 6 : matrixRows;
            const finalMatrixCols = isZmk && s.keys.length === 0 ? 16 : matrixCols;

            set((state) => ({
              remoteKeymap: newRemoteKeymap,
              keys: updatedKeys,
              baseKeys: updatedKeys,
              settings: {
                ...state.settings,
                matrix: { rows: finalMatrixRows, cols: finalMatrixCols }
              }
            }));
            
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
          }
        },

        setRemoteMacros: (macros: MacroAction[][]) => set({ remoteMacros: macros }),
        setRemoteCombos: (combos: ComboEntry[]) => set({ remoteCombos: combos }),

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
            
            // 2. Fetch Combos
            const entriesCount = await protocol.getDynamicEntriesCount();
            console.log(`Device reported combos count: ${entriesCount.combos}`);
            let fetchedCombos: ComboEntry[] = [];
            if (entriesCount.combos > 0) {
              fetchedCombos = await protocol.getCombos(entriesCount.combos);
            }
            
            set({ remoteMacros: deserialized, remoteCombos: fetchedCombos });
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
 
        syncOfflineState: async () => {
          const s = get();
          if (!s.connectedDevice) return;
          
          console.log('[Offline Sync] Checking for keymap sync disparities (UI-priority)...');
          try {
            const isZmk = s.connectedDevice?.protocolType === 'zmk';
            const isVial = s.connectedDevice?.protocolType === 'vial';
            const protocol = isZmk
              ? new ZmkProtocol()
              : (isVial ? new VialProtocol() : new ViaProtocol());

            await protocol.initialize(s.activeTransport || hidTransport);
            
            // Sync all matrix positions configured in the project keys
            for (const key of s.keys) {
              if (key.row === undefined || key.col === undefined) continue;
              
              for (let l = 0; l < (s.settings.layers || 4); l++) {
                const localAction = key.keymap?.[l];
                if (!localAction) continue;
                
                // Fetch the actual action from the physical device
                const action = await protocol.getKey(l, key.row!, key.col!);
                const remoteCode = actionToQmkString(action);
                const localCode = actionToQmkString(localAction);
                
                if (localCode !== remoteCode) {
                  console.log(`[Offline Sync] Syncing Row:${key.row} Col:${key.col} Layer:${l} -> Device (Setting ${localCode} over ${remoteCode})`);
                  await protocol.setKey(l, key.row!, key.col!, localAction);
                  s.updateRemoteKeycode(l, key.row! * 32 + key.col!, localAction);
                }
              }
            }
            console.log('[Offline Sync] Sync complete. Device and editor keymaps are aligned.');
          } catch (err) {
            console.error('[Offline Sync] Auto-sync encountered an error:', err);
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
          const newKeys = s.keys.filter(k => k.id !== id);
          return { 
            keys: newKeys,
            baseKeys: newKeys,
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
            }));
          } else {
            set({ appMode: m, selectedKeyIds: [] });
          }
        },
        setEditorMode: (m: 'layout' | 'matrix' | 'hardware' | 'keymap') => set({ editorMode: m, selectedKeyIds: [] }),

        setConnectedDevice: (d: KeyboardState['connectedDevice']) => set({ connectedDevice: d }),
        setDeviceCapabilities: (caps: DeviceCapability | null) => set({ deviceCapabilities: caps }),
        setActiveTransport: (t: ITransport | null) => set({ activeTransport: t }),
        setRemoteKeymap: (km: Record<number, UniversalAction[]>) => set({ remoteKeymap: km }),
        updateRemoteKeycode: (l: number, i: number, action: UniversalAction) => set((s) => {
          const newKm = { ...s.remoteKeymap };
          if (!newKm[l]) newKm[l] = [];
          const newLayer = [...newKm[l]];
          newLayer[i] = action;
          newKm[l] = newLayer;
          return { remoteKeymap: newKm };
        }),
        updateDeviceKeycode: async (layer: number, row: number, col: number, action: UniversalAction) => {
          const { connectedDevice, updateRemoteKeycode, settings } = get();
          if (!connectedDevice) return;
          try {
            const isZmk = connectedDevice?.protocolType === 'zmk';
            const isVial = connectedDevice?.protocolType === 'vial';
            const protocol = isZmk
              ? new ZmkProtocol()
              : (isVial ? new VialProtocol() : new ViaProtocol());

            await protocol.initialize(get().activeTransport || hidTransport);
            
            if (isVial) {
              const unlockStatus = await (protocol as VialProtocol).getUnlockStatus();
              if (unlockStatus === 0) {
                console.log("Device is locked, starting unlock flow...");
                const success = await get().performDeviceUnlock(protocol as VialProtocol);
                if (!success) {
                  throw new Error("Unlock cancelled or failed.");
                }
              }
            }
            
            console.log(`[VIA/Vial Write via AST] Layer:${layer} Row:${row} Col:${col}`, action);
            await protocol.setKey(layer, row, col, action);
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
          } catch (err) {
            console.error('Failed to update device keycode:', err);
          }
        },

        copyKeys: () => set((s) => {
          const selectedKeys = s.keys.filter(k => s.selectedKeyIds.includes(k.id));
          const sortedSelectedKeys = sortKeys(selectedKeys, s.editorSettings.sortThresholdY) as RuntimeKey[];

          if (s.editorMode === 'matrix') {
            return {
              matrixClipboard: sortedSelectedKeys.map(k => ({ row: k.row, col: k.col }))
            };
          } else if (s.editorMode === 'keymap') {
            return {
              actionClipboard: sortedSelectedKeys.map(k => {
                if (s.appMode === 'remap') {
                  if (k.row !== undefined && k.col !== undefined) {
                    const flatIndex = k.row * 32 + k.col;
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
                    return { ...k, row: clipItem.row, col: clipItem.col };
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
                  if (tk.row !== undefined && tk.col !== undefined) {
                    const action = actionClipboard.length === 1 ? actionClipboard[0] : actionClipboard[idx];
                    if (action) {
                      newLayer[tk.row * 32 + tk.col] = action;
                    }
                  }
                });
                newRemoteKeymap[currentLayer] = newLayer;
              }

              return { keys: updatedKeys, baseKeys: updatedKeys, remoteKeymap: newRemoteKeymap };
            });

            // 2. If connected to a device in remap mode, sync to device
            if (appMode === 'remap' && s.connectedDevice) {
              const runDeviceUpdates = async () => {
                try {
                  const isZmk = s.connectedDevice?.protocolType === 'zmk';
                  const isVial = s.connectedDevice?.protocolType === 'vial';
                  const protocol = isZmk
                    ? new ZmkProtocol()
                    : (isVial ? new VialProtocol() : new ViaProtocol());
                  await protocol.initialize(s.activeTransport || hidTransport);

                  if (isVial) {
                    const unlockStatus = await (protocol as VialProtocol).getUnlockStatus();
                    if (unlockStatus === 0) {
                      const success = await s.performDeviceUnlock(protocol as VialProtocol);
                      if (!success) throw new Error("Unlock failed.");
                    }
                  }

                  // Set each key sequentially
                  for (let i = 0; i < targetKeys.length; i++) {
                    const tk = targetKeys[i];
                    if (tk.row !== undefined && tk.col !== undefined) {
                      const action = actionClipboard.length === 1 ? actionClipboard[0] : actionClipboard[i];
                      if (action) {
                        console.log(`[VIA/Vial Paste Write] Layer:${currentLayer} Row:${tk.row} Col:${tk.col}`, action);
                        await protocol.setKey(currentLayer, tk.row, tk.col, action);
                      }
                    }
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
              const newKeys = clipboard.map(k => ({
                ...k,
                id: undefined, // remove ID so addKeys generates new ones
                x: roundCoord((k.x ?? 0) + offset),
                y: roundCoord((k.y ?? 0) + offset),
                rx: roundCoord((k.rx ?? 0) + offset),
                ry: roundCoord((k.ry ?? 0) + offset),
              }));
              addKeys(newKeys as Partial<PhysicalKey>[], { skipCollision: true });
            }
          }
        },

        deleteSelectedKeycodes: async () => {
          const s = get();
          const { appMode, currentLayer, selectedKeyIds, keys, settings, connectedDevice } = s;
          if (selectedKeyIds.length === 0) return;

          const targetKeys = keys.filter(k => selectedKeyIds.includes(k.id));
          const newAction: UniversalAction = { action: 'trans' };

          // 1. Update local state instantly
          set((state) => {
            const updatedKeys = state.keys.map(k => {
              if (selectedKeyIds.includes(k.id)) {
                return { ...k, keymap: { ...k.keymap, [currentLayer]: newAction } };
              }
              return k;
            });

            let newRemoteKeymap = { ...state.remoteKeymap };
            if (appMode === 'remap') {
              if (!newRemoteKeymap[currentLayer]) newRemoteKeymap[currentLayer] = [];
              const newLayer = [...newRemoteKeymap[currentLayer]];
              targetKeys.forEach(tk => {
                if (tk.row !== undefined && tk.col !== undefined) {
                  newLayer[tk.row * 32 + tk.col] = newAction;
                }
              });
              newRemoteKeymap[currentLayer] = newLayer;
            }

            return { keys: updatedKeys, baseKeys: updatedKeys, remoteKeymap: newRemoteKeymap };
          });

          // 2. If connected to a device in remap mode, sync to device sequentially
          if (appMode === 'remap' && connectedDevice) {
            try {
              const isZmk = connectedDevice?.protocolType === 'zmk';
              const isVial = connectedDevice?.protocolType === 'vial';
              const protocol = isZmk
                ? new ZmkProtocol()
                : (isVial ? new VialProtocol() : new ViaProtocol());
              await protocol.initialize(s.activeTransport || hidTransport);

              if (isVial) {
                const unlockStatus = await (protocol as VialProtocol).getUnlockStatus();
                if (unlockStatus === 0) {
                  const success = await s.performDeviceUnlock(protocol as VialProtocol);
                  if (!success) throw new Error("Unlock failed.");
                }
              }

              // Set each key sequentially
              for (const tk of targetKeys) {
                if (tk.row !== undefined && tk.col !== undefined) {
                  console.log(`[VIA/Vial Delete Write] Layer:${currentLayer} Row:${tk.row} Col:${tk.col}`, newAction);
                  await protocol.setKey(currentLayer, tk.row, tk.col, newAction);
                }
              }
            } catch (err) {
              console.error('Failed to delete keycodes on device:', err);
            }
          }
        },

        setSelectedKeycode: async (action: UniversalAction) => {
          const s = get();
          const { appMode, currentLayer, selectedKeyIds, keys, settings, connectedDevice } = s;
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
                if (tk.row !== undefined && tk.col !== undefined) {
                  newLayer[tk.row * 32 + tk.col] = action;
                }
              });
              newRemoteKeymap[currentLayer] = newLayer;
            }

            return { keys: updatedKeys, baseKeys: updatedKeys, remoteKeymap: newRemoteKeymap };
          });

          // 2. If connected to a device in remap mode, sync to device sequentially
          if (appMode === 'remap' && connectedDevice) {
            try {
              const isZmk = connectedDevice?.protocolType === 'zmk';
              const isVial = connectedDevice?.protocolType === 'vial';
              const protocol = isZmk
                ? new ZmkProtocol()
                : (isVial ? new VialProtocol() : new ViaProtocol());
              await protocol.initialize(s.activeTransport || hidTransport);

              if (isVial) {
                const unlockStatus = await (protocol as VialProtocol).getUnlockStatus();
                if (unlockStatus === 0) {
                  const success = await s.performDeviceUnlock(protocol as VialProtocol);
                  if (!success) throw new Error("Unlock failed.");
                }
              }

              // Set each key sequentially
              for (const tk of targetKeys) {
                if (tk.row !== undefined && tk.col !== undefined) {
                  console.log(`[VIA/Vial Bulk Write] Layer:${currentLayer} Row:${tk.row} Col:${tk.col}`, action);
                  await protocol.setKey(currentLayer, tk.row, tk.col, action);
                }
              }
            } catch (err) {
              console.error('Failed to update keycodes on device:', err);
            }
          }
        },
        setCurrentLayer: (l: number) => set({ currentLayer: l }),

        setKeycode: (id: string, l: number, action: UniversalAction) => set((s) => ({
          keys: s.keys.map(k => k.id === id ? { ...k, keymap: { ...k.keymap, [l]: action } } : k)
        })),

        setMatrixPosition: (id: string, row: number | undefined, col: number | undefined) => set((s) => ({
          keys: s.keys.map(k => k.id === id ? { ...k, row, col } : k)
        })),

        setPainter: (p: Partial<KeyboardState['painter']>) => set((s) => ({ painter: { ...s.painter, ...p } })),
        
        paintKey: (id: string) => set((s) => {
          const { currentRow: r, currentCol: c, autoIncrement: a } = s.painter;
          const nextRow = a === 'row' ? r + 1 : r;
          const nextCol = a === 'col' ? c + 1 : c;
          return {
            keys: s.keys.map(k => k.id === id ? { ...k, row: r, col: c } : k),
            painter: { ...s.painter, currentRow: nextRow, currentCol: nextCol }
          };
        }),

        setMatrixSubMode: (m: 'paint' | 'manual') => set({ matrixSubMode: m, selectedKeyIds: [] }),

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
          return {
            settings: { ...s.settings, pins: p }
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
          const { id, updatedAt, keys: rawKeys, ...settings } = project;
          const settingsWithDefaultMatrix = {
            ...settings,
            matrix: settings.matrix || {
              rows: settings.pins?.rows?.length || 0,
              cols: settings.pins?.cols?.length || 0
            }
          };

          // Assign fresh runtime IDs to all keys (id is not persisted)
          let newKeys = rawKeys.map(k => ({
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
            editorMode: 'layout',
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
            const { keys, name, vendorProductId, layoutOptions, pins, hardware, features } = result;
            
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
              // Assign fresh runtime IDs first so keys and baseKeys share the exact same key list and references
              let appliedKeys = keys.map(k => ({ ...k, id: crypto.randomUUID() }));
              
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

              const finalKeys = appliedKeys.filter(k => !k.decal);

              return {
                keys: finalKeys,
                baseKeys: finalKeys,
                settings: {
                  ...s.settings,
                  name: name || s.settings.name,
                  vendorProductId: vendorProductId || s.settings.vendorProductId,
                  layoutOptions: layoutOptions || {},
                  activeOptions: {},
                  pins: pins ? { ...s.settings.pins, ...pins } : s.settings.pins,
                  hardware: hardware ? { ...s.settings.hardware, ...hardware } : s.settings.hardware,
                  features: features ? { ...s.settings.features, ...features } : s.settings.features,
                  matrix: {
                    rows: (pins && pins.rows && pins.rows.length > 0) ? pins.rows.length : (hasMatrix ? maxRow + 1 : s.settings.matrix.rows),
                    cols: (pins && pins.cols && pins.cols.length > 0) ? pins.cols.length : (hasMatrix ? maxCol + 1 : s.settings.matrix.cols),
                  }
                },
                isProjectOpen: true,
                selectedKeyIds: [],
                focusedKeyId: null,
                editorMode: 'layout',
                currentLayer: 0,
                transform: getCenteredTransform(finalKeys, {}),
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
            vialUid: generateRandomVialUid()
          } as ProjectSettings,
          keys: [],
          currentProjectId: null,
          isProjectOpen: keepOpen,
          selectedKeyIds: [],
          focusedKeyId: null,
          editorMode: 'layout',
          currentLayer: 0,
          transform: { scale: 1, x: 0, y: 0 },
        })),

        clearMatrixMap: () => set((s: KeyboardState) => ({
          keys: s.keys.map(k => ({ ...k, row: undefined, col: undefined }))
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
          const sorted = sortKeys(visKeys, s.editorSettings.sortThresholdY);
          let currentRow = 0;
          let currentCol = 0;
          const idToMatrix: Record<string, { row: number, col: number }> = {};
          sorted.forEach((k: PhysicalKey, i: number) => {
            if (i > 0) {
              const prev = sorted[i-1];
              if (Math.abs(k.y - prev.y) > s.editorSettings.sortThresholdY) {
                currentRow++;
                currentCol = 0;
              } else {
                currentCol++;
              }
            }
            idToMatrix[k.id!] = { row: currentRow, col: currentCol };
          });
          return {
            keys: s.keys.map(k => idToMatrix[k.id!] ? { ...k, ...idToMatrix[k.id!] } : k),
            painter: { ...s.painter, currentRow: 0, currentCol: 0 }
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
          const { matrix, ...settingsWithoutMatrix } = state.settings;
          return {
            settings: settingsWithoutMatrix,
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
