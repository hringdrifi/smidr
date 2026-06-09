import { PhysicalKey, SmidrProject, ProjectSettings } from '@/types/keyboard';
import { exportKLE } from './kle';
import { actionToQmkString } from './protocols/via-action-converter';
import { getFirmwareMatrixPosition, getMatrixDimensionsFromPositions, getQmkMatrixFromPins, isDirectPinMatrix } from './matrix-utils';
import { getKeyLabel, labelNodeToText, roundCoord } from './canvas-utils';
import { UniversalAction } from '@/types/actions';

type KleExportEditorMode = 'layout' | 'matrix' | 'keymap' | 'hardware';
type KleExportAppMode = 'design' | 'remap';

interface KleJsonExportOptions {
  editorMode: KleExportEditorMode;
  currentLayer: number;
  appMode?: KleExportAppMode;
  remoteKeymap?: Record<number, UniversalAction[]>;
}

const sortLayoutGroupIds = (ids: string[]) => {
  return [...ids].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    const aIsNumeric = Number.isFinite(an);
    const bIsNumeric = Number.isFinite(bn);

    if (aIsNumeric && bIsNumeric) return an - bn;
    if (aIsNumeric) return -1;
    if (bIsNumeric) return 1;
    return a.localeCompare(b);
  });
};

const getKeyBounds = (key: PhysicalKey) => {
  const rects = [
    { x: key.x, y: key.y, w: key.w, h: key.h }
  ];

  if (key.w2 !== undefined || key.h2 !== undefined || key.x2 !== undefined || key.y2 !== undefined) {
    rects.push({
      x: key.x + (key.x2 ?? 0),
      y: key.y + (key.y2 ?? 0),
      w: key.w2 ?? key.w,
      h: key.h2 ?? key.h
    });
  }

  return rects.reduce((bounds, rect) => ({
    minX: Math.min(bounds.minX, rect.x),
    minY: Math.min(bounds.minY, rect.y),
    maxX: Math.max(bounds.maxX, rect.x + rect.w),
    maxY: Math.max(bounds.maxY, rect.y + rect.h),
  }), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
};

const keysOverlap = (a: PhysicalKey, b: PhysicalKey) => {
  const ab = getKeyBounds(a);
  const bb = getKeyBounds(b);
  const overlapX = Math.max(0, Math.min(ab.maxX, bb.maxX) - Math.max(ab.minX, bb.minX));
  const overlapY = Math.max(0, Math.min(ab.maxY, bb.maxY) - Math.max(ab.minY, bb.minY));
  return overlapX > 0.1 && overlapY > 0.1;
};

const getMatrixDimensions = (settings: ProjectSettings, keys: PhysicalKey[]) => {
  const matrixKeys = isDirectPinMatrix(settings)
    ? keys
    : keys.filter(key => (
      key.row !== undefined &&
      key.col !== undefined &&
      key.row >= 0 &&
      key.col >= 0
    ));

  const positions = matrixKeys
    .map(key => getFirmwareMatrixPosition(settings, key, keys))
    .filter((pos): pos is { row: number; col: number } => !!pos);
  const pinMatrix = getQmkMatrixFromPins(settings.pins, settings.features.split);
  if (isDirectPinMatrix(settings)) {
    return getMatrixDimensionsFromPositions(positions, settings.matrix);
  }

  return {
    ...getMatrixDimensionsFromPositions(positions, {
      ...settings.matrix,
      rows: pinMatrix?.rows || settings.matrix?.rows || 0,
      cols: pinMatrix?.cols || settings.matrix?.cols || 0,
    }),
  };
};

const getVisibleKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  keys.filter(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option)
);

const getEncoderIndex = (settings: ProjectSettings, key: PhysicalKey) => {
  if (key.encoderId) {
    const index = (settings.encoders || []).findIndex(encoder => encoder.id === key.encoderId);
    if (index >= 0) return index;
  }
  return key.encoderIndex;
};

const isEncoderKey = (key: PhysicalKey) => (
  key.kind === 'encoder' || !!key.encoderId || key.encoderIndex !== undefined
);

