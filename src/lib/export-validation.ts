import { PhysicalKey, ProjectSettings } from '@/types/keyboard';
import { getDevelopmentBoardPins, getMcuPins, getZmkHardwareTarget } from './mcu-presets';
import { getFirmwareMatrixPosition, getQmkMatrixFromPins, isDirectPinMatrix } from './matrix-utils';

export type FirmwareExportTarget = 'qmk' | 'vial' | 'zmk' | 'rmk';
export type ExportValidationSeverity = 'error' | 'warning';

export interface ExportValidationIssue {
  severity: ExportValidationSeverity;
  code: string;
  message: string;
}

const targetLabel = (target: FirmwareExportTarget) => {
  if (target === 'qmk') return 'QMK/VIA';
  if (target === 'vial') return 'Vial';
  if (target === 'rmk') return 'RMK';
  return 'ZMK';
};

const hasPins = (pins: string[] | undefined) => (pins?.filter(Boolean).length ?? 0) > 0;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const hasConfiguredAdvancedCombos = (combos: ProjectSettings['combos'] = []) => (
  combos.some(combo => combo.inputs.some(input => input.action !== 'none') && combo.output.action !== 'none')
);

const getVisibleKeys = (settings: ProjectSettings, keys: PhysicalKey[]) => (
  keys.filter(key => !key.group || (settings.activeOptions[key.group] ?? 0) === key.option)
);

const normalizePinName = (pin: string | undefined) => (pin || '').trim().toUpperCase();

const getOverlappingMatrixPins = (settings: ProjectSettings) => {
  const rowPins = new Set((settings.pins.rows || []).map(normalizePinName).filter(Boolean));
  return (settings.pins.cols || [])
    .map(normalizePinName)
    .filter(pin => pin && rowPins.has(pin));
};

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

const getConfiguredEncoders = (settings: ProjectSettings) => {
  return settings.encoders || [];
};

const keyHasEncoder = (settings: ProjectSettings, key: PhysicalKey) => {
  if (key.encoderId && (settings.encoders || []).some(encoder => encoder.id === key.encoderId)) return true;
  return key.encoderIndex !== undefined;
};

const keyHasTrackball = (settings: ProjectSettings, key: PhysicalKey) => {
  if (key.trackballId && (settings.trackballs || []).some(trackball => trackball.id === key.trackballId)) return true;
  return key.trackballIndex !== undefined;
};

const isOptionalButtonKey = (settings: ProjectSettings, key: PhysicalKey) => (
  key.kind === 'encoder' ||
  key.kind === 'trackball' ||
  keyHasEncoder(settings, key) ||
  keyHasTrackball(settings, key)
);

const shouldValidateSwitchInput = (settings: ProjectSettings, key: PhysicalKey, directPins: boolean) => {
  if (!isOptionalButtonKey(settings, key)) return true;
  return directPins
    ? !!key.directPin?.trim()
    : key.row !== undefined && key.col !== undefined;
};

