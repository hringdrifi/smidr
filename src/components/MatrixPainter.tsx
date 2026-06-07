'use client';

import React from 'react';
import { MousePointer2, Trash2 } from 'lucide-react';
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
  } = useKeyboardStore();
  const { t } = useTranslation();

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = selectedKeyId ? keys.find(k => k.id === selectedKeyId) : null;
  const selectedMatrixPos = selectedKey ? getLocalMatrixPosition(settings, selectedKey, keys) : null;
  const selectedMatrixSide = selectedMatrixPos?.side || selectedKey?.matrixSide || 'left';
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
    </div>
  );
};
