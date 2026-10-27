import React from 'react';
import { Lightbulb, Wand2, Trash2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { getRgbMatrixBounds, getRgbMatrixLedPosition } from '@/lib/rgb-matrix';
import { hasRgbMatrixPosition, isRgbLedKey } from '@/lib/led-settings';

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const NumberField = ({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ''}
      onChange={(event) => {
        if (event.target.value === '') {
          onChange(undefined);
          return;
        }
        const next = Number(event.target.value);
        onChange(Number.isFinite(next) ? clampNumber(Math.round(next), min, max) : undefined);
      }}
      className="w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-2 py-1.5 font-mono text-xs text-amber-500 outline-none transition-all focus:ring-1 focus:ring-amber-500"
    />
  </label>
);

export const RgbMatrixPanel = () => {
  const { t } = useTranslation();
  const {
    keys,
    selectedKeyIds,
    settings,
    updateSettings,
    updateKey,
    autoAssignRgbMatrix,
    clearRgbMatrix,
  } = useKeyboardStore();
  const selectedKey = selectedKeyIds.length === 1
    ? keys.find(key => key.id === selectedKeyIds[0])
    : undefined;
  const rgbMatrixEnabled = settings.features.rgbMatrix === true;
  const visibleKeys = keys.filter(key => !key.decal && (!key.group || (settings.activeOptions[key.group] ?? 0) === key.option));
  const ledCount = rgbMatrixEnabled ? visibleKeys.filter(hasRgbMatrixPosition).length : 0;
  const canEdit = rgbMatrixEnabled && !!selectedKey && isRgbLedKey(selectedKey);

  const patchSelectedKey = (updates: Parameters<typeof updateKey>[1]) => {
    if (!canEdit || !selectedKey?.id) return;
    updateKey(selectedKey.id, updates, false);
  };

  const assignSelectedCenter = () => {
    if (!canEdit || !selectedKey?.id) return;
    const bounds = getRgbMatrixBounds(visibleKeys);
    patchSelectedKey(getRgbMatrixLedPosition(selectedKey, bounds));
  };

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <section className="rounded-md border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
        <button
          type="button"
          aria-pressed={rgbMatrixEnabled}
          onClick={() => updateSettings({ features: { ...settings.features, rgbMatrix: !rgbMatrixEnabled } })}
          className="flex w-full items-center justify-between gap-3 rounded p-1 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Lightbulb size={15} className="text-amber-500" />
            <span className="text-xs font-bold text-[var(--text-main)]">{t('rgbMatrix.enable')}</span>
          </span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${rgbMatrixEnabled ? 'bg-amber-500' : 'bg-[var(--bg-button)]'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-zinc-950 transition-all ${rgbMatrixEnabled ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">{t('rgbMatrix.qmkOnly')}</p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={autoAssignRgbMatrix}
          disabled={!rgbMatrixEnabled || !visibleKeys.some(isRgbLedKey)}
          className="flex items-center justify-center gap-2 rounded border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-500 transition-colors hover:bg-amber-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Wand2 size={14} />
          {t('rgbMatrix.autoAssign')}
        </button>
        <button
          type="button"
          onClick={() => confirm(t('rgbMatrix.confirmClear')) && clearRgbMatrix()}
          disabled={!rgbMatrixEnabled}
          className="flex items-center justify-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 size={14} />
          {t('rgbMatrix.clear')}
        </button>
      </div>

      <div className="rounded-md border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{t('rgbMatrix.assigned')}</span>
          <span className="font-mono text-xs font-bold text-amber-500">{ledCount}</span>
        </div>
        {!rgbMatrixEnabled ? (
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t('rgbMatrix.disabledHint')}</p>
        ) : !selectedKey ? (
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t('rgbMatrix.selectKey')}</p>
        ) : !isRgbLedKey(selectedKey) ? (
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">{t('rgbMatrix.rgbKeyRequired')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              {t('rgbMatrix.ledIndex')}: {selectedKey.ledIndex === undefined ? '—' : selectedKey.ledIndex + 1}
              <span className="mt-1 block">{t('rgbMatrix.numberInHardware')}</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label={t('rgbMatrix.ledX')} value={selectedKey.ledX} min={0} max={224} onChange={(ledX) => patchSelectedKey({ ledX })} />
              <NumberField label={t('rgbMatrix.ledY')} value={selectedKey.ledY} min={0} max={64} onChange={(ledY) => patchSelectedKey({ ledY })} />
            </div>
            <NumberField label={t('rgbMatrix.ledFlags')} value={selectedKey.ledFlags} min={0} max={255} onChange={(ledFlags) => patchSelectedKey({ ledFlags })} />
            <button
              type="button"
              onClick={assignSelectedCenter}
              className="w-full rounded border border-[var(--border-main)] bg-[var(--bg-button)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
            >
              {t('rgbMatrix.useKeyCenter')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
