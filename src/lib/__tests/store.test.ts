import { beforeEach, describe, it, expect } from 'vitest';
import { useKeyboardStore } from '../store';

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
      clipboard: []
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
