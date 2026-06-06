import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getDevelopmentBoardPins, getMcuPins, getZmkTarget } from './mcu-presets';
import { getQmkMatrixFromPins, getQmkMatrixPosition } from './matrix-utils';

export type FirmwareExportTarget = 'qmk' | 'vial' | 'zmk';
export type ExportValidationSeverity = 'error' | 'warning';

export interface ExportValidationIssue {
  severity: ExportValidationSeverity;
  code: string;
  message: string;
}

const targetLabel = (target: FirmwareExportTarget) => {
  if (target === 'qmk') return 'QMK/VIA';
  if (target === 'vial') return 'Vial';
  return 'ZMK';
};

const hasPins = (pins: string[] | undefined) => (pins?.filter(Boolean).length ?? 0) > 0;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getAvailablePins = (settings: ProjectSettings) => {
  const controllerType = settings.hardware.controllerType || 'development_board';
  return controllerType === 'development_board'
    ? getDevelopmentBoardPins(settings.hardware.board, settings.hardware.mcu)
    : getMcuPins(settings.hardware.mcu);
};

const pinLabel = (settings: ProjectSettings) =>
  (settings.hardware.controllerType || 'development_board') === 'development_board'
    ? settings.hardware.board || settings.hardware.mcu || 'selected development board'
    : settings.hardware.mcu || 'selected MCU';

const pushInvalidPins = (
  issues: ExportValidationIssue[],
  settings: ProjectSettings,
  pins: Array<{ label: string; value?: string }>
) => {
  const availablePins = new Set(getAvailablePins(settings));
  pins.forEach(pin => {
    if (!pin.value || availablePins.has(pin.value)) return;
    issues.push({
      severity: 'warning',
      code: 'unknown-pin',
      message: `${pin.label} pin "${pin.value}" is not in the pin list for ${pinLabel(settings)}.`,
    });
  });
};

