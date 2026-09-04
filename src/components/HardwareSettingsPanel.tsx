'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Settings, Cpu, HardDrive, ShieldCheck, AlertTriangle, Code2 } from 'lucide-react';
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
import { getFirmwareTargetLabel } from '@/lib/firmware-targets';

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
  <section className="border-t border-[var(--border-main)] pt-5 first:border-t-0 first:pt-0">
    <div className="mb-3 flex items-center gap-2">
      <Icon size={14} className="text-amber-500" />
      <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{title}</h2>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

const PinInput = ({ label, value, onChange, placeholder }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{label}</label>
    <input 
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-amber-500 font-mono transition-all"
    />
  </div>
);

export const HardwareSettingsPanel = ({
  scope = 'all',
  section = 'all',
  variant = 'panel',
}: {
  scope?: 'hardware' | 'firmware' | 'all';
  section?: 'identity' | 'target' | 'all';
  variant?: 'panel' | 'dialog';
}) => {
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
  const hasPins = (pins: string[] | undefined) => (pins?.filter(Boolean).length ?? 0) > 0;
  const rightRows = hasPins(settings.pins.splitRows)
    ? settings.pins.splitRows
    : settings.pins.rows;
  const rightCols = hasPins(settings.pins.splitCols)
    ? settings.pins.splitCols
    : settings.pins.cols;
  const hasMatrixPinOverlap =
    hasRowColPinOverlap(settings.pins.rows, settings.pins.cols) ||
    (settings.features.split && hasRowColPinOverlap(rightRows, rightCols));
  const qmkMatrixMasked = settings.qmk?.matrixMasked === true;
  const firmwareTarget = settings.firmwareTarget || 'qmk';
  const showIdentity = section !== 'target';
  const showTargetSettings = section !== 'identity';
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

  return (
    <div className={cn('space-y-5 p-4', variant === 'panel' && 'pb-24')}>
      {scope === 'firmware' && showIdentity && (
        <Section title={t('firmwareFlow.selected')} icon={Code2}>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-sm font-bold text-amber-500">{getFirmwareTargetLabel(firmwareTarget)}</div>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {t(`firmwareFlow.${firmwareTarget}Description`)}
            </p>
          </div>
        </Section>
      )}
      {/* General & USB */}
      {showIdentity && (
      <Section title={t('hardware.identity')} icon={Settings}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.kbName')}</label>
              <input type="text" value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.manufacturer')}</label>
              <input type="text" value={settings.manufacturer} onChange={(e) => updateSettings({ manufacturer: e.target.value })} className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" />
            </div>
          </div>
          {scope !== 'hardware' && <div className="grid grid-cols-2 gap-4">
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
          </div>}
        </div>
      </Section>
      )}

      {scope !== 'firmware' && <>
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
              className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]"
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
            <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
              {t('hardware.mcuExportDesc')}
            </p>
          </div>
          ) : (
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('hardware.developmentBoard')}</label>
            <select
              value={selectedDevelopmentBoard}
              onChange={(e) => updateHardware({ board: e.target.value.trim() })}
              className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)] font-mono"
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
            <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
              {t('hardware.boardExportDesc')}
            </p>
          </div>
          )}
        </div>
      </Section>

      {/* Split keyboard topology */}
      <Section title={t('hardware.split')} icon={HardDrive}>
        <div>
          <button
            type="button"
            aria-pressed={settings.features.split}
            onClick={() => updateSettings({
              features: { ...settings.features, split: !settings.features.split },
            })}
            className="flex w-full items-center justify-between gap-4 rounded-md bg-[var(--bg-app)]/40 p-3 text-left"
          >
            <span className="text-xs font-bold text-[var(--text-main)]">{t('hardware.split')}</span>
            <span className={cn(
              "relative h-5 w-9 shrink-0 rounded-full transition-colors",
              settings.features.split ? "bg-amber-500" : "bg-[var(--bg-button)]"
            )}>
              <span className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                settings.features.split ? "left-[18px]" : "left-[2px]"
              )} />
            </span>
          </button>

        </div>
      </Section>
      </>}

      {scope !== 'hardware' && showTargetSettings && (firmwareTarget === 'qmk' || firmwareTarget === 'vial') && <>
      {/* QMK Details */}
      <Section title={t('hardware.qmkDetails')} icon={Settings}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[var(--text-main)] leading-none">MATRIX_MASKED</span>
              <span className="text-[10px] text-[var(--text-dim)] font-medium mt-1">
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

          <div className="space-y-3 border-t border-[var(--border-main)] pt-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--text-main)] leading-none">BOOTMAGIC</span>
                <span className="text-[10px] text-[var(--text-dim)] font-medium mt-1">
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
                <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t('hardware.bootmagicRow')}</label>
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
                <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t('hardware.bootmagicCol')}</label>
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

      </>}

      {/* Vial Settings */}
      {scope !== 'hardware' && showTargetSettings && firmwareTarget === 'vial' && <>
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
              className="text-[10px] text-[var(--text-muted)] hover:text-amber-500 transition-colors"
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
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
            {t('hardware.vialDesc')}
          </p>

          <div className="space-y-3 border-t border-[var(--border-main)] pt-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('hardware.vialUnlockCombo')}</span>
              <span className="text-[10px] text-[var(--text-dim)] font-medium mt-1">
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
                    <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t('matrix.row')}</label>
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
                    <label className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{t('matrix.col')}</label>
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
      </>}

      {scope === 'firmware' && showTargetSettings && firmwareTarget === 'zmk' && (
        <Section title={getFirmwareTargetLabel(firmwareTarget)} icon={Code2}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{t('zmkExport.title')}</label>
              {([false, true] as const).map((studio) => (
                <button
                  key={String(studio)}
                  type="button"
                  aria-pressed={(settings.zmk?.studio === true) === studio}
                  onClick={() => updateSettings({ zmk: { ...(settings.zmk || {}), studio } })}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    (settings.zmk?.studio === true) === studio
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-[var(--border-main)] bg-[var(--bg-app)]/40 hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <span className="text-xs font-bold text-[var(--text-main)]">{t(studio ? 'zmkExport.studio' : 'zmkExport.standard')}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-[var(--text-muted)]">{t(studio ? 'zmkExport.studioDesc' : 'zmkExport.standardDesc')}</span>
                </button>
              ))}
            </div>
            {settings.features.split && (
              <div className="space-y-4 border-t border-[var(--border-main)] pt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{t('hardware.zmkSplitTransport')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ble', 'wired'] as const).map((transport) => (
                    <button
                      key={transport}
                      type="button"
                      aria-pressed={(settings.zmk?.splitTransport || 'ble') === transport}
                      onClick={() => updateSettings({ zmk: { ...(settings.zmk || {}), splitTransport: transport } })}
                      className={cn(
                        'min-h-10 rounded-lg border px-3 text-xs font-bold transition-colors',
                        (settings.zmk?.splitTransport || 'ble') === transport
                          ? 'border-amber-500 bg-amber-500 text-zinc-950'
                          : 'border-[var(--border-main)] bg-[var(--bg-app)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                      )}
                    >
                      {transport === 'ble' ? t('hardware.zmkSplitBle') : t('hardware.zmkSplitWired')}
                    </button>
                  ))}
                </div>
              </div>
              {(settings.zmk?.splitTransport || 'ble') === 'wired' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{t('hardware.zmkWiredSplitDevice')}</label>
                  <input
                    type="text"
                    value={settings.zmk?.wiredSplitDevice || ''}
                    onChange={(event) => updateSettings({ zmk: { ...(settings.zmk || {}), wiredSplitDevice: event.target.value } })}
                    placeholder="&pro_micro_serial"
                    className="w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-2 py-1.5 font-mono text-xs text-amber-500 outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <p className="text-[10px] leading-relaxed text-[var(--text-dim)]">{t('hardware.zmkWiredSplitDeviceDesc')}</p>
                </div>
              )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Developer Settings */}
      {section === 'all' && (
      <Section title={t('hardware.developer')} icon={Settings}>
        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('hardware.debugMode')}</span>
            <span className="text-[10px] text-[var(--text-dim)] font-medium mt-1">{t('hardware.debugModeDesc')}</span>
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
      )}
    </div>
  );
};
