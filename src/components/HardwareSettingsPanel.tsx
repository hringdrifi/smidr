'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Settings, Cpu, HardDrive, Lightbulb, Gauge, Monitor, ShieldCheck, Database, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DEVELOPMENT_BOARD_OPTIONS,
  getDefaultBootloader,
  getDefaultDevelopmentBoard,
  isQmkDevelopmentBoardSupported,
  isQmkMcuSupported,
  isZmkDevelopmentBoardSupported,
  isZmkExportSupported,
  QMK_MCU_PRESETS,
} from '@/lib/mcu-presets';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getSupportBadge = (supportsQmk: boolean, supportsZmk: boolean) => {
  if (supportsQmk && supportsZmk) return '[QMK/ZMK]';
  if (supportsQmk) return '[QMK]';
  if (supportsZmk) return '[ZMK]';
  return '[Unsupported]';
};

const Section = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
  <div className="bg-[var(--bg-panel)]/50 border border-[var(--border-main)] rounded-lg overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-main)] bg-[var(--bg-panel)]/80">
      <Icon size={16} className="text-amber-500" />
      <h2 className="text-xs font-bold text-[var(--text-highlight)] uppercase tracking-wider">{title}</h2>
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </div>
);

const PinInput = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{label}</label>
    <input 
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all"
    />
  </div>
);

