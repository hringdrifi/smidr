import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getMatrixFromPins, useKeyboardStore } from '../store';
import {
  getStoredAppMode,
  getStoredEditorMode,
  setStoredAppMode,
  setStoredEditorMode,
} from '../storage';
import { UniversalAction } from '../../types/actions';

// Polyfill crypto if not present in Node test environment
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto as any;
}

const createMemoryStorage = (): Storage => {
  let data: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear: () => {
      data = {};
    },
    getItem: (key: string) => data[key] ?? null,
    key: (index: number) => Object.keys(data)[index] ?? null,
    removeItem: (key: string) => {
      delete data[key];
    },
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
};

describe('useKeyboardStore', () => {
  beforeEach(() => {
    // Reset store state to initial/known isolated values
    useKeyboardStore.setState({
      keys: [],
      baseKeys: [],
      selectedKeyIds: [],
      focusedKeyId: null,
      selectionAnchorId: null,
      clipboard: [],
      matrixClipboard: [],
      actionClipboard: [],
      editorMode: 'layout',
      appMode: 'design',
      currentLayer: 0
    });
  });

  it('should initialize with empty keys', () => {
    const state = useKeyboardStore.getState();
    expect(state.keys).toEqual([]);
    expect(state.selectedKeyIds).toEqual([]);
  });

  it('should persist app and editor mode selections', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('localStorage', storage);

    try {
      const store = useKeyboardStore.getState();

      store.setAppMode('remap');
      store.setEditorMode('matrix');

      expect(getStoredAppMode()).toBe('remap');
      expect(getStoredEditorMode()).toBe('matrix');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should ignore invalid stored mode values', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    vi.stubGlobal('localStorage', storage);

    try {
      localStorage.setItem('smidr_app_mode', 'invalid');
      localStorage.setItem('smidr_editor_mode', 'invalid');

      expect(getStoredAppMode()).toBe('remap');
      expect(getStoredEditorMode()).toBe('layout');

      setStoredAppMode('design');
      setStoredEditorMode('keymap');

      expect(getStoredAppMode()).toBe('design');
      expect(getStoredEditorMode()).toBe('keymap');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('should keep imported VIA layout option selections active', () => {
    const store = useKeyboardStore.getState();
    store.resetProject();

    store.importKeyboardDefinition({
      name: 'Test VIA',
      vendorId: '0x1234',
      productId: '0xABCD',
      matrix: { rows: 2, cols: 3 },
      layouts: {
        labels: ['Split Backspace'],
        keymap: [
          [{ a: 4 }, '0,0\n\n\n\n\n\n\n\n0,0'],
        ],
      },
    });

    const state = useKeyboardStore.getState();
    expect(state.settings.vendorProductId).toBe((0x1234 << 16) | 0xABCD);
    expect(state.settings.layoutOptions).toEqual({
      '0': { name: 'Split Backspace', type: 'toggle' },
    });
    expect(state.settings.activeOptions).toEqual({ '0': 0 });
    expect(state.settings.matrix).toEqual({ rows: 2, cols: 3 });
  });

  it('should keep pin-based matrix when imported VIA matrix differs', () => {
    const store = useKeyboardStore.getState();
    const originalAlert = globalThis.alert;
    globalThis.alert = vi.fn() as any;

    try {
      store.resetProject();
      store.updateSettings({
        pins: { rows: ['R0'], cols: ['C0', 'C1'] },
      } as any);

      store.importKeyboardDefinition({
        name: 'Test VIA',
        vendorId: '0x1234',
        productId: '0xABCD',
        matrix: { rows: 2, cols: 3 },
        layouts: {
          labels: [],
          keymap: [
            ['0,0'],
          ],
        },
      });

      const state = useKeyboardStore.getState();
      expect(state.settings.matrix).toEqual({ rows: 1, cols: 2 });
      expect(globalThis.alert).toHaveBeenCalledOnce();
    } finally {
      globalThis.alert = originalAlert;
    }
  });

  it('should derive split matrix dimensions per half', () => {
    expect(getMatrixFromPins({
      rows: ['R0', 'R1', 'R2', 'R3'],
      cols: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'],
      splitRows: ['RR0', 'RR1', 'RR2', 'RR3'],
      splitCols: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'],
    }, true)).toEqual({ rows: 4, cols: 6 });
  });

  it('should paint split keys with local matrix columns before wrapping', () => {
    const store = useKeyboardStore.getState();
    store.resetProject();
    store.updateSettings({
      features: {
        ...useKeyboardStore.getState().settings.features,
        split: true,
      },
      pins: {
        rows: ['R0'],
        cols: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'],
        splitRows: ['RR0'],
        splitCols: ['R0', 'R1', 'R2', 'R3', 'R4', 'R5'],
      },
    } as any);
    store.addKey({ x: 0, y: 0, w: 1, h: 1 });
    store.setPainter({ currentRow: 0, currentCol: 5, currentSide: 'right', autoIncrement: 'matrix' });

    const keyId = useKeyboardStore.getState().keys[0].id;
    useKeyboardStore.getState().paintKey(keyId);

    const state = useKeyboardStore.getState();
    expect(state.keys[0].row).toBe(0);
    expect(state.keys[0].col).toBe(5);
    expect(state.keys[0].matrixSide).toBe('right');
    expect(state.painter.currentRow).toBe(1);
    expect(state.painter.currentCol).toBe(0);
  });

  it('should load .smidr vendorId/productId into internal vendorProductId', () => {
    const store = useKeyboardStore.getState();
    store.resetProject();

    store.loadProject({
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
      name: 'Project IDs',
      manufacturer: 'Test',
      description: '',
      vendorId: '0x1234',
      productId: '0xABCD',
      matrix: { rows: 0, cols: 0 },
      pins: { rows: [], cols: [] },
      hardware: {
        controllerType: 'development_board',
        mcu: 'rp2040',
        board: 'promicro',
        diodeDirection: 'ROW2COL',
      },
      features: {
        rgb: false,
        encoder: false,
        oled: false,
        via: true,
        split: false,
      },
      layers: 4,
      layoutOptions: {},
      activeOptions: {},
      keys: [],
    });

    const state = useKeyboardStore.getState();
    expect(state.settings.vendorProductId).toBe((0x1234 << 16) | 0xABCD);
    expect(state.settings).not.toHaveProperty('vendorId');
    expect(state.settings).not.toHaveProperty('productId');
  });

  it('should add a key successfully', () => {
    const store = useKeyboardStore.getState();
    store.addKey({ x: 1, y: 1, w: 1, h: 1, label: 'A' });

    const updatedState = useKeyboardStore.getState();
    expect(updatedState.keys).toHaveLength(1);
    expect(updatedState.keys[0].label).toBe('A');
    expect(updatedState.keys[0].x).toBe(1);
    expect(updatedState.keys[0].y).toBe(1);
    
    // Newly added keys should automatically be selected, focused, and anchored
    const addedId = updatedState.keys[0].id;
    expect(updatedState.selectedKeyIds).toEqual([addedId]);
    expect(updatedState.focusedKeyId).toBe(addedId);
  });

  it('should remove a key and preserve selection consistency', () => {
    const store = useKeyboardStore.getState();
    store.addKey({ x: 0, y: 0, w: 1, h: 1, label: 'A' });
    
    let state = useKeyboardStore.getState();
    const idA = state.keys[0].id;
    expect(state.selectedKeyIds).toEqual([idA]);

    // Now remove the key
    store.removeKey(idA);

    state = useKeyboardStore.getState();
    expect(state.keys).toHaveLength(0);
    // The consistency middleware should automatically prune the selected keys
    expect(state.selectedKeyIds).toEqual([]);
    expect(state.focusedKeyId).toBeNull();
  });

  it('should toggle key selection correctly', () => {
    const store = useKeyboardStore.getState();
    store.addKey({ x: 0, y: 0, w: 1, h: 1, label: 'A' });
    store.addKey({ x: 1, y: 0, w: 1, h: 1, label: 'B' });

    let state = useKeyboardStore.getState();
    const idA = state.keys[0].id;
    const idB = state.keys[1].id;

    // Toggle selection multi = false (single select)
    store.toggleKeySelection(idA, false);
    state = useKeyboardStore.getState();
    expect(state.selectedKeyIds).toEqual([idA]);

    // Toggle selection multi = true (multi select)
    store.toggleKeySelection(idB, true);
    state = useKeyboardStore.getState();
    expect(state.selectedKeyIds).toContain(idA);
    expect(state.selectedKeyIds).toContain(idB);
  });

  it('should handle copying and pasting keys with offset', () => {
    const store = useKeyboardStore.getState();
    store.addKey({ x: 2, y: 2, w: 1, h: 1, label: 'A' });

    let state = useKeyboardStore.getState();
    const idA = state.keys[0].id;
    store.setSelectedKeyIds([idA]);

    // Copy
    store.copyKeys();
    state = useKeyboardStore.getState();
    expect(state.clipboard).toHaveLength(1);
    expect(state.clipboard[0].label).toBe('A');

    // Paste
    store.pasteKeys();
    state = useKeyboardStore.getState();
    expect(state.keys).toHaveLength(2);
    
    // The pasted key should have an offset of 0.25u applied
    const pastedKey = state.keys.find(k => k.id !== idA);
    expect(pastedKey).toBeDefined();
    expect(pastedKey?.x).toBe(2.25);
    expect(pastedKey?.y).toBe(2.25);
  });

  it('should clone encoder definitions when copying and pasting encoder keys', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({
      settings: {
        ...store.settings,
        features: { ...store.settings.features, encoder: true },
        encoders: [{
          id: 'encoder-original',
          pinA: 'GP2',
          pinB: 'GP3',
          keymap: {
            0: {
              counterClockwise: { action: 'tap', keycode: 'VOLD' },
              clockwise: { action: 'tap', keycode: 'VOLU' },
            },
          },
        }],
      },
    });
    store.addKey({
      kind: 'encoder',
      encoderId: 'encoder-original',
      x: 2,
      y: 2,
      w: 1,
      h: 1,
      label: '',
    });

    let state = useKeyboardStore.getState();
    const originalKey = state.keys[0];
    store.setSelectedKeyIds([originalKey.id]);
    store.copyKeys();
    store.pasteKeys();

    state = useKeyboardStore.getState();
    expect(state.keys).toHaveLength(2);
    expect(state.settings.encoders).toHaveLength(2);

    const pastedKey = state.keys.find(k => k.id !== originalKey.id);
    expect(pastedKey).toBeDefined();
    expect(pastedKey?.encoderId).toBeDefined();
    expect(pastedKey?.encoderId).not.toBe(originalKey.encoderId);
    expect(state.settings.encoders?.map(encoder => encoder.id)).toContain(pastedKey?.encoderId);
    expect(state.settings.encoders?.[1].pinA).toBe('GP2');
    expect(state.settings.encoders?.[1].pinB).toBe('GP3');
    expect(state.settings.encoders?.[1].keymap).toEqual(state.settings.encoders?.[0].keymap);
  });

  it('should prune orphan encoder definitions before adding a new encoder key', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({
      keys: [],
      selectedKeyIds: [],
      focusedKeyId: null,
      settings: {
        ...store.settings,
        features: { ...store.settings.features, encoder: true },
        encoders: [{ id: 'orphan-encoder', pinA: 'GP2', pinB: 'GP3' }],
      },
    });

    store.addEncoderKey();

    const state = useKeyboardStore.getState();
    expect(state.keys).toHaveLength(1);
    expect(state.settings.encoders).toHaveLength(1);
    expect(state.keys[0].encoderId).toBe(state.settings.encoders?.[0].id);
    expect(state.settings.encoders?.[0].id).not.toBe('orphan-encoder');
  });

  it('should handle copying and pasting matrix coordinates in matrix mode', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({ editorMode: 'matrix' });

    store.addKeys([
      { x: 0, y: 0, w: 1, h: 1, row: 1, col: 2 },
      { x: 1, y: 0, w: 1, h: 1, row: 3, col: 4 }
    ], { skipCollision: true });

    let state = useKeyboardStore.getState();
    const ids = state.keys.map(k => k.id);
    store.setSelectedKeyIds(ids);

    // Copy matrix coordinates
    store.copyKeys();
    state = useKeyboardStore.getState();
    expect(state.matrixClipboard).toHaveLength(2);
    expect(state.matrixClipboard[0]).toEqual({ row: 1, col: 2 });
    expect(state.matrixClipboard[1]).toEqual({ row: 3, col: 4 });

    // Add target keys
    store.addKeys([
      { x: 0, y: 1, w: 1, h: 1 },
      { x: 1, y: 1, w: 1, h: 1 }
    ], { skipCollision: true });

    state = useKeyboardStore.getState();
    const targetIds = state.keys.slice(2).map(k => k.id);
    store.setSelectedKeyIds(targetIds);

    // Paste matrix coordinates
    store.pasteKeys();
    state = useKeyboardStore.getState();
    
    expect(state.keys[2].row).toBe(1);
    expect(state.keys[2].col).toBe(2);
    expect(state.keys[3].row).toBe(3);
    expect(state.keys[3].col).toBe(4);
  });

  it('should preserve split side without assigning matrix row and col', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({
      settings: {
        ...store.settings,
        features: { ...store.settings.features, split: true },
      },
    });
    store.addKey({ x: 0, y: 0, w: 1, h: 1, label: 'A' });

    const keyId = useKeyboardStore.getState().keys[0].id;
    store.setMatrixPosition(keyId, undefined, undefined, 'right');

    const key = useKeyboardStore.getState().keys[0];
    expect(key.row).toBeUndefined();
    expect(key.col).toBeUndefined();
    expect(key.matrixSide).toBe('right');
  });

  it('should handle copying and pasting universal actions in keymap mode (design app mode)', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({ editorMode: 'keymap', appMode: 'design', currentLayer: 0 });

    store.addKeys([
      { x: 0, y: 0, w: 1, h: 1, keymap: { 0: { action: 'tap', keycode: 'A' } } },
      { x: 1, y: 0, w: 1, h: 1, keymap: { 0: { action: 'tap', keycode: 'B' } } }
    ], { skipCollision: true });

    let state = useKeyboardStore.getState();
    const ids = state.keys.map(k => k.id);
    store.setSelectedKeyIds(ids);

    // Copy actions
    store.copyKeys();
    state = useKeyboardStore.getState();
    expect(state.actionClipboard).toHaveLength(2);
    expect(state.actionClipboard[0]).toEqual({ action: 'tap', keycode: 'A' });
    expect(state.actionClipboard[1]).toEqual({ action: 'tap', keycode: 'B' });

    // Add target keys
    store.addKeys([
      { x: 0, y: 1, w: 1, h: 1 },
      { x: 1, y: 1, w: 1, h: 1 }
    ], { skipCollision: true });

    state = useKeyboardStore.getState();
    const targetIds = state.keys.slice(2).map(k => k.id);
    store.setSelectedKeyIds(targetIds);

    // Paste actions
    store.pasteKeys();
    state = useKeyboardStore.getState();

    expect(state.keys[2].keymap?.[0]).toEqual({ action: 'tap', keycode: 'A' });
    expect(state.keys[3].keymap?.[0]).toEqual({ action: 'tap', keycode: 'B' });
  });

  it('should handle copying and pasting universal actions in keymap mode (remap app mode)', () => {
    const store = useKeyboardStore.getState();
    const remoteKeymap: Record<number, UniversalAction[]> = {
      0: []
    };
    remoteKeymap[0][0] = { action: 'tap', keycode: 'X' };
    remoteKeymap[0][1] = { action: 'tap', keycode: 'Y' };

    useKeyboardStore.setState({ 
      editorMode: 'keymap', 
      appMode: 'remap', 
      currentLayer: 0,
      remoteKeymap
    });

    store.addKeys([
      { x: 0, y: 0, w: 1, h: 1, row: 0, col: 0 },
      { x: 1, y: 0, w: 1, h: 1, row: 0, col: 1 }
    ], { skipCollision: true });

    let state = useKeyboardStore.getState();
    const ids = state.keys.map(k => k.id);
    store.setSelectedKeyIds(ids);

    // Copy actions
    store.copyKeys();
    state = useKeyboardStore.getState();
    expect(state.actionClipboard).toHaveLength(2);
    expect(state.actionClipboard[0]).toEqual({ action: 'tap', keycode: 'X' });
    expect(state.actionClipboard[1]).toEqual({ action: 'tap', keycode: 'Y' });

    // Add target keys
    store.addKeys([
      { x: 0, y: 1, w: 1, h: 1, row: 1, col: 0 },
      { x: 1, y: 1, w: 1, h: 1, row: 1, col: 1 }
    ], { skipCollision: true });

    state = useKeyboardStore.getState();
    const targetIds = state.keys.slice(2).map(k => k.id);
    store.setSelectedKeyIds(targetIds);

    // Paste actions
    store.pasteKeys();
    state = useKeyboardStore.getState();

    // Verify local keys updated
    expect(state.keys[2].keymap?.[0]).toEqual({ action: 'tap', keycode: 'X' });
    expect(state.keys[3].keymap?.[0]).toEqual({ action: 'tap', keycode: 'Y' });

    // Verify remote keymap updated
    expect(state.remoteKeymap[0][32]).toEqual({ action: 'tap', keycode: 'X' });
    expect(state.remoteKeymap[0][33]).toEqual({ action: 'tap', keycode: 'Y' });
  });

  it('should remove the last layer keymap data and retarget references to layer 0', () => {
    const store = useKeyboardStore.getState();
    useKeyboardStore.setState({
      settings: {
        ...useKeyboardStore.getState().settings,
        layers: 3
      },
      currentLayer: 2,
      remoteKeymap: {
        0: [],
        1: [],
        2: [{ action: 'tap', keycode: 'Z' }]
      }
    });

    store.addKeys([
      {
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        keymap: {
          0: { action: 'mo', layerId: 2 },
          1: { action: 'lt', layerId: 2, tapAction: { action: 'tap', keycode: 'A' } },
          2: { action: 'tap', keycode: 'B' }
        }
      }
    ], { skipCollision: true });

    store.removeLastLayer();
    const state = useKeyboardStore.getState();
    const keymap = state.keys[0].keymap;

    expect(state.settings.layers).toBe(2);
    expect(state.currentLayer).toBe(1);
    expect(keymap?.[2]).toBeUndefined();
    expect(keymap?.[0]).toEqual({ action: 'mo', layerId: 0 });
    expect(keymap?.[1]).toEqual({ action: 'lt', layerId: 0, tapAction: { action: 'tap', keycode: 'A' } });
    expect(state.remoteKeymap[2]).toBeUndefined();
  });

  it('should align keys correctly', () => {
    const store = useKeyboardStore.getState();
    // Add two keys at different locations
    store.addKeys([
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 4, y: 2, w: 1, h: 1 }
    ], { skipCollision: true });

    let state = useKeyboardStore.getState();
    const ids = state.keys.map(k => k.id);
    store.setSelectedKeyIds(ids);

    // Align Left: should align both to Min X (0)
    store.alignSelectedKeys('left');
    state = useKeyboardStore.getState();
    expect(state.keys[0].x).toBe(0);
    expect(state.keys[1].x).toBe(0);
  });
});