export const validateFirmwareExport = (
  settings: ProjectSettings,
  keys: PhysicalKey[],
  target: FirmwareExportTarget
) => {
  const issues: ExportValidationIssue[] = [];
  const label = targetLabel(target);

  if (!hasPins(settings.pins.rows) || !hasPins(settings.pins.cols)) {
    issues.push({
      severity: 'warning',
      code: 'matrix-pins-missing',
      message: `${label} firmware export has no row or column pin assignments. The generated source may fail to compile until pins are configured.`,
    });
  }

  const matrixPositions = keys
    .map(key => getQmkMatrixPosition(settings, key, keys))
    .filter((pos): pos is { row: number; col: number } => !!pos && pos.row >= 0 && pos.col >= 0);
  if (matrixPositions.length === 0) {
    issues.push({
      severity: 'error',
      code: 'matrix-keys-missing',
      message: `${label} firmware export needs at least one key with a valid matrix row and column.`,
    });
  }

  const positionCounts = new Map<string, number>();
  matrixPositions.forEach(pos => {
    const key = `${pos.row}:${pos.col}`;
    positionCounts.set(key, (positionCounts.get(key) || 0) + 1);
  });
  const duplicatePositions = [...positionCounts.entries()].filter(([, count]) => count > 1);
  if (duplicatePositions.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'matrix-position-duplicates',
      message: `${duplicatePositions.length} matrix position(s) are assigned to multiple keys. Only the first key at each position is exported.`,
    });
  }

  const pinMatrix = getQmkMatrixFromPins(settings.pins, settings.features.split);
  if (pinMatrix) {
    const outOfBoundsCount = matrixPositions.filter(pos => pos.row >= pinMatrix.rows || pos.col >= pinMatrix.cols).length;
    if (outOfBoundsCount > 0) {
      issues.push({
        severity: 'warning',
        code: 'matrix-position-out-of-pin-range',
        message: `${outOfBoundsCount} key(s) use matrix positions outside the current row/column pin dimensions.`,
      });
    }
  }

  if (settings.features.encoder) {
    if (!settings.pins.encoderA || !settings.pins.encoderB) {
      issues.push({
        severity: 'warning',
        code: 'encoder-pins-missing',
        message: 'Encoder is enabled, but encoder A/B pins are not fully assigned. Encoder output will still be generated with fallback pins.',
      });
    }
    pushInvalidPins(issues, settings, [
      { label: 'Encoder A', value: settings.pins.encoderA },
      { label: 'Encoder B', value: settings.pins.encoderB },
    ]);
  }

  if (settings.features.rgb) {
    if (!settings.pins.rgb) {
      issues.push({
        severity: 'warning',
        code: 'rgb-pin-missing',
        message: 'RGB is enabled, but the RGB data pin is not assigned. The generated source will use its fallback pin.',
      });
    }
    pushInvalidPins(issues, settings, [{ label: 'RGB data', value: settings.pins.rgb }]);
  }

  if (settings.features.oled) {
    if (!settings.pins.sda || !settings.pins.scl) {
      issues.push({
        severity: 'warning',
        code: 'oled-pins-missing',
        message: 'OLED is enabled, but SDA/SCL pins are not fully assigned.',
      });
    }
    pushInvalidPins(issues, settings, [
      { label: 'OLED SDA', value: settings.pins.sda },
      { label: 'OLED SCL', value: settings.pins.scl },
    ]);
  }

  if (settings.features.split) {
    if (target === 'zmk') {
      const zmkSplitTransport = settings.zmk?.splitTransport || 'ble';
      if (zmkSplitTransport === 'ble' && getZmkTarget(settings.hardware.mcu) !== 'nrf52840') {
        issues.push({
          severity: 'error',
          code: 'zmk-split-ble-target-required',
          message: 'ZMK split source export currently requires an nRF52840 BLE-capable development board.',
        });
      }
      if (zmkSplitTransport === 'wired' && !settings.zmk?.wiredSplitDevice?.trim()) {
        issues.push({
          severity: 'warning',
          code: 'zmk-wired-split-device-missing',
          message: 'ZMK wired split is enabled, but no UART device is configured. The generated source will use &pro_micro_serial.',
        });
      }
    }
    if (target !== 'zmk' && !settings.pins.splitSerial) {
      issues.push({
        severity: 'warning',
        code: 'split-serial-missing',
        message: 'Split is enabled, but the serial transport pin is not assigned. The generated source will use its fallback pin.',
      });
    }
    if (!hasPins(settings.pins.splitRows) || !hasPins(settings.pins.splitCols)) {
      issues.push({
        severity: 'warning',
        code: 'split-matrix-pins-missing',
        message: 'Split is enabled, but right-side row/column pins are not fully assigned. The generated source will reuse the left-side matrix pins where needed.',
      });
    }
    pushInvalidPins(issues, settings, [
      { label: 'Split serial', value: settings.pins.splitSerial },
      ...unique(settings.pins.splitRows || []).map((value, index) => ({ label: `Right row ${index + 1}`, value })),
      ...unique(settings.pins.splitCols || []).map((value, index) => ({ label: `Right column ${index + 1}`, value })),
    ]);
  }

  pushInvalidPins(issues, settings, [
    ...unique(settings.pins.rows || []).map((value, index) => ({ label: `Row ${index + 1}`, value })),
    ...unique(settings.pins.cols || []).map((value, index) => ({ label: `Column ${index + 1}`, value })),
  ]);

  return issues;
};

export const formatExportValidationIssues = (
  target: FirmwareExportTarget,
  issues: ExportValidationIssue[]
) => {
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  const lines = [
    `${targetLabel(target)} export validation found ${errors.length} error(s) and ${warnings.length} warning(s).`,
    '',
    ...issues.map(issue => `${issue.severity === 'error' ? 'Error' : 'Warning'}: ${issue.message}`),
  ];
  return lines.join('\n');
};