const stripEncoderSecondaryShape = (key: PhysicalKey): PhysicalKey => {
  if (!isEncoderKey(key)) return { ...key };
  const { w2, h2, x2, y2, stepped, ...rest } = key;
  return rest;
};

const normalizeKeysForKle = (keys: PhysicalKey[]) => {
  if (keys.length === 0) return [];

  const minX = Math.min(...keys.flatMap(key => [key.x, key.rx ?? key.x]));
  const minY = Math.min(...keys.flatMap(key => [key.y, key.ry ?? key.y]));

  if (minX === 0 && minY === 0) return keys.map(stripEncoderSecondaryShape);

  return keys.map(key => ({
    ...stripEncoderSecondaryShape(key),
    x: roundCoord(key.x - minX),
    y: roundCoord(key.y - minY),
    rx: roundCoord((key.rx ?? key.x) - minX),
    ry: roundCoord((key.ry ?? key.y) - minY),
  }));
};

const getKleExportLabel = (
  key: PhysicalKey,
  settings: ProjectSettings,
  visibleKeys: PhysicalKey[],
  options: KleJsonExportOptions
) => {
  const appMode = options.appMode ?? 'design';
  if (appMode === 'design' && options.editorMode === 'layout') return key.label || '';

  return labelNodeToText(getKeyLabel(
    key,
    options.editorMode,
    options.currentLayer,
    appMode,
    options.remoteKeymap,
    settings.visualLayout,
    settings,
    visibleKeys
  ));
};

export const generateKleJson = (
  state: { settings: ProjectSettings, keys: PhysicalKey[] },
  options: KleJsonExportOptions
) => {
  const visibleKeys = getVisibleKeys(state.settings, state.keys);
  const labeledKeys = visibleKeys.map(key => ({
    ...stripEncoderSecondaryShape(key),
    label: getKleExportLabel(key, state.settings, visibleKeys, options),
  }));

  return exportKLE(normalizeKeysForKle(labeledKeys));
};

/**
 * Generates a VIA/Vial compatible JSON definition.
 */