export const validateFirmwareExport = (
  settings: ProjectSettings,
  keys: PhysicalKey[],
  target: FirmwareExportTarget
) => {
  const issues: ExportValidationIssue[] = [];
  const label = targetLabel(target);
  const directPins = isDirectPinMatrix(settings);
  const usesActiveLayoutOptions = target === 'qmk' || target === 'vial' || target === 'rmk';
  const matrixKeys = usesActiveLayoutOptions ? getVisibleKeys(settings, keys) : keys;
  const switchInputKeys = matrixKeys.filter(key => shouldValidateSwitchInput(settings, key, directPins));

  if (!directPins && (!hasPins(settings.pins.rows) || !hasPins(settings.pins.cols))) {
    issues.push({
      severity: 'warning',
      code: 'matrix-pins-missing',
      message: `${label} firmware export has no row or column pin assignments. The generated source may fail to compile until pins are configured.`,
    });
  }

  const matrixPositions = switchInputKeys
    .map(key => getFirmwareMatrixPosition(settings, key, switchInputKeys))
    .filter((pos): pos is { row: number; col: number } => !!pos && pos.row >= 0 && pos.col >= 0);
  if (switchInputKeys.length > 0 && matrixPositions.length === 0) {
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

  const pinMatrix = directPins ? undefined : getQmkMatrixFromPins(settings.pins, settings.features.split);
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

  if (directPins) {
    const directPinKeys = switchInputKeys.filter(key => !key.decal);
    const missingDirectPinKeys = directPinKeys.filter(key => !key.directPin?.trim());
    if (missingDirectPinKeys.length > 0) {
      const visibleDirectPinKeys = getVisibleKeys(settings, keys)
        .filter(key => shouldValidateSwitchInput(settings, key, directPins) && !key.decal);
      const hiddenMissingDirectPins = missingDirectPinKeys.filter(key => !visibleDirectPinKeys.includes(key)).length;
      const zmkLayoutOptionHint = target === 'zmk' && hiddenMissingDirectPins > 0
        ? ` ZMK exports every layout-option key: ${visibleDirectPinKeys.length} key(s) are currently visible, while ${directPinKeys.length} key(s) are export targets. ${hiddenMissingDirectPins} unassigned key(s) are hidden by the selected layout options; switch those options to assign their pins.`
        : '';
      issues.push({
        severity: 'warning',
        code: 'direct-pins-missing',
        message: `${missingDirectPinKeys.length} key(s) have no direct pin assignment. The generated ${target === 'zmk' ? 'ZMK source will omit those switch inputs' : 'source will emit NO_PIN for those positions'}.${zmkLayoutOptionHint}`,
      });
    }
    pushInvalidPins(issues, settings, matrixKeys
      .filter(key => !!key.directPin)
      .map((key, index) => ({ label: `Direct key ${index + 1}`, value: key.directPin })));
  }

  const encoders = getConfiguredEncoders(settings);
  if (encoders.length > 0) {
    const missingEncoderPins = encoders.length === 0 || encoders.some(encoder => !encoder.pinA || !encoder.pinB);
    if (missingEncoderPins) {
      issues.push({
        severity: 'warning',
        code: 'encoder-pins-missing',
        message: 'Encoder is enabled, but encoder A/B pins are not fully assigned. The generated source may fail to compile until encoder pins are configured.',
      });
    }
    if (!keys.some(key => keyHasEncoder(settings, key))) {
      issues.push({
        severity: 'warning',
        code: 'encoder-layout-missing',
        message: 'Encoder is enabled, but no encoder is assigned in the layout. The generated source may not define any encoder instances.',
      });
    }
    const encoderPinLabels = encoders.flatMap((encoder, index) => [
      { label: `Encoder ${index} A`, value: encoder.pinA },
      { label: `Encoder ${index} B`, value: encoder.pinB },
    ]);
    pushInvalidPins(issues, settings, encoderPinLabels);
  }

  if (target === 'vial' && (settings.tapDances || []).length > 0) {
    issues.push({
      severity: 'warning',
      code: 'vial-tap-dance-source-not-emitted',
      message: 'Vial source export does not emit static project tap dance definitions. Configure tap dances through Vial dynamic tap dance after flashing.',
    });
  }

  if (target === 'rmk') {
    const overlappingPins = directPins ? [] : getOverlappingMatrixPins(settings);
    if (overlappingPins.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'rmk-bidirectional-matrix-not-represented',
        message: 'RMK TOML export cannot represent bidirectional matrix yet. Use Rust API or change wiring.',
      });
    }
    if (settings.features.split) {
      issues.push({
        severity: 'warning',
        code: 'rmk-split-export-experimental',
        message: 'RMK split source export currently emits a single keyboard.toml layout map. Verify split central/peripheral matrix sections before flashing.',
      });
    }
    if ((settings.macros || []).some(actions => actions.length > 0)) {
      issues.push({
        severity: 'warning',
        code: 'rmk-project-macros-not-emitted',
        message: 'RMK source export maps Macro(n) key assignments, but does not emit RMK macro definitions yet.',
      });
    }
    if (hasConfiguredAdvancedCombos(settings.combos || [])) {
      issues.push({
        severity: 'warning',
        code: 'rmk-combos-not-emitted',
        message: 'RMK source export does not emit project combo definitions yet.',
      });
    }
    if (settings.features.rgb || settings.features.rgbMatrix || settings.features.backlight) {
      issues.push({
        severity: 'warning',
        code: 'rmk-lighting-not-emitted',
        message: 'RMK source export does not emit lighting hardware configuration yet.',
      });
    }
    if ((settings.encoders || []).length > 0) {
      issues.push({
        severity: 'warning',
        code: 'rmk-encoders-not-emitted',
        message: 'RMK source export does not emit rotary encoder configuration yet.',
      });
    }
  }

  if (settings.features.rgb || settings.features.rgbMatrix) {
    if (!settings.pins.rgb) {
      issues.push({
        severity: 'warning',
        code: 'rgb-pin-missing',
        message: 'RGB is enabled, but the RGB data pin is not assigned. The generated source will use its fallback pin.',
      });
    }
    pushInvalidPins(issues, settings, [{ label: 'RGB data', value: settings.pins.rgb }]);
  }

  if (settings.features.backlight) {
    if (!settings.pins.backlight) {
      issues.push({
        severity: 'warning',
        code: 'backlight-pin-missing',
        message: 'Backlight is enabled, but the backlight pin is not assigned. The generated source will use its fallback pin.',
      });
    }
    pushInvalidPins(issues, settings, [{ label: 'Backlight', value: settings.pins.backlight }]);
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
      if (zmkSplitTransport === 'ble' && getZmkHardwareTarget(settings.hardware) !== 'nrf52840') {
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
    if (!directPins && target !== 'zmk' && !settings.pins.splitSerial) {
      issues.push({
        severity: 'warning',
        code: 'split-serial-missing',
        message: 'Split is enabled, but the serial transport pin is not assigned. The generated source will use its fallback pin.',
      });
    }
    const hasRightRows = hasPins(settings.pins.splitRows);
    const hasRightCols = hasPins(settings.pins.splitCols);
    if (!directPins) {
      if (!hasRightRows && !hasRightCols) {
        issues.push({
          severity: 'warning',
          code: 'split-matrix-pins-missing',
          message: 'Split is enabled, but right-side row/column pins are not assigned. The generated source will reuse the left-side matrix pins.',
        });
      } else if (!hasRightRows || !hasRightCols) {
        issues.push({
          severity: 'warning',
          code: 'split-matrix-pins-partial',
          message: 'Split is enabled, but only one right-side matrix axis is assigned. The generated source will use the configured right-side pins and reuse left-side pins for the blank axis.',
        });
      }
    }
    if (!directPins) {
      pushInvalidPins(issues, settings, [
        { label: 'Split serial', value: settings.pins.splitSerial },
        ...unique(settings.pins.splitRows || []).map((value, index) => ({ label: `Right row ${index + 1}`, value })),
        ...unique(settings.pins.splitCols || []).map((value, index) => ({ label: `Right column ${index + 1}`, value })),
      ]);
    }
  }

  if (!directPins) {
    pushInvalidPins(issues, settings, [
      ...unique(settings.pins.rows || []).map((value, index) => ({ label: `Row ${index + 1}`, value })),
      ...unique(settings.pins.cols || []).map((value, index) => ({ label: `Column ${index + 1}`, value })),
    ]);
  }

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
