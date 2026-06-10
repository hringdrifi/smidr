'use client';

import React from 'react';
import { Hash, Trash2, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getMatrixFromPins, useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getDefaultDevelopmentBoard,
  getDevelopmentBoardLabel,
  getDevelopmentBoardPins,
  getMcuPins,
} from '@/lib/mcu-presets';
import { AvailablePinPool } from './AvailablePinPool';
import { getLocalMatrixPosition, inferMatrixSideFromGeometry, MatrixSide } from '@/lib/matrix-utils';
import { PhysicalKey, ProjectSettings } from '@/types/keyboard';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PinTarget = 'row' | 'col' | 'splitRow' | 'splitCol' | 'feature';

const getEncoderAssignedPins = (
  settings: ProjectSettings,
  keys: PhysicalKey[],
  side?: MatrixSide
) => {
  const pins = new Set<string>();
  keys.forEach(key => {
    if (!key.encoderId) return;
    if (settings.features.split && side) {
      const encoderSide = getLocalMatrixPosition(settings, key, keys)?.side || key.matrixSide || inferMatrixSideFromGeometry(key, keys);
      if (encoderSide !== side) return;
    }
    const encoder = (settings.encoders || []).find(item => item.id === key.encoderId);
    if (!encoder) return;
    if (encoder.pinA) pins.add(encoder.pinA);
    if (encoder.pinB) pins.add(encoder.pinB);
  });
  return pins;
};

