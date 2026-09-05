import { FirmwareTarget, ProjectSettings } from '@/types/keyboard';
import { isQmkSourceExportSupported, isZmkSourceExportSupported } from '@/lib/mcu-presets';
import { getSplitCommunication } from './split-communication';

export const FIRMWARE_TARGETS: FirmwareTarget[] = ['qmk', 'vial', 'zmk', 'rmk'];

export const getFirmwareTargetLabel = (target: FirmwareTarget) => {
  if (target === 'qmk') return 'QMK/VIA';
  if (target === 'vial') return 'Vial';
  if (target === 'zmk') return 'ZMK';
  return 'RMK';
};

export const isFirmwareTargetSupported = (
  target: FirmwareTarget,
  hardware: ProjectSettings['hardware'],
) => {
  if (target === 'qmk' || target === 'vial') return isQmkSourceExportSupported(hardware);
  if (target === 'zmk') return isZmkSourceExportSupported(hardware);
  return true;
};

/** Optional values use exporter defaults; hardware compatibility belongs to other steps. */
export const isFirmwareDetailSettingsComplete = (target: FirmwareTarget, settings: ProjectSettings): boolean => {
  const validCoordinate = (value: number | undefined) => value === undefined
    || (Number.isInteger(value) && value >= 0 && value <= 255);
  const validPosition = (position?: { row?: number; col?: number }) =>
    validCoordinate(position?.row) && validCoordinate(position?.col);

  if (target === 'qmk' || target === 'vial') {
    if (settings.qmk?.bootmagic?.enabled !== false && !validPosition(settings.qmk?.bootmagic)) return false;
    if (target === 'vial') {
      if (settings.vialUid && !/^(?:0x)?[0-9a-f]{16}$/i.test(settings.vialUid)) return false;
      if (!validPosition(settings.vial?.unlockCombo?.key1) || !validPosition(settings.vial?.unlockCombo?.key2)) return false;
    }
  }
  if (target === 'zmk' && settings.features.split && !settings.hardware.splitCommunication
    && getSplitCommunication(settings).transport === 'wired') {
    const device = settings.zmk?.wiredSplitDevice?.trim();
    if (device && !/^&[a-z_][a-z0-9_]*$/i.test(device)) return false;
  }
  return true;
};
