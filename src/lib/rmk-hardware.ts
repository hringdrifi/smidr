import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getZmkHardwareTarget } from './mcu-presets';
import { getDirectMatrixSide, isDirectPinMatrix, resolveDirectPin } from './matrix-utils';
import { getSplitCommunication } from './split-communication';

export type RmkExportFormat = 'toml' | 'rust';

export const getRmkChip = (settings: ProjectSettings) =>
  getZmkHardwareTarget(settings.hardware) || String(settings.hardware.mcu).toLowerCase();

export const usesRmkAdafruitBootloader = (settings: ProjectSettings) => getRmkChip(settings) === 'nrf52840'
  && (settings.hardware.bootloader === 'adafruit' || settings.hardware.bootloader === 'adafruit-uf2'
    || (settings.hardware.controllerType !== 'mcu' && /nice_nano|nrfmicro|xiao.*nrf/i.test(settings.hardware.board)));

export const normalizeRmkPin = (pin: string | undefined, fallback = '_') => {
  const raw = pin?.trim();
  if (!raw) return fallback;
  const rp = raw.match(/^(?:GP|GPIO)(\d+)$/i);
  if (rp) return `PIN_${Number(rp[1])}`;
  const nrf = raw.match(/^P([01])[._](\d{1,2})$/i);
  if (nrf) return `P${nrf[1]}_${nrf[2].padStart(2, '0')}`;
  return raw;
};

export const getRmkTrackballs = (settings: ProjectSettings, keys: PhysicalKey[]) =>
  (settings.trackballs || []).flatMap((trackball, index) => {
    const placements = keys.filter(key => trackball.id ? key.trackballId === trackball.id : key.trackballIndex === index);
    const placement = placements.find(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option);
    if (placements.length && !placement) return [];
    return [{ ...trackball, index, side: placement ? getDirectMatrixSide(settings, placement, keys) : 'left' as const }];
  });

export const getRmkHardwareErrors = (settings: ProjectSettings, keys: PhysicalKey[], format: RmkExportFormat) => {
  const errors: string[] = [];
  const chip = getRmkChip(settings);
  if (format === 'rust' && !['rp2040', 'nrf52840'].includes(chip))
    errors.push('RMK Rust API export supports RP2040 and nRF52840.');
  const communication = getSplitCommunication(settings);
  if (settings.features.split && ((communication.transport === 'wired' && chip !== 'rp2040') || (communication.transport === 'wireless' && !chip.startsWith('nrf52'))))
    errors.push('RMK split export supports RP2040 wired serial and nRF52 wireless.');
  const occupied = new Map<string, string>();
  const reserve = (side: string, value: string | undefined, owner: string) => {
    if (!value?.trim()) return;
    const name = normalizeRmkPin(value);
    const key = `${side}:${name}`;
    const previous = occupied.get(key);
    if (previous) errors.push(`${side} ${name} is shared by ${previous} and ${owner}.`);
    occupied.set(key, owner);
  };
  for (const side of settings.features.split ? ['left', 'right'] as const : ['left'] as const) {
    if (isDirectPinMatrix(settings)) {
      keys.filter(key => (!key.group || (settings.activeOptions[key.group] ?? 0) === key.option) && getDirectMatrixSide(settings, key, keys) === side)
        .forEach(key => reserve(side, resolveDirectPin(settings, key, keys), 'switch'));
    } else {
      const rows = side === 'right' && settings.pins.splitRows?.length ? settings.pins.splitRows : settings.pins.rows;
      const cols = side === 'right' && settings.pins.splitCols?.length ? settings.pins.splitCols : settings.pins.cols;
      rows.forEach(p => reserve(side, p, 'matrix row'));
      cols.forEach(p => reserve(side, p, 'matrix column'));
    }
    if (settings.features.split && communication.transport === 'wired') {
      reserve(side, settings.pins.splitSerial, 'split TX');
      if (communication.duplex === 'full') reserve(side, settings.pins.splitSerialRx, 'split RX');
    }
  }
  const trackballs = getRmkTrackballs(settings, keys);
  if (trackballs.length && !['rp2040', 'nrf52840', 'nrf52832'].includes(chip))
    errors.push('RMK PMW3610 export requires RP2040 or nRF52.');
  for (const trackball of trackballs) {
    if (trackball.index > 254) errors.push('RMK supports trackball device IDs 0–254 (255 matches all devices).');
    if (![trackball.sclk, trackball.sdio, trackball.cs].every(pin => pin?.trim()))
      errors.push(`Trackball ${trackball.index}: assign SCLK, SDIO and CS before exporting RMK.`);
    const pins = [trackball.sclk, trackball.sdio, trackball.cs, trackball.motion].filter(pin => pin?.trim()).map(pin => normalizeRmkPin(pin));
    pins.forEach(value => {
      const match = chip === 'rp2040' ? value.match(/^PIN_(\d+)$/) : value.match(/^P([01])_(\d{2})$/);
      const valid = match && (chip === 'rp2040' ? Number(match[1]) <= 29 : Number(match[2]) <= (match[1] === '1' ? 15 : 31) && (chip !== 'nrf52832' || match[1] === '0'));
      if (!valid) errors.push(`Trackball ${trackball.index}: invalid ${chip} pin ${value}.`);
      reserve(trackball.side, value, `trackball ${trackball.index}`);
    });
    if (new Set(pins).size !== pins.length) errors.push(`Trackball ${trackball.index}: sensor pins must be distinct.`);
    const cpi = trackball.cpi ?? 1200;
    if (!Number.isInteger(cpi) || cpi < 200 || cpi > 3200 || cpi % 200 !== 0)
      errors.push(`Trackball ${trackball.index}: CPI must be 200–3200 in steps of 200.`);
  }
  return errors;
};