const InteractivePinSlot = ({
  label,
  value,
  isFocused,
  onFocus,
  onClear
}: {
  label: string;
  value: string;
  isFocused: boolean;
  onFocus: () => void;
  onClear: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{label}</label>
      <div
        onClick={onFocus}
        className={cn(
          "w-full h-8 flex items-center justify-between bg-[var(--bg-app)] border rounded px-2 text-xs font-mono cursor-pointer transition-all duration-200",
          isFocused
            ? "border-amber-500 ring-1 ring-amber-500 text-amber-500"
            : value
            ? "border-[var(--border-main)] text-[var(--text-highlight)] hover:border-amber-500/50"
            : "border-dashed border-[var(--border-main)] text-[var(--text-muted)] hover:border-amber-500/50 hover:text-[var(--text-main)]"
        )}
      >
        <span className="truncate">{value || t('hardware.assignPin')}</span>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-0.5 rounded hover:bg-zinc-750 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
};

const PinTagInput = ({
  type,
  pins,
  isActive,
  isSplitKeyboard,
  onFocus,
  onUpdatePins
}: {
  type: 'row' | 'col' | 'splitRow' | 'splitCol';
  pins: string[];
  isActive: boolean;
  isSplitKeyboard: boolean;
  onFocus: () => void;
  onUpdatePins: (newPins: string[]) => void;
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = React.useState('');
  const [draggedIdx, setDraggedIdx] = React.useState<number | null>(null);
  const label = type === 'row'
    ? (isSplitKeyboard ? t('hardware.leftRowPins') : t('hardware.rowPins'))
    : type === 'col'
    ? (isSplitKeyboard ? t('hardware.leftColPins') : t('hardware.colPins'))
    : type === 'splitRow'
    ? t('hardware.rightRowPins')
    : t('hardware.rightColPins');

  const handleAddFromText = (text: string) => {
    if (!text.trim()) return;
    const parts = text.split(/[\s,]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
    onUpdatePins([...pins, ...parts]);
    setInputValue('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(' ') || val.includes(',')) {
      handleAddFromText(val);
    } else {
      setInputValue(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFromText(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && pins.length > 0) {
      onUpdatePins(pins.slice(0, -1));
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    const newPins = [...pins];
    const [movedPin] = newPins.splice(draggedIdx, 1);
    newPins.splice(targetIndex, 0, movedPin);

    onUpdatePins(newPins);
    setDraggedIdx(null);
  };

  return (
    <div className="space-y-1 w-full">
      <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase font-bold tracking-wider">
        {label}
      </label>
      <div
        onClick={onFocus}
        className={cn(
          "w-full min-h-12 flex flex-wrap gap-1.5 items-center bg-[var(--bg-app)] border rounded-lg p-2 cursor-text transition-all duration-200",
          isActive
            ? "border-amber-500 ring-1 ring-amber-500 text-amber-500"
            : "border-[var(--border-main)] hover:border-amber-500/30"
        )}
      >
        {pins.map((pinName, index) => {
          const isDragging = draggedIdx === index;
          return (
            <div
              key={pinName + '-' + index}
              draggable
              onDragStart={(e) => {
                setDraggedIdx(index);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => setDraggedIdx(null)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-main)] text-xs font-mono select-none cursor-grab active:cursor-grabbing transition-all",
                isDragging ? "opacity-35 border-dashed border-amber-500/50" : "hover:border-amber-500/50 text-[var(--text-highlight)]"
              )}
            >
              <span className="text-[10px] text-amber-500 font-bold">{index}:</span>
              <span className="text-[var(--text-highlight)]">{pinName}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdatePins(pins.filter((_, idx) => idx !== index));
                }}
                className="p-0.5 rounded hover:bg-zinc-700/50 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={() => handleAddFromText(inputValue)}
          onFocus={onFocus}
          placeholder={pins.length === 0 ? t('hardware.typeOrClickPins') : t('hardware.addPin')}
          className="flex-1 min-w-[100px] bg-transparent outline-none border-none text-xs text-[var(--text-highlight)] font-mono py-0.5"
        />
      </div>
    </div>
  );
};

export const MatrixPinInspectorPanel = () => {
  const { settings, updateSettings, setPin, keys, batchUpdateKeys } = useKeyboardStore();
  const { t } = useTranslation();
  const format = (path: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      t(path)
    );

  const [activeBox, setActiveBox] = React.useState<PinTarget | null>(null);
  const [focusedFeature, setFocusedFeature] = React.useState<string | null>(null);
  const [preventDuplicates, setPreventDuplicates] = React.useState<boolean>(true);
  const [customPinText, setCustomPinText] = React.useState<string>('');

  const selectedMcu = settings.hardware.mcu || 'RP2040';
  const controllerType = settings.hardware.controllerType || 'development_board';
  const selectedDevelopmentBoard = settings.hardware.board || getDefaultDevelopmentBoard(selectedMcu);
  const pinPoolLabel = controllerType === 'development_board'
    ? getDevelopmentBoardLabel(selectedDevelopmentBoard)
    : selectedMcu.toUpperCase();
  const pinPool = controllerType === 'development_board'
    ? getDevelopmentBoardPins(selectedDevelopmentBoard, selectedMcu)
    : getMcuPins(selectedMcu);
  const effectiveMatrix = getMatrixFromPins(settings.pins, settings.features.split) || settings.matrix;
  const wiringMode = settings.matrix?.wiring || 'matrix';

  const getPinGroupLabel = (box: PinTarget | null, feature: string | null) => {
    if (box === 'row') return settings.features.split ? t('hardware.leftRowPins') : t('hardware.rowPins');
    if (box === 'col') return settings.features.split ? t('hardware.leftColPins') : t('hardware.colPins');
    if (box === 'splitRow') return t('hardware.rightRowPins');
    if (box === 'splitCol') return t('hardware.rightColPins');
    return feature || '';
  };

  const getAssignedPins = () => {
    const pins = new Set<string>();
    if (activeBox === 'splitRow' || activeBox === 'splitCol') {
      settings.pins.splitRows?.forEach(p => p && pins.add(p));
      settings.pins.splitCols?.forEach(p => p && pins.add(p));
      getEncoderAssignedPins(settings, keys, 'right').forEach(pin => pins.add(pin));
      return pins;
    }

    settings.pins.rows.forEach(p => p && pins.add(p));
    settings.pins.cols.forEach(p => p && pins.add(p));
    keys.forEach(key => key.directPin && pins.add(key.directPin));
    if (settings.pins.rgb) pins.add(settings.pins.rgb);
    if (settings.pins.backlight) pins.add(settings.pins.backlight);
    if (settings.pins.sda) pins.add(settings.pins.sda);
    if (settings.pins.scl) pins.add(settings.pins.scl);
    getEncoderAssignedPins(settings, keys, settings.features.split && (activeBox === 'row' || activeBox === 'col') ? 'left' : undefined)
      .forEach(pin => pins.add(pin));
    if (settings.pins.splitSerial) pins.add(settings.pins.splitSerial);
    return pins;
  };

  const assignedPins = getAssignedPins();
  const updateWiringMode = (mode: 'matrix' | 'direct') => {
    if (mode === wiringMode) return;

    if (mode === 'direct') {
      const matrixKeys = keys.filter(key => key.row !== undefined || key.col !== undefined);
      if (matrixKeys.length > 0 && !window.confirm(format('matrix.confirmSwitchToDirect', { count: matrixKeys.length }))) {
        return;
      }
      if (matrixKeys.length > 0) {
        batchUpdateKeys(matrixKeys.map(key => key.id!), { row: undefined, col: undefined });
      }
    } else {
      const directKeys = keys.filter(key => !!key.directPin);
      if (directKeys.length > 0 && !window.confirm(format('matrix.confirmSwitchToMatrix', { count: directKeys.length }))) {
        return;
      }
      if (directKeys.length > 0) {
        batchUpdateKeys(directKeys.map(key => key.id!), { directPin: undefined });
      }
    }

    updateSettings({ matrix: { ...settings.matrix, wiring: mode } });
  };
  const updateDiodeDirection = (diodeDirection: 'COL2ROW' | 'ROW2COL') => {
    updateSettings({ hardware: { ...settings.hardware, diodeDirection } });
  };

  const handleAssignPin = (pinName: string) => {
    const applyPinList = (key: 'rows' | 'cols' | 'splitRows' | 'splitCols', currentPins: string[] = []) => {
      if (preventDuplicates && currentPins.includes(pinName)) return;
      if (preventDuplicates && assignedPins.has(pinName) && !currentPins.includes(pinName)) return;
      updateSettings({ pins: { ...settings.pins, [key]: [...currentPins, pinName] } });
    };

    if (activeBox === 'row') applyPinList('rows', settings.pins.rows);
    if (activeBox === 'col') applyPinList('cols', settings.pins.cols);
    if (activeBox === 'splitRow') applyPinList('splitRows', settings.pins.splitRows || []);
    if (activeBox === 'splitCol') applyPinList('splitCols', settings.pins.splitCols || []);
    if (activeBox === 'feature' && focusedFeature) {
      if (preventDuplicates && assignedPins.has(pinName) && (settings.pins as any)[focusedFeature] !== pinName) return;
      setPin('feature', focusedFeature, pinName);
    }
  };

  const handleClearAllPins = () => {
    updateSettings({
      pins: {
        rows: [],
        cols: [],
        splitRows: [],
        splitCols: [],
        rgb: '',
        backlight: '',
        sda: '',
        scl: '',
        splitSerial: ''
      }
    });
    setActiveBox(null);
    setFocusedFeature(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-panel)]">
      <div className="mx-4 mt-4 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={15} className="text-amber-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">{t('hardware.pins')}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              <span className="font-mono text-[var(--text-highlight)]">{effectiveMatrix.rows} x {effectiveMatrix.cols}</span>
              <span className="ml-1">{format('hardware.keyCount', { count: effectiveMatrix.rows * effectiveMatrix.cols })}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClearAllPins}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition-all"
          title={t('hardware.clearAllPins')}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-[var(--bg-app)]/20 p-4 custom-scrollbar">
      <section className="space-y-3">
        <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('matrix.wiringMode')}</h3>
        <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
          {([
            ['matrix', t('matrix.wiringMatrix')],
            ['direct', t('matrix.wiringDirect')],
          ] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateWiringMode(mode)}
              className={cn(
                "h-8 rounded text-[10px] font-bold uppercase transition-all",
                wiringMode === mode
                  ? "bg-amber-500 text-zinc-950"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {wiringMode === 'matrix' && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.diodeDir')}</label>
            <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
              {(['COL2ROW', 'ROW2COL'] as const).map(dir => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => updateDiodeDirection(dir)}
                  className={cn(
                    "h-8 rounded text-[10px] font-bold transition-all",
                    settings.hardware.diodeDirection === dir
                      ? "bg-amber-500 text-zinc-950"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {wiringMode === 'direct' ? (
        <section className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border-main)] text-center text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
          {t('matrix.directPinPrompt')}
        </section>
      ) : (
      <section className="space-y-3">
        {settings.features.split ? (
          <>
            <PinTagInput
              type="row"
              pins={settings.pins.rows}
              isActive={activeBox === 'row'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('row');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, rows: newPins } })}
            />
            <PinTagInput
              type="col"
              pins={settings.pins.cols}
              isActive={activeBox === 'col'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('col');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, cols: newPins } })}
            />
            <PinTagInput
              type="splitRow"
              pins={settings.pins.splitRows || []}
              isActive={activeBox === 'splitRow'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('splitRow');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, splitRows: newPins } })}
            />
            <PinTagInput
              type="splitCol"
              pins={settings.pins.splitCols || []}
              isActive={activeBox === 'splitCol'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('splitCol');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, splitCols: newPins } })}
            />
          </>
        ) : (
          <>
            <PinTagInput
              type="row"
              pins={settings.pins.rows}
              isActive={activeBox === 'row'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('row');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, rows: newPins } })}
            />
            <PinTagInput
              type="col"
              pins={settings.pins.cols}
              isActive={activeBox === 'col'}
              isSplitKeyboard={settings.features.split}
              onFocus={() => {
                setActiveBox('col');
                setFocusedFeature(null);
              }}
              onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, cols: newPins } })}
            />
          </>
        )}
      </section>
      )}

      {((settings.features.rgb || settings.features.rgbMatrix || settings.features.backlight) || settings.features.oled || settings.features.split) && (
        <section className="space-y-3 border-t border-[var(--border-main)] pt-4">
          <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('hardware.specialPins')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {(settings.features.rgb || settings.features.rgbMatrix) && (
              <InteractivePinSlot
                label={t('hardware.rgbData')}
                value={settings.pins.rgb || ''}
                isFocused={activeBox === 'feature' && focusedFeature === 'rgb'}
                onFocus={() => {
                  setActiveBox('feature');
                  setFocusedFeature('rgb');
                }}
                onClear={() => setPin('feature', 'rgb', '')}
              />
            )}
            {settings.features.backlight && (
              <InteractivePinSlot
                label={t('hardware.backlightPin')}
                value={settings.pins.backlight || ''}
                isFocused={activeBox === 'feature' && focusedFeature === 'backlight'}
                onFocus={() => {
                  setActiveBox('feature');
                  setFocusedFeature('backlight');
                }}
                onClear={() => setPin('feature', 'backlight', '')}
              />
            )}
            {settings.features.oled && (
              <>
                <InteractivePinSlot
                  label={t('hardware.i2cSda')}
                  value={settings.pins.sda || ''}
                  isFocused={activeBox === 'feature' && focusedFeature === 'sda'}
                  onFocus={() => {
                    setActiveBox('feature');
                    setFocusedFeature('sda');
                  }}
                  onClear={() => setPin('feature', 'sda', '')}
                />
                <InteractivePinSlot
                  label={t('hardware.i2cScl')}
                  value={settings.pins.scl || ''}
                  isFocused={activeBox === 'feature' && focusedFeature === 'scl'}
                  onFocus={() => {
                    setActiveBox('feature');
                    setFocusedFeature('scl');
                  }}
                  onClear={() => setPin('feature', 'scl', '')}
                />
              </>
            )}
            {settings.features.split && (
              <InteractivePinSlot
                label={t('hardware.splitSerial')}
                value={settings.pins.splitSerial || ''}
                isFocused={activeBox === 'feature' && focusedFeature === 'splitSerial'}
                onFocus={() => {
                  setActiveBox('feature');
                  setFocusedFeature('splitSerial');
                }}
                onClear={() => setPin('feature', 'splitSerial', '')}
              />
            )}
          </div>
        </section>
      )}

      </div>

      <AvailablePinPool
        title={format('hardware.availablePinsPool', { label: pinPoolLabel })}
        activeLabel={activeBox ? getPinGroupLabel(activeBox, focusedFeature) : null}
        pins={pinPool}
        assignedPins={assignedPins}
        preventDuplicates={preventDuplicates}
        onPreventDuplicatesChange={setPreventDuplicates}
        onAssignPin={handleAssignPin}
        isCurrentPin={(pinName) => (
          (activeBox === 'row' && settings.pins.rows.includes(pinName)) ||
          (activeBox === 'col' && settings.pins.cols.includes(pinName)) ||
          (activeBox === 'splitRow' && (settings.pins.splitRows || []).includes(pinName)) ||
          (activeBox === 'splitCol' && (settings.pins.splitCols || []).includes(pinName)) ||
          (activeBox === 'feature' && !!focusedFeature && (settings.pins as any)[focusedFeature] === pinName)
        )}
        isActive={!!activeBox}
        isListTarget={activeBox === 'row' || activeBox === 'col' || activeBox === 'splitRow' || activeBox === 'splitCol'}
        customPinText={customPinText}
        onCustomPinTextChange={(value) => setCustomPinText(value.toUpperCase())}
        showCustomPinInput
        pinListClassName="max-h-36 p-2"
      />
    </div>
  );
};