export const HardwareSettingsPanel = () => {
  const { settings, updateSettings } = useKeyboardStore();
  const { t } = useTranslation();
  const format = (path: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      t(path)
    );

  const normalizePin = (pin: string | undefined) => (pin || '').trim().toUpperCase();
  const hasRowColPinOverlap = (rows: string[] = [], cols: string[] = []) => {
    const colPins = new Set(cols.map(normalizePin).filter(Boolean));
    return rows.some(row => colPins.has(normalizePin(row)));
  };
  const rightRows = settings.pins.splitRows && settings.pins.splitRows.length === settings.pins.rows.length
    ? settings.pins.splitRows
    : settings.pins.rows;
  const rightCols = settings.pins.splitCols && settings.pins.splitCols.length === settings.pins.cols.length
    ? settings.pins.splitCols
    : settings.pins.cols;
  const hasMatrixPinOverlap =
    hasRowColPinOverlap(settings.pins.rows, settings.pins.cols) ||
    (settings.features.split && hasRowColPinOverlap(rightRows, rightCols));
  const qmkMatrixMasked = settings.qmk?.matrixMasked === true;
  const selectedMcu = settings.hardware.mcu || 'RP2040';
  const controllerType = settings.hardware.controllerType || 'development_board';
  const selectedDevelopmentBoard = settings.hardware.board || getDefaultDevelopmentBoard(selectedMcu);
  const developmentBoardOptions = DEVELOPMENT_BOARD_OPTIONS.some(option => option.value === selectedDevelopmentBoard)
    ? DEVELOPMENT_BOARD_OPTIONS
    : [...DEVELOPMENT_BOARD_OPTIONS, { value: selectedDevelopmentBoard, label: selectedDevelopmentBoard }];
  const qmkBootmagic = settings.qmk?.bootmagic || { enabled: true };
  const bootmagicEnabled = qmkBootmagic.enabled !== false;
  const vialUnlockCombo = settings.vial?.unlockCombo || {};
  const updateQmkSettings = (qmkUpdates: NonNullable<typeof settings.qmk>) => {
    updateSettings({
      qmk: {
        ...(settings.qmk || {}),
        ...qmkUpdates,
        bootmagic: {
          ...(settings.qmk?.bootmagic || {}),
          ...(qmkUpdates.bootmagic || {}),
        },
      },
    });
  };
  const updateVialUnlockCombo = (
    keyId: 'key1' | 'key2',
    updates: { row?: number; col?: number }
  ) => {
    updateSettings({
      vial: {
        ...(settings.vial || {}),
        unlockCombo: {
          ...(settings.vial?.unlockCombo || {}),
          [keyId]: {
            ...(settings.vial?.unlockCombo?.[keyId] || {}),
            ...updates,
          },
        },
      },
    });
  };

  const updateHardware = (updates: Partial<typeof settings.hardware>) => {
    updateSettings({ hardware: { ...settings.hardware, ...updates } });
  };

  const updateMcu = (mcu: string) => {
    updateHardware({
      mcu,
      bootloader: getDefaultBootloader(mcu),
    });
  };

  const updateControllerType = (nextType: 'mcu' | 'development_board') => {
    updateHardware({
      controllerType: nextType,
      ...(nextType === 'development_board' && !settings.hardware.board
        ? { board: getDefaultDevelopmentBoard(selectedMcu) }
        : {}),
    });
  };

  const toggleFeature = (key: keyof typeof settings.features) => {
    updateSettings({ features: { ...settings.features, [key]: !settings.features[key] } });
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* General & USB */}
      <Section title={t('hardware.identity')} icon={Settings}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.kbName')}</label>
              <input type="text" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.manufacturer')}</label>
              <input type="text" value={settings.manufacturer} onChange={(e) => updateSettings({ manufacturer: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PinInput 
              label={t('hardware.vidHex')} 
              value={`0x${(settings.vendorProductId >>> 16).toString(16).toUpperCase().padStart(4, '0')}`} 
              onChange={(v) => {
                const vid = parseInt(v.replace('0x', ''), 16) || 0;
                const pid = settings.vendorProductId & 0xFFFF;
                updateSettings({ vendorProductId: (vid << 16) | pid });
              }} 
              placeholder="0xFEED" 
            />
            <PinInput 
              label={t('hardware.pidHex')} 
              value={`0x${(settings.vendorProductId & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`} 
              onChange={(v) => {
                const pid = parseInt(v.replace('0x', ''), 16) || 0;
                const vid = settings.vendorProductId >>> 16;
                updateSettings({ vendorProductId: (vid << 16) | pid });
              }} 
              placeholder="0x0001" 
            />
          </div>
        </div>
      </Section>

      {/* Controller & Matrix */}
      <Section title={t('hardware.mcu')} icon={Cpu}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.controllerSource')}</label>
            <div className="flex bg-[var(--bg-app)] p-1 rounded border border-[var(--border-main)]">
              {([
                ['development_board', t('hardware.developmentBoard')],
                ['mcu', 'MCU'],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateControllerType(type)}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-bold rounded transition-all",
                    controllerType === type ? "bg-amber-500 text-[var(--bg-button)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {controllerType === 'mcu' ? (
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.controller')}</label>
            <select 
              value={selectedMcu}
              onChange={(e) => updateMcu(e.target.value)}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]"
            >
              {QMK_MCU_PRESETS.map(preset => {
                const badge = getSupportBadge(
                  isQmkMcuSupported(preset.value),
                  isZmkExportSupported(preset.value)
                );
                return (
                  <option key={preset.value} value={preset.value}>{preset.label} {badge}</option>
                );
              })}
            </select>
            <p className="text-[9px] text-[var(--text-dim)] leading-relaxed">
              {t('hardware.mcuExportDesc')}
            </p>
          </div>
          ) : (
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.developmentBoard')}</label>
            <select
              value={selectedDevelopmentBoard}
              onChange={(e) => updateHardware({ board: e.target.value.trim() })}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)] font-mono"
            >
              {developmentBoardOptions.map(board => {
                const badge = getSupportBadge(
                  isQmkDevelopmentBoardSupported(board.value),
                  isZmkDevelopmentBoardSupported(board.value)
                );
                return (
                  <option key={board.value} value={board.value}>{board.label} {badge}</option>
                );
              })}
            </select>
            <p className="text-[9px] text-[var(--text-dim)] leading-relaxed">
              {t('hardware.boardExportDesc')}
            </p>
          </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.diodeDir')}</label>
            <div className="flex bg-[var(--bg-app)] p-1 rounded border border-[var(--border-main)]">
              {(['COL2ROW', 'ROW2COL'] as const).map(dir => (
                <button
                  key={dir}
                  onClick={() => updateHardware({ diodeDirection: dir })}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-bold rounded transition-all",
                    settings.hardware.diodeDirection === dir ? "bg-amber-500 text-[var(--bg-button)]" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  )}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* QMK Details */}
      <Section title={t('hardware.qmkDetails')} icon={Settings}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 p-3 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-main)]/50">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[var(--text-main)] leading-none">MATRIX_MASKED</span>
              <span className="text-[9px] text-[var(--text-dim)] font-medium mt-1">
                {t('hardware.matrixMaskedDesc')}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={qmkMatrixMasked}
              onClick={() => updateQmkSettings({ matrixMasked: !qmkMatrixMasked })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                qmkMatrixMasked ? "bg-amber-500" : "bg-[var(--bg-button)]"
              )}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                qmkMatrixMasked ? "left-[18px]" : "left-[2px]"
              )} />
            </button>
          </div>

          {hasMatrixPinOverlap && !qmkMatrixMasked && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-500">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p className="text-[10px] leading-relaxed">
                {t('hardware.matrixOverlapWarning')}
              </p>
            </div>
          )}

          <div className="space-y-3 p-3 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-main)]/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--text-main)] leading-none">BOOTMAGIC</span>
                <span className="text-[9px] text-[var(--text-dim)] font-medium mt-1">
                  {t('hardware.bootmagicDesc')}
                </span>
              </div>
              <button
                type="button"
                aria-pressed={bootmagicEnabled}
                onClick={() => updateQmkSettings({ bootmagic: { enabled: !bootmagicEnabled } })}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                  bootmagicEnabled ? "bg-amber-500" : "bg-[var(--bg-button)]"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                  bootmagicEnabled ? "left-[18px]" : "left-[2px]"
                )} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{t('hardware.bootmagicRow')}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={!bootmagicEnabled}
                  value={Number.isInteger(qmkBootmagic.row) ? qmkBootmagic.row : ''}
                  onChange={(e) => updateQmkSettings({
                    bootmagic: {
                      row: e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    },
                  })}
                  placeholder={t('hardware.firstKey')}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all disabled:opacity-50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{t('hardware.bootmagicCol')}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={!bootmagicEnabled}
                  value={Number.isInteger(qmkBootmagic.col) ? qmkBootmagic.col : ''}
                  onChange={(e) => updateQmkSettings({
                    bootmagic: {
                      col: e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    },
                  })}
                  placeholder={t('hardware.firstKey')}
                  className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Features Toggles */}
      <Section title={t('hardware.features')} icon={ShieldCheck}>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'rgb', label: t('hardware.rgb'), icon: Lightbulb },
            { id: 'encoder', label: t('hardware.encoder'), icon: Gauge },
            { id: 'oled', label: t('hardware.oled'), icon: Monitor },
            { id: 'via', label: t('hardware.via'), icon: Database },
            { id: 'split', label: t('hardware.split'), icon: HardDrive },
          ].map(feat => (
            <React.Fragment key={feat.id}>
              <button
                onClick={() => toggleFeature(feat.id as any)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                  settings.features[feat.id as keyof typeof settings.features]
                    ? "bg-amber-500/10 border-amber-500/50 text-amber-500"
                    : "bg-[var(--bg-app)] border-[var(--border-main)] text-[var(--text-muted)] grayscale opacity-60"
                )}
              >
                <feat.icon size={18} />
                <span className="text-xs font-bold leading-none">{feat.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </Section>

      {/* Vial Settings */}
      <Section title={t('hardware.vialSpec')} icon={ShieldCheck}>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">{t('hardware.vialSpec')}</span>
            <button 
              onClick={() => {
                const p1 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
                const p2 = Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');
                updateSettings({ vialUid: `0x${p1}${p2}` });
              }}
              className="text-[9px] text-[var(--text-muted)] hover:text-amber-500 transition-colors"
            >
              {t('hardware.genId')}
            </button>
          </div>
          <PinInput 
            label={t('hardware.vialUid')} 
            value={settings.vialUid || '0x0000000000000000'} 
            onChange={(v) => {
              const cleanHex = v.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
              updateSettings({ vialUid: `0x${cleanHex}` });
            }} 
            placeholder="e.g. 0xFB23... (Automatically derived)"
          />
          <p className="text-[9px] text-[var(--text-muted)] leading-relaxed italic">
            {t('hardware.vialDesc')}
          </p>

          <div className="space-y-3 p-3 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-main)]/50">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('hardware.vialUnlockCombo')}</span>
              <span className="text-[9px] text-[var(--text-dim)] font-medium mt-1">
                {t('hardware.vialUnlockComboDesc')}
              </span>
            </div>

            {(['key1', 'key2'] as const).map((keyId, idx) => {
              const comboKey = vialUnlockCombo[keyId] || {};
              return (
                <div key={keyId} className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-end">
                  <div className="pb-2 text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                    {format('hardware.keyNumber', { id: idx + 1 })}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{t('matrix.row')}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isInteger(comboKey.row) ? comboKey.row : ''}
                      onChange={(e) => updateVialUnlockCombo(keyId, {
                        row: e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })}
                      placeholder={idx === 0 ? t('hardware.firstKey') : t('hardware.lastKey')}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{t('matrix.col')}</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isInteger(comboKey.col) ? comboKey.col : ''}
                      onChange={(e) => updateVialUnlockCombo(keyId, {
                        col: e.target.value === '' ? undefined : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })}
                      placeholder={idx === 0 ? t('hardware.firstKey') : t('hardware.lastKey')}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Developer Settings */}
      <Section title={t('hardware.developer')} icon={Settings}>
        <div className="flex items-center justify-between p-3 bg-[var(--bg-app)]/50 rounded-lg border border-[var(--border-main)]/50">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('hardware.debugMode')}</span>
            <span className="text-[9px] text-[var(--text-dim)] font-medium mt-1">{t('hardware.debugModeDesc')}</span>
          </div>
          <div 
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
              useKeyboardStore.getState().editorSettings.debugMode ? "bg-amber-500" : "bg-[var(--bg-button)]"
            )}
            onClick={() => useKeyboardStore.getState().updateEditorSettings({ debugMode: !useKeyboardStore.getState().editorSettings.debugMode })}
          >
            <div className={cn(
              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
              useKeyboardStore.getState().editorSettings.debugMode ? "left-[18px]" : "left-[2px]"
            )} />
          </div>
        </div>
      </Section>
    </div>
  );
};
