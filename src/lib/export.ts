import { KeyboardState } from './store';
import { PhysicalKey, SmidrProject, ProjectSettings } from '@/types/keyboard';
import { exportKLE } from './kle';
import { actionToQmkString } from './protocols/via-action-converter';

/**
 * Generates a VIA/Vial compatible JSON definition.
 */
export const generateViaJson = (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;

  // Format labels from layoutOptions
  const labels: any[] = [];
  const groupIds = Object.keys(settings.layoutOptions || {}).map(Number).sort((a, b) => a - b);
  groupIds.forEach(groupId => {
    const opt = settings.layoutOptions[groupId.toString()];
    if (opt.type === 'list' && opt.choices) {
      labels.push([opt.name, ...opt.choices]);
    } else {
      labels.push(opt.name);
    }
  });

  // Prepare keys with correct matrix and layout option labels for KLE export
  const viaKeys = keys.map(key => {
    let label = '';
    if (key.row !== undefined && key.col !== undefined) {
      label = `${key.row},${key.col}`;
    }
    if (key.group !== undefined && key.option !== undefined) {
      label += `\n\n\n${key.group},${key.option}`;
    }
    return {
      ...key,
      label
    };
  });

  // Generate KLE for VIA
  const kleData = exportKLE(viaKeys);

  // Generate Keymaps array for VIA (layers -> rows -> cols)
  const layersCount = settings.layers || 4;
  const keymaps: string[][][] = Array.from({ length: layersCount }, () => 
    Array.from({ length: settings.matrix.rows }, () => 
      Array.from({ length: settings.matrix.cols }, () => 'KC_TRNS')
    )
  );

  keys.forEach(key => {
    if (key.row !== undefined && key.col !== undefined &&
        key.row < settings.matrix.rows && key.col < settings.matrix.cols) {
      Object.entries(key.keymap || {}).forEach(([layer, action]) => {
        const l = parseInt(layer);
        if (l < layersCount) {
          keymaps[l][key.row!][key.col!] = actionToQmkString(action);
        }
      });
    }
  });

  return {
    name: settings.name,
    vendorId: `0x${((settings.vendorProductId >>> 16) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
    productId: `0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
    manufacturer: settings.manufacturer,
    description: settings.description,
    firmwareVersion: 1,
    menus: [
      "qmk_rgb_matrix",
      "qmk_backlight"
    ],
    keycodes: [
      "qmk_lighting"
    ],
    matrix: {
      rows: settings.matrix.rows,
      cols: settings.matrix.cols,
    },
    layouts: {
      labels: labels.length > 0 ? labels : undefined,
      keymap: kleData,
    },
    keymaps: keymaps
  };
};

/**
 * Generates a full Smidr Project JSON (containing internal metadata).
 */
export const generateSmidrProjectJson = (state: { settings: ProjectSettings, keys: PhysicalKey[] }): SmidrProject => {
  const { settings, keys } = state;
  return {
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    ...settings,
    // Strip runtime-only 'id' field before persisting
    keys: keys.map(({ id, ...keyData }) => keyData as PhysicalKey)
  };
};

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadJson = (filename: string, data: any) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(filename, blob);
};
