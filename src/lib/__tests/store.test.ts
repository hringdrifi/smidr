import { beforeEach, describe, it, expect } from 'vitest';
import { useKeyboardStore } from '../store';
import { UniversalAction } from '../../types/actions';

// Polyfill crypto if not present in Node test environment
if (!globalThis.crypto) {
  globalThis.crypto = require('node:crypto').webcrypto as any;
}

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