export const generateViaJson = (state: { settings: ProjectSettings, keys: PhysicalKey[] }) => {
  const { settings, keys } = state;
  const matrix = getMatrixDimensions(settings, keys);

  // Format labels from layoutOptions
  const labels: any[] = [];
  const groupIds = sortLayoutGroupIds(Object.keys(settings.layoutOptions || {}));
  const exportGroupByInternalId = new Map<string, number>();
  groupIds.forEach(groupId => {
    const opt = settings.layoutOptions[groupId];
    exportGroupByInternalId.set(groupId, labels.length);
    if (opt.type === 'list' && opt.choices) {
      labels.push([opt.name, ...opt.choices]);
    } else {
      labels.push(opt.name);
    }
  });

  // Group active keys by their option group
  const keysByGroup: Record<string, PhysicalKey[]> = {};
  keys.forEach(k => {
    if (k.group !== undefined && k.option !== undefined) {
      if (!keysByGroup[k.group]) keysByGroup[k.group] = [];
      keysByGroup[k.group].push(k);
    }
  });

  const generatedBlockers: PhysicalKey[] = [];

  // For each option group, find all unique choices defined in settings or active keys
  Object.entries(keysByGroup).forEach(([g, gKeys]) => {
    const optSettings = settings.layoutOptions?.[g];
    const optionsInGroup = new Set<number>();
    
    // Always include option 0
    optionsInGroup.add(0);
    
    if (optSettings) {
      if (optSettings.type === 'list' && optSettings.choices) {
        optSettings.choices.forEach((_, choiceIdx) => {
          optionsInGroup.add(choiceIdx);
        });
      } else if (optSettings.type === 'toggle') {
        optionsInGroup.add(0);
        optionsInGroup.add(1);
      }
    }
    
    gKeys.forEach(k => {
      if (k.option !== undefined) {
        optionsInGroup.add(k.option);
      }
    });

    const uniqueOptions = Array.from(optionsInGroup);

    // Bidirectional scan:
    // If choice 'a' has a key at a position where choice 'b' has no overlapping key,
    // we generate a blocker decal key for choice 'b' at choice 'a's key position.
    uniqueOptions.forEach(b => {
      const bKeys = gKeys.filter(k => k.option === b);

      uniqueOptions.forEach(a => {
        if (a === b) return;
        
        const aKeys = gKeys.filter(k => k.option === a);

        aKeys.forEach(aKey => {
          const hasOverlap = bKeys.some(bKey => keysOverlap(aKey, bKey)) || generatedBlockers.some(blocker => {
            if (blocker.group !== g || blocker.option !== b) return false;
            return keysOverlap(aKey, blocker);
          });

          if (!hasOverlap) {
            generatedBlockers.push({
              x: aKey.x,
              y: aKey.y,
              w: aKey.w,
              h: aKey.h,
              r: aKey.r,
              rx: aKey.rx,
              ry: aKey.ry,
              w2: aKey.w2,
              h2: aKey.h2,
              x2: aKey.x2,
              y2: aKey.y2,
              stepped: aKey.stepped,
              group: g,
              option: b,
              decal: true,
              label: ''
            });
          }
        });
      });
    });
  });

  const allKeysToExport = [...keys, ...generatedBlockers];

  // Prepare keys with correct matrix and layout option labels for KLE export
  const viaKeys = allKeysToExport.map(key => {
    let label = '';
    const pos = getFirmwareMatrixPosition(settings, key, keys);
    if (!key.decal && pos) {
      label = `${pos.row},${pos.col}`;
    }
    if (key.group !== undefined && key.option !== undefined) {
      const exportGroup = exportGroupByInternalId.get(key.group);
      if (exportGroup !== undefined) {
        label += `\n\n\n${exportGroup},${key.option}`;
      }
    }
    const encoderIndex = getEncoderIndex(settings, key);
    if (!key.decal && encoderIndex !== undefined) {
      const parts = label.split('\n');
      while (parts.length <= 4) parts.push('');
      parts[4] = `e${encoderIndex}`;
      label = parts.join('\n');
    }
    return {
      ...stripEncoderSecondaryShape(key),
      label
    };
  });

  // Generate KLE for VIA
  const kleData = exportKLE(viaKeys);

  // Generate Keymaps array for VIA (layers -> rows -> cols)
  const layersCount = settings.layers || 4;
  const keymaps: string[][][] = Array.from({ length: layersCount }, () => 
    Array.from({ length: matrix.rows }, () =>
      Array.from({ length: matrix.cols }, () => 'KC_TRNS')
    )
  );

  keys.forEach(key => {
    const pos = getFirmwareMatrixPosition(settings, key, keys);
    if (pos &&
        pos.row >= 0 && pos.col >= 0 &&
        pos.row < matrix.rows && pos.col < matrix.cols) {
      Object.entries(key.keymap || {}).forEach(([layer, action]) => {
        const l = parseInt(layer);
        if (l < layersCount) {
          keymaps[l][pos.row][pos.col] = actionToQmkString(action);
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
    matrix,
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
  const { matrix, pins, vendorProductId, visualLayout, ...settingsWithoutRuntimeIds } = settings;
  const savedEncoders = (settings.encoders || []).map(({ id, ...encoder }) => encoder);
  const encoderIndexById = new Map((settings.encoders || []).map((encoder, index) => [encoder.id, index]));
  const savedPins = settings.features.split ? pins : { ...pins };
  if (!settings.features.split) {
    delete savedPins.splitRows;
    delete savedPins.splitCols;
    delete savedPins.splitSerial;
  }
  return {
    id: crypto.randomUUID(),
    updatedAt: Date.now(),
    ...settingsWithoutRuntimeIds,
    vendorId: `0x${((vendorProductId >>> 16) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
    productId: `0x${(vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`,
    matrix,
    pins: savedPins,
    encoders: savedEncoders,
    // Strip runtime-only 'id' field before persisting
    keys: keys.map((key) => {
      const { id, encoderId, encoderIndex, ...keyData } = stripEncoderSecondaryShape(key);
      const savedKey = { ...keyData } as PhysicalKey;
      if (encoderId && encoderIndexById.has(encoderId)) {
        savedKey.encoderIndex = encoderIndexById.get(encoderId);
      } else if (encoderIndex !== undefined) {
        savedKey.encoderIndex = encoderIndex;
      }
      return savedKey;
    })
  } as unknown as SmidrProject;
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
