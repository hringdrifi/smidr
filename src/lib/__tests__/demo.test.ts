import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_DEVICE, createDemoProject, createDemoRemoteKeymap, isDemoModeEnabled } from '../demo';
import { useKeyboardStore } from '../store';

const stubLocation = (search: string) => {
  vi.stubGlobal('window', {
    location: { search },
  });
};

describe('demo mode', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useKeyboardStore.setState({
      isDemoMode: false,
      appMode: 'design',
      editorMode: 'layout',
      keys: [],
      baseKeys: [],
      connectedDevice: null,
      deviceCapabilities: null,
      remoteKeymap: {},
      isProjectOpen: false,
      selectedKeyIds: [],
      focusedKeyId: null,
      selectionAnchorId: null,
      currentLayer: 0,
    });
  });

  it('detects supported demo query parameters', () => {
    stubLocation('?demo=1');
    expect(isDemoModeEnabled()).toBe(true);

    stubLocation('?demo=true');
    expect(isDemoModeEnabled()).toBe(true);

    stubLocation('?demo=0');
    expect(isDemoModeEnabled()).toBe(false);
  });

  it('creates a virtual Vial project and remote keymap', () => {
    const project = createDemoProject();
    const remoteKeymap = createDemoRemoteKeymap(project.keys);
    const sharedKeys = project.keys.filter(key => key.group === undefined);
    const outerColumnKeys = project.keys.filter(key => key.group === '0' && key.option === 0);

    expect(project.id).toBe('smidr-demo-project');
    expect(project.features.rgb).toBe(true);
    expect(project.features.encoder).toBe(true);
    expect(project.layoutOptions['0']).toEqual({
      name: 'Columns',
      type: 'list',
      choices: ['6 columns', '5 columns'],
    });
    expect(sharedKeys).toHaveLength(36);
    expect(outerColumnKeys).toHaveLength(6);
    expect(project.keys.filter(key => key.group === '0' && key.option === 1)).toHaveLength(0);
    expect(project.keys.some(key => Object.values(key.keymap || {}).some(action => (
      action.action === 'tap' && action.keycode.startsWith('KC_')
    )))).toBe(false);
    expect(remoteKeymap[0].some(Boolean)).toBe(true);
  });

  it('updates virtual keymap without a real transport', async () => {
    useKeyboardStore.getState().initializeDemoMode();
    const state = useKeyboardStore.getState();
    const firstKey = state.keys[0];

    await state.updateDeviceKeycode(0, firstKey.row!, firstKey.col!, { action: 'tap', keycode: 'A' });

    const updated = useKeyboardStore.getState();
    const remoteIndex = firstKey.row! * 32 + firstKey.col!;
    expect(updated.connectedDevice).toEqual(DEMO_DEVICE);
    expect(updated.remoteKeymap[0][remoteIndex]).toEqual({ action: 'tap', keycode: 'A' });
    expect(updated.keys.find(k => k.id === firstKey.id)?.keymap?.[0]).toEqual({ action: 'tap', keycode: 'A' });
  });
});
