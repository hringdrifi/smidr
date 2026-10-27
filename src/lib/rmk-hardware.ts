import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { DEVELOPMENT_BOARD_OPTIONS, getMcuPreset } from './mcu-presets';
import { getDirectMatrixSide, isDirectPinMatrix, resolveDirectPin } from './matrix-utils';
import { getSplitCommunication } from './split-communication';

export type RmkExportFormat = 'toml' | 'rust';
type RmkHardware = { controllerType?: 'mcu' | 'development_board'; mcu?: string; board?: string };

const RMK_BOARD_CHIPS: Record<string, string> = {
  blackpill_f401: 'stm32f401', blackpill_f411: 'stm32f411', bluepill: 'stm32f103', proton_c: 'stm32f303',
  elite_pi: 'rp2040', helios: 'rp2040', kb2040: 'rp2040', michi: 'rp2040',
  promicro_rp2040: 'rp2040', svlinky: 'rp2040',
  blok: 'nrf52840', xiao_ble: 'nrf52840', nrfmicro_nrf52840_flipped: 'nrf52840',
  nrfmicro_nrf52840: 'nrf52840', bluemicro840: 'nrf52840', puchi_ble: 'nrf52840',
  nice_nano: 'nrf52840', mikoto: 'nrf52840', nrfmicro_nrf52833: 'nrf52833',
};

export const getRmkChipForHardware = (hardware: RmkHardware) => {
  if (hardware.controllerType !== 'mcu' && hardware.board) {
    const board = DEVELOPMENT_BOARD_OPTIONS.find(option =>
      option.value === hardware.board || option.zmkBoard === hardware.board || option.qmkBoard === hardware.board);
    return board ? RMK_BOARD_CHIPS[board.value] || '' : '';
  }
  const mcu = String(hardware.mcu || '').toLowerCase();
  return mcu === 'hy0020' ? 'nrf52832' : mcu;
};

export const getRmkChip = (settings: ProjectSettings) => getRmkChipForHardware(settings.hardware);

export const isRmkExportSupported = (hardware: RmkHardware, format: RmkExportFormat = 'toml') => {
  const chip = getRmkChipForHardware(hardware);
  if (format === 'rust') return ['rp2040', 'nrf52840', 'nrf52833'].includes(chip);
  return ['rp2040', 'nrf52840', 'nrf52833', 'nrf52832'].includes(chip)
    || (chip.startsWith('stm32') && !!getMcuPreset(chip));
};

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
  if (!isRmkExportSupported(settings.hardware, format))
    errors.push(format === 'rust'
      ? 'RMK Rust API export supports RP2040, nRF52840 and nRF52833.'
      : `RMK 0.9 TOML export does not support the selected MCU or development board (${settings.hardware.board || settings.hardware.mcu}).`);
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
  if (trackballs.length && !['rp2040', 'nrf52840', 'nrf52833', 'nrf52832'].includes(chip))
    errors.push('RMK PMW3610 export requires RP2040 or nRF52.');
  for (const trackball of trackballs) {
    if (trackball.index > 254) errors.push('RMK supports trackball device IDs 0–254 (255 matches all devices).');
    if (![trackball.sclk, trackball.sdio, trackball.cs].every(pin => pin?.trim()))
      errors.push(`Trackball ${trackball.index}: assign SCLK, SDIO and CS before exporting RMK.`);
    const pins = [trackball.sclk, trackball.sdio, trackball.cs, trackball.motion].filter(pin => pin?.trim()).map(pin => normalizeRmkPin(pin));
    pins.forEach(value => {
      const match = chip === 'rp2040' ? value.match(/^PIN_(\d+)$/) : value.match(/^P([01])_(\d{2})$/);
      const nrfPort1Max = chip === 'nrf52840' ? 15 : chip === 'nrf52833' ? 9 : -1;
      const valid = match && (chip === 'rp2040'
        ? Number(match[1]) <= 29
        : Number(match[2]) <= (match[1] === '1' ? nrfPort1Max : 31));
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
