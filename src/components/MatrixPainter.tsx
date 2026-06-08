'use client';

import React from 'react';
import { Gauge, MousePointer2, Trash2 } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { getLocalMatrixPosition, MatrixSide } from '@/lib/matrix-utils';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { RightPanelEmptyState } from './RightPanelEmptyState';

export const MatrixPainter = () => {
  const {
    settings,
    selectedKeyIds,
    keys,
    setMatrixPosition,
    addEncoderToKey,
    removeEncoderFromKey,
    updateEncoder,
  } = useKeyboardStore();
  const { t } = useTranslation();

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = selectedKeyId ? keys.find(k => k.id === selectedKeyId) : null;
  const selectedMatrixPos = selectedKey ? getLocalMatrixPosition(settings, selectedKey, keys) : null;
  const selectedMatrixSide = selectedMatrixPos?.side || selectedKey?.matrixSide || 'left';
  const selectedEncoder = selectedKey?.encoderId
    ? (settings.encoders || []).find(encoder => encoder.id === selectedKey.encoderId)
    : null;
  const selectedEncoderIndex = selectedEncoder
    ? (settings.encoders || []).findIndex(encoder => encoder.id === selectedEncoder.id)
    : -1;
  const setSelectedSide = (side: MatrixSide) => {
    if (!selectedKeyId) return;
    setMatrixPosition(selectedKeyId, selectedMatrixPos?.row ?? 0, selectedMatrixPos?.col ?? 0, side);
  };

  if (!selectedKeyId || !selectedKey) {
    return (
      <RightPanelEmptyState message={t('common.selectKeysDesc')} icon={MousePointer2} />
    );
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-4 animate-in fade-in slide-in-from-right-1 duration-200">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('matrix.row')}
          </span>
          <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 py-2">
            <input
              type="number"
              min="0"
              value={selectedMatrixPos?.row ?? 0}
              onChange={(e) => setMatrixPosition(selectedKeyId, parseInt(e.target.value) || 0, selectedMatrixPos?.col ?? 0, selectedMatrixSide)}
              className="h-7 w-full bg-transparent font-mono text-sm font-bold text-[var(--text-highlight)] outline-none focus:text-amber-500"
            />
          </div>
        </label>
        <label className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t('matrix.col')}
          </span>
          <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 py-2">
            <input
              type="number"
              min="0"
              value={selectedMatrixPos?.col ?? 0}
              onChange={(e) => setMatrixPosition(selectedKeyId, selectedMatrixPos?.row ?? 0, parseInt(e.target.value) || 0, selectedMatrixSide)}
              className="h-7 w-full bg-transparent font-mono text-sm font-bold text-[var(--text-highlight)] outline-none focus:text-amber-500"
            />
          </div>
        </label>
      </div>

      {settings.features.split && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Side
          </div>
          <div className="grid grid-cols-2 gap-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
            {(['left', 'right'] as const).map(side => (
              <button
                key={side}
                type="button"
                onClick={() => setSelectedSide(side)}
                className={cn(
                  "h-8 rounded text-[10px] font-bold uppercase transition-all",
                  selectedMatrixSide === side
                    ? "bg-amber-500 text-zinc-950"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                {side}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setMatrixPosition(selectedKeyId, undefined, undefined)}
        className="flex w-full items-center justify-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-500 transition-colors hover:bg-red-500 hover:text-white"
      >
        <Trash2 size={13} />
        {t('matrix.clearAssignment')}
      </button>

      {!selectedMatrixPos && (
        <p className="text-[10px] italic text-amber-500/75">
          {t('matrix.notAssigned')}
        </p>
      )}

      <div className="rounded border border-[var(--border-main)] bg-[var(--bg-app)]/40 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-[var(--text-dim)]" />
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('matrix.encoder')}
              </div>
              {selectedEncoder && (
                <div className="mt-0.5 font-mono text-[10px] text-amber-500">
                  e{selectedEncoderIndex}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => selectedEncoder ? removeEncoderFromKey(selectedKeyId) : addEncoderToKey(selectedKeyId)}
            className={cn(
              "h-8 rounded border px-3 text-[10px] font-bold uppercase transition-all",
              selectedEncoder
                ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                : "border-amber-500/25 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950"
            )}
          >
            {selectedEncoder ? t('matrix.removeEncoder') : t('matrix.addEncoder')}
          </button>
        </div>

        {selectedEncoder && (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('matrix.encoderPinA')}
              </span>
              <input
                type="text"
                value={selectedEncoder.pinA || ''}
                onChange={(e) => updateEncoder(selectedEncoder.id!, { pinA: e.target.value })}
                className="h-9 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                placeholder="GP2"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('matrix.encoderPinB')}
              </span>
              <input
                type="text"
                value={selectedEncoder.pinB || ''}
                onChange={(e) => updateEncoder(selectedEncoder.id!, { pinB: e.target.value })}
                className="h-9 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 font-mono text-xs font-bold text-[var(--text-highlight)] outline-none transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                placeholder="GP3"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