export const MatrixPinSettingsPanel = () => {
  const { settings, updateSettings, setPin, keys, batchUpdateKeys } = useKeyboardStore();
  const { t } = useTranslation();
  const format = (path: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      t(path)
    );

  const [activeBox, setActiveBox] = React.useState<PinTarget | null>(null);
  const [focusedFeature, setFocusedFeature] = React.useState<string | null>(null);
  const [preventDuplicates, setPreventDuplicates] = React.useState<boolean>(true);
  const [customPinText, setCustomPinText] = React.useState<string>('');

  const selectedMcu = settings.hardware.mcu || 'RP2040';
  const controllerType = settings.hardware.controllerType || 'development_board';
  const selectedDevelopmentBoard = settings.hardware.board || getDefaultDevelopmentBoard(selectedMcu);
  const pinPoolLabel = controllerType === 'development_board'
    ? getDevelopmentBoardLabel(selectedDevelopmentBoard)
    : selectedMcu.toUpperCase();
  const pinPool = controllerType === 'development_board'
    ? getDevelopmentBoardPins(selectedDevelopmentBoard, selectedMcu)
    : getMcuPins(selectedMcu);
  const effectiveMatrix = getMatrixFromPins(settings.pins, settings.features.split) || settings.matrix;
  const wiringMode = settings.matrix?.wiring || 'matrix';

  const getPinGroupLabel = (box: PinTarget | null, feature: string | null) => {
    if (box === 'row') return settings.features.split ? t('hardware.leftRowPins') : t('hardware.rowPins');
    if (box === 'col') return settings.features.split ? t('hardware.leftColPins') : t('hardware.colPins');
    if (box === 'splitRow') return t('hardware.rightRowPins');
    if (box === 'splitCol') return t('hardware.rightColPins');
    return feature || '';
  };

  const getAssignedPins = () => {
    const pins = new Set<string>();
    if (activeBox === 'splitRow' || activeBox === 'splitCol') {
      settings.pins.splitRows?.forEach(p => p && pins.add(p));
      settings.pins.splitCols?.forEach(p => p && pins.add(p));
      getEncoderAssignedPins(settings, keys, 'right').forEach(pin => pins.add(pin));
      return pins;
    }

    settings.pins.rows.forEach(p => p && pins.add(p));
    settings.pins.cols.forEach(p => p && pins.add(p));
    keys.forEach(key => key.directPin && pins.add(key.directPin));
    if (settings.pins.rgb) pins.add(settings.pins.rgb);
    if (settings.pins.backlight) pins.add(settings.pins.backlight);
    if (settings.pins.sda) pins.add(settings.pins.sda);
    if (settings.pins.scl) pins.add(settings.pins.scl);
    getEncoderAssignedPins(settings, keys, settings.features.split && (activeBox === 'row' || activeBox === 'col') ? 'left' : undefined)
      .forEach(pin => pins.add(pin));
    if (settings.pins.splitSerial) pins.add(settings.pins.splitSerial);
    return pins;
  };

  const assignedPins = getAssignedPins();
  const updateWiringMode = (mode: 'matrix' | 'direct') => {
    if (mode === wiringMode) return;

    if (mode === 'direct') {
      const matrixKeys = keys.filter(key => key.row !== undefined || key.col !== undefined);
      if (matrixKeys.length > 0 && !window.confirm(format('matrix.confirmSwitchToDirect', { count: matrixKeys.length }))) {
        return;
      }
      if (matrixKeys.length > 0) {
        batchUpdateKeys(matrixKeys.map(key => key.id!), { row: undefined, col: undefined });
      }
    } else {
      const directKeys = keys.filter(key => !!key.directPin);
      if (directKeys.length > 0 && !window.confirm(format('matrix.confirmSwitchToMatrix', { count: directKeys.length }))) {
        return;
      }
      if (directKeys.length > 0) {
        batchUpdateKeys(directKeys.map(key => key.id!), { directPin: undefined });
      }
    }

    updateSettings({ matrix: { ...settings.matrix, wiring: mode } });
  };
  const updateDiodeDirection = (diodeDirection: 'COL2ROW' | 'ROW2COL') => {
    updateSettings({ hardware: { ...settings.hardware, diodeDirection } });
  };

  const handleAssignPin = (pinName: string) => {
    const applyPinList = (key: 'rows' | 'cols' | 'splitRows' | 'splitCols', currentPins: string[] = []) => {
      if (preventDuplicates && currentPins.includes(pinName)) return;
      if (preventDuplicates && assignedPins.has(pinName) && !currentPins.includes(pinName)) return;
      updateSettings({ pins: { ...settings.pins, [key]: [...currentPins, pinName] } });
    };

    if (activeBox === 'row') applyPinList('rows', settings.pins.rows);
    if (activeBox === 'col') applyPinList('cols', settings.pins.cols);
    if (activeBox === 'splitRow') applyPinList('splitRows', settings.pins.splitRows || []);
    if (activeBox === 'splitCol') applyPinList('splitCols', settings.pins.splitCols || []);
    if (activeBox === 'feature' && focusedFeature) {
      if (preventDuplicates && assignedPins.has(pinName) && (settings.pins as any)[focusedFeature] !== pinName) return;
      setPin('feature', focusedFeature, pinName);
    }
  };

  const handleClearAllPins = () => {
    updateSettings({
      pins: {
        rows: [],
        cols: [],
        splitRows: [],
        splitCols: [],
        rgb: '',
        backlight: '',
        sda: '',
        scl: '',
        splitSerial: ''
      }
    });
    setActiveBox(null);
    setFocusedFeature(null);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200">
      <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
          <Hash size={16} className="text-amber-500" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('hardware.pins')}</span>
        </div>
        <div className="ml-4 flex items-center gap-2 text-xs text-[var(--text-highlight)] font-mono font-bold">
          <span>{effectiveMatrix.rows}</span>
          <span className="text-[var(--text-dim)] font-sans font-normal">x</span>
          <span>{effectiveMatrix.cols}</span>
          <span className="text-[10px] text-[var(--text-muted)] font-sans font-normal">
            {format('hardware.keyCount', { count: effectiveMatrix.rows * effectiveMatrix.cols })}
          </span>
        </div>
        <div className="ml-4 hidden min-w-0 flex-1 text-[10px] text-[var(--text-muted)] md:block">
          {t('hardware.pinAssignHint')}
        </div>
        <button
          type="button"
          onClick={handleClearAllPins}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:border-red-500/40 text-[9px] font-bold cursor-pointer transition-all active:scale-95"
        >
          <Trash2 size={10} />
          <span>{t('hardware.clearAllPins')}</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto custom-scrollbar bg-[var(--bg-app)]/20">
        <div className="min-w-[820px] p-4">
          <div className="mb-4 max-w-[540px] space-y-3">
            <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('matrix.wiringMode')}</h3>
            <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
              {([
                ['matrix', t('matrix.wiringMatrix')],
                ['direct', t('matrix.wiringDirect')],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateWiringMode(mode)}
                  className={cn(
                    "h-8 rounded text-[10px] font-bold uppercase transition-all",
                    wiringMode === mode
                      ? "bg-amber-500 text-zinc-950"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {wiringMode === 'matrix' && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.diodeDir')}</label>
                <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
                  {(['COL2ROW', 'ROW2COL'] as const).map(dir => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => updateDiodeDirection(dir)}
                      className={cn(
                        "h-8 rounded text-[10px] font-bold transition-all",
                        settings.hardware.diodeDirection === dir
                          ? "bg-amber-500 text-zinc-950"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      )}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-[minmax(540px,1fr)_280px] gap-4">
              {wiringMode === 'direct' ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[var(--border-main)] text-center text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                {t('matrix.directPinPrompt')}
              </div>
              ) : (
              <div className="space-y-3">
                {settings.features.split ? (
                  <div className="grid grid-cols-2 gap-3">
                    <PinTagInput
                      type="row"
                      pins={settings.pins.rows}
                      isActive={activeBox === 'row'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('row');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, rows: newPins } })}
                    />
                    <PinTagInput
                      type="splitRow"
                      pins={settings.pins.splitRows || []}
                      isActive={activeBox === 'splitRow'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('splitRow');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, splitRows: newPins } })}
                    />
                    <PinTagInput
                      type="col"
                      pins={settings.pins.cols}
                      isActive={activeBox === 'col'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('col');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, cols: newPins } })}
                    />
                    <PinTagInput
                      type="splitCol"
                      pins={settings.pins.splitCols || []}
                      isActive={activeBox === 'splitCol'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('splitCol');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, splitCols: newPins } })}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <PinTagInput
                      type="row"
                      pins={settings.pins.rows}
                      isActive={activeBox === 'row'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('row');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, rows: newPins } })}
                    />
                    <PinTagInput
                      type="col"
                      pins={settings.pins.cols}
                      isActive={activeBox === 'col'}
                      isSplitKeyboard={settings.features.split}
                      onFocus={() => {
                        setActiveBox('col');
                        setFocusedFeature(null);
                      }}
                      onUpdatePins={(newPins) => updateSettings({ pins: { ...settings.pins, cols: newPins } })}
                    />
                  </div>
                )}
              </div>
              )}

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-[var(--text-main)] uppercase tracking-wider">{t('hardware.specialPins')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(settings.features.rgb || settings.features.rgbMatrix) && (
                    <InteractivePinSlot
                      label={t('hardware.rgbData')}
                      value={settings.pins.rgb || ''}
                      isFocused={activeBox === 'feature' && focusedFeature === 'rgb'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('rgb');
                      }}
                      onClear={() => setPin('feature', 'rgb', '')}
                    />
                  )}
                  {settings.features.backlight && (
                    <InteractivePinSlot
                      label={t('hardware.backlightPin')}
                      value={settings.pins.backlight || ''}
                      isFocused={activeBox === 'feature' && focusedFeature === 'backlight'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('backlight');
                      }}
                      onClear={() => setPin('feature', 'backlight', '')}
                    />
                  )}
                  {settings.features.oled && (
                    <>
                      <InteractivePinSlot
                        label={t('hardware.i2cSda')}
                        value={settings.pins.sda || ''}
                        isFocused={activeBox === 'feature' && focusedFeature === 'sda'}
                        onFocus={() => {
                          setActiveBox('feature');
                          setFocusedFeature('sda');
                        }}
                        onClear={() => setPin('feature', 'sda', '')}
                      />
                      <InteractivePinSlot
                        label={t('hardware.i2cScl')}
                        value={settings.pins.scl || ''}
                        isFocused={activeBox === 'feature' && focusedFeature === 'scl'}
                        onFocus={() => {
                          setActiveBox('feature');
                          setFocusedFeature('scl');
                        }}
                        onClear={() => setPin('feature', 'scl', '')}
                      />
                    </>
                  )}
                  {settings.features.split && (
                    <InteractivePinSlot
                      label={t('hardware.splitSerial')}
                      value={settings.pins.splitSerial || ''}
                      isFocused={activeBox === 'feature' && focusedFeature === 'splitSerial'}
                      onFocus={() => {
                        setActiveBox('feature');
                        setFocusedFeature('splitSerial');
                      }}
                      onClear={() => setPin('feature', 'splitSerial', '')}
                    />
                  )}
                </div>
                {!(settings.features.rgb || settings.features.rgbMatrix || settings.features.backlight) && !settings.features.oled && !settings.features.split && (
                  <div className="h-24 flex items-center justify-center rounded-lg border border-dashed border-[var(--border-main)] text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
                    {t('hardware.specialPins')}
                  </div>
                )}
              </div>
          </div>
        </div>
      </div>

      <AvailablePinPool
        title={format('hardware.availablePinsPool', { label: pinPoolLabel })}
        activeLabel={activeBox ? getPinGroupLabel(activeBox, focusedFeature) : null}
        pins={pinPool}
        assignedPins={assignedPins}
        preventDuplicates={preventDuplicates}
        onPreventDuplicatesChange={setPreventDuplicates}
        onAssignPin={handleAssignPin}
        isCurrentPin={(pinName) => (
          (activeBox === 'row' && settings.pins.rows.includes(pinName)) ||
          (activeBox === 'col' && settings.pins.cols.includes(pinName)) ||
          (activeBox === 'splitRow' && (settings.pins.splitRows || []).includes(pinName)) ||
          (activeBox === 'splitCol' && (settings.pins.splitCols || []).includes(pinName)) ||
          (activeBox === 'feature' && !!focusedFeature && (settings.pins as any)[focusedFeature] === pinName)
        )}
        isActive={!!activeBox}
        isListTarget={activeBox === 'row' || activeBox === 'col' || activeBox === 'splitRow' || activeBox === 'splitCol'}
        customPinText={customPinText}
        onCustomPinTextChange={(value) => setCustomPinText(value.toUpperCase())}
        showCustomPinInput
      />
    </div>
  );
};
