import { FirmwareTarget, ProjectSettings } from '@/types/keyboard';
import { isQmkSourceExportSupported, isZmkSourceExportSupported } from '@/lib/mcu-presets';

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
