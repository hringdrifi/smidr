import type {
  EncoderDefinition,
  PhysicalKey,
  SmidrProject,
  SmidrProjectFileV05,
  TrackballDefinition,
} from '@/types/keyboard';
import { inferMatrixSideFromGeometry } from './matrix-utils';

export const SMIDR_SCHEMA_VERSION = '0.5' as const;

const hex16 = (value: number) => `0x${(value & 0xffff).toString(16).toUpperCase().padStart(4, '0')}`;

const stripRuntimeKeys = (
  keys: PhysicalKey[],
  encoders: EncoderDefinition[] = [],
  trackballs: TrackballDefinition[] = [],
) => {
  const encoderIndexById = new Map(encoders.map((encoder, index) => [encoder.id, index]));
  const trackballIndexById = new Map(trackballs.map((trackball, index) => [trackball.id, index]));

  return keys.map((key) => {
    const persisted = { ...key };
    const encoderId = persisted.encoderId;
    const trackballId = persisted.trackballId;
    delete persisted.id;
    delete persisted.encoderId;
    delete persisted.trackballId;
    if (persisted.directIndex !== undefined) delete persisted.directPin;
    if (encoderId && encoderIndexById.has(encoderId)) persisted.encoderIndex = encoderIndexById.get(encoderId);
    if (trackballId && trackballIndexById.has(trackballId)) persisted.trackballIndex = trackballIndexById.get(trackballId);
    return persisted;
  });
};

export const isSmidrProjectFileV05 = (value: unknown): value is SmidrProjectFileV05 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SmidrProjectFileV05>;
  return candidate.schemaVersion === SMIDR_SCHEMA_VERSION
    && !!candidate.metadata
    && !!candidate.layout
    && Array.isArray(candidate.layout.keys)
    && !!candidate.hardware
    && !!candidate.firmware;
};

const withDirectPinPools = (project: SmidrProject): SmidrProject => {
  if (project.matrix?.wiring !== 'direct') return project;
  const getSide = (key: PhysicalKey) => project.features.split
    ? key.matrixSide || inferMatrixSideFromGeometry(key, project.keys)
    : 'left';
  const leftAssigned = project.keys
    .filter(key => key.directPin && getSide(key) !== 'right')
    .map(key => key.directPin as string);
  const rightAssigned = project.keys
    .filter(key => key.directPin && project.features.split && getSide(key) === 'right')
    .map(key => key.directPin as string);
  const direct = [...new Set([...(project.pins.direct || []), ...leftAssigned])];
  const splitDirect = [...new Set([...(project.pins.splitDirect || []), ...rightAssigned])];
  return {
    ...project,
    keys: project.keys.map(key => {
      if (key.directIndex !== undefined || !key.directPin) return key;
      const pool = getSide(key) === 'right' ? splitDirect : direct;
      const directIndex = pool.indexOf(key.directPin);
      if (directIndex < 0) return key;
      const migrated = { ...key, directIndex };
      delete migrated.directPin;
      return migrated;
    }),
    pins: {
      ...project.pins,
      direct,
      splitDirect,
    },
  };
};

export const toSmidrProjectFileV05 = (project: SmidrProject): SmidrProjectFileV05 => {
  const normalizedProject = withDirectPinPools(project);
  const vendorProductId = project.vendorProductId ?? 0;
  const encoders = (project.encoders || []).map(encoder => {
    const persisted = { ...encoder };
    delete persisted.id;
    return persisted;
  });
  const trackballs = (project.trackballs || []).map(trackball => {
    const persisted = { ...trackball };
    delete persisted.id;
    return persisted;
  });
  const { split: _split, ...firmwareFeatures } = project.features;
  const pins = { ...normalizedProject.pins };
  if (!project.features.split) {
    delete pins.splitRows;
    delete pins.splitCols;
    delete pins.splitSerial;
  }

  return {
    schemaVersion: SMIDR_SCHEMA_VERSION,
    id: project.id || crypto.randomUUID(),
    updatedAt: project.updatedAt || Date.now(),
    metadata: {
      name: project.name,
      manufacturer: project.manufacturer,
      description: project.description,
    },
    layout: {
      keys: stripRuntimeKeys(normalizedProject.keys, project.encoders, project.trackballs),
      layoutOptions: project.layoutOptions || {},
      activeOptions: project.activeOptions || {},
    },
    hardware: {
      controllerType: project.hardware.controllerType,
      mcu: project.hardware.mcu,
      board: project.hardware.board,
      diodeDirection: project.hardware.diodeDirection,
      matrix: project.matrix,
      pins,
      split: project.features.split,
      encoders,
      trackballs,
    },
    firmware: {
      target: project.firmwareTarget === undefined ? undefined : project.firmwareTarget,
      vendorId: project.vendorId || hex16(vendorProductId >>> 16),
      productId: project.productId || hex16(vendorProductId),
      bootloader: project.hardware.bootloader,
      layers: project.layers,
      features: { ...firmwareFeatures, encoder: encoders.length > 0 },
      qmk: project.qmk,
      vialUid: project.vialUid,
      vial: project.vial,
      zmk: project.zmk,
      macros: project.macros,
      combos: project.combos,
      tapDances: project.tapDances,
    },
  };
};

export const fromSmidrProjectFile = (value: unknown): SmidrProject => {
  if (!isSmidrProjectFileV05(value)) return withDirectPinPools(value as SmidrProject);

  const { id, updatedAt, metadata, layout, hardware, firmware } = value;
  return withDirectPinPools({
    id,
    updatedAt,
    ...metadata,
    firmwareTarget: firmware.target === undefined ? 'qmk' : firmware.target,
    vendorId: firmware.vendorId,
    productId: firmware.productId,
    matrix: hardware.matrix,
    pins: hardware.pins,
    hardware: {
      controllerType: hardware.controllerType,
      mcu: hardware.mcu,
      board: hardware.board,
      diodeDirection: hardware.diodeDirection,
      bootloader: firmware.bootloader,
    },
    qmk: firmware.qmk,
    features: { ...firmware.features, split: hardware.split },
    layers: firmware.layers,
    encoders: hardware.encoders,
    trackballs: hardware.trackballs,
    macros: firmware.macros,
    combos: firmware.combos,
    tapDances: firmware.tapDances,
    layoutOptions: layout.layoutOptions,
    activeOptions: layout.activeOptions,
    vialUid: firmware.vialUid,
    vial: firmware.vial,
    zmk: firmware.zmk,
    keys: layout.keys,
  });
};
