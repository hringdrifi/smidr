'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { MousePointer2, Trash2, Edit2, LayoutGrid } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getLocalMatrixPosition, MatrixSide } from '@/lib/matrix-utils';

export const MatrixPainter = ({ horizontal = false }: { horizontal?: boolean }) => {
  const { 
    painter, setPainter, clearMatrixMap, editorSettings, updateEditorSettings, settings,
    matrixSubMode, setMatrixSubMode, selectedKeyIds, keys, setMatrixPosition
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

  if (horizontal) {
    return (
      <div className="flex items-center gap-3">
        {/* Sub-Mode Switcher */}
        <div className="flex bg-[var(--bg-app)] p-0.5 rounded-lg border border-[var(--border-main)]/50">
          <button
            onClick={() => setMatrixSubMode('paint')}
            title={t('matrix.painterDesc')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] text-[10px] font-bold uppercase transition-all",
              matrixSubMode === 'paint' 
                ? "bg-amber-500 text-zinc-950 shadow-sm" 
                : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
            )}
          >
            <MousePointer2 size={12} />
            <span className="hidden lg:block">{t('matrix.paintMode')}</span>
          </button>
          <button
            onClick={() => setMatrixSubMode('manual')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-[6px] text-[10px] font-bold uppercase transition-all",
              matrixSubMode === 'manual' 
                ? "bg-amber-500 text-zinc-950 shadow-sm" 
                : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
            )}
          >
            <Edit2 size={12} />
            <span className="hidden lg:block">{t('matrix.manualMode')}</span>
          </button>
        </div>

        {/* Dynamic Controls based on Sub-Mode */}
        {matrixSubMode === 'paint' ? (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-1">
            <div className="flex items-center gap-1.5">
              {settings.features.split && (
                <div className="flex bg-[var(--bg-app)] p-0.5 rounded border border-[var(--border-main)]/50">
                  {(['left', 'right'] as const).map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPainter({ currentSide: side })}
                      className={cn(
                        "px-2 h-7 rounded-[3px] text-[9px] font-bold uppercase transition-all",
                        painter.currentSide === side
                          ? "bg-amber-500 text-zinc-950"
                          : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                      )}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-main)] rounded-md px-1.5 h-8">
                <span className="text-[9px] font-bold text-amber-500/70 mr-1.5 uppercase tracking-tighter">R</span>
                <input 
                  type="number" 
                  min="0"
                  value={painter.currentRow} 
                  onChange={(e) => setPainter({ currentRow: parseInt(e.target.value) || 0 })}
                  className="w-10 bg-transparent text-xs font-bold text-[var(--text-highlight)] outline-none" 
                />
              </div>
              <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-main)] rounded-md px-1.5 h-8">
                <span className="text-[9px] font-bold text-amber-500/70 mr-1.5 uppercase tracking-tighter">C</span>
                <input 
                  type="number" 
                  min="0"
                  value={painter.currentCol} 
                  onChange={(e) => setPainter({ currentCol: parseInt(e.target.value) || 0 })}
                  className="w-10 bg-transparent text-xs font-bold text-[var(--text-highlight)] outline-none" 
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter hidden xl:block mr-1">{t('matrix.autoIncrement')}</span>
              <div className="flex bg-[var(--bg-app)] p-0.5 rounded border border-[var(--border-main)]/50">
                {(['matrix', 'col', 'row'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPainter({ autoIncrement: mode })}
                    className={cn(
                      "px-2 h-6 flex items-center justify-center rounded-[3px] text-[9px] font-bold uppercase transition-all",
                      painter.autoIncrement === mode 
                        ? "bg-amber-500 text-zinc-950" 
                        : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                    )}
                  >
                    {t('matrix.inc' + mode.charAt(0).toUpperCase() + mode.slice(1))}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-1">
            {selectedKeyId ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[var(--bg-app)]/50 border border-amber-500/30 rounded-md px-2 h-8">
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-tighter mr-2">POS</span>
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      min="0"
                      value={selectedMatrixPos?.row ?? 0} 
                      onChange={(e) => setMatrixPosition(selectedKeyId, parseInt(e.target.value) || 0, selectedMatrixPos?.col ?? 0)}
                      className="w-8 bg-transparent text-xs font-bold text-amber-500 outline-none text-center" 
                    />
                    <span className="text-[var(--text-dim)]">,</span>
                    <input 
                      type="number" 
                      min="0"
                      value={selectedMatrixPos?.col ?? 0} 
                      onChange={(e) => setMatrixPosition(selectedKeyId, selectedMatrixPos?.row ?? 0, parseInt(e.target.value) || 0)}
                      className="w-8 bg-transparent text-xs font-bold text-amber-500 outline-none text-center" 
                    />
                  </div>
                </div>
                {settings.features.split && (
                  <div className="flex bg-[var(--bg-app)] p-0.5 rounded border border-[var(--border-main)]/50">
                    {(['left', 'right'] as const).map(side => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSelectedSide(side)}
                        className={cn(
                          "px-2 h-7 rounded-[3px] text-[9px] font-bold uppercase transition-all",
                          selectedMatrixSide === side
                            ? "bg-amber-500 text-zinc-950"
                            : "text-[var(--text-dim)] hover:text-[var(--text-main)]"
                        )}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setMatrixPosition(selectedKeyId, undefined, undefined)} className="w-8 h-8 flex items-center justify-center rounded bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm" title={t('matrix.clearMatrix')}>
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-[var(--text-muted)] italic px-2">{t('matrix.selectKeyPrompt')}</span>
            )}
          </div>
        )}

        <div className="h-4 w-px bg-[var(--border-main)]" />

        {/* Global Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => confirm(t('matrix.autoAssign') + "?") && useKeyboardStore.getState().autoAssignMatrix()}
            className="flex items-center gap-2 px-3 h-8 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 border border-amber-500/20 transition-all text-[10px] font-bold uppercase tracking-wider shadow-sm"
          >
            <LayoutGrid size={12} />
            <span className="hidden md:block">{t('matrix.autoAssign')}</span>
          </button>
          <button
            onClick={() => confirm(t('matrix.confirmClearMatrix')) && clearMatrixMap()}
            className="w-8 h-8 flex items-center justify-center rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all shadow-sm"
            title={t('matrix.clearMatrix')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex bg-[var(--bg-app)] p-1 rounded-lg border border-[var(--border-main)]">
        <button
          onClick={() => setMatrixSubMode('paint')}
          title={t('matrix.painterDesc')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            matrixSubMode === 'paint' 
              ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <MousePointer2 size={14} />
          {t('matrix.paintMode')}
        </button>
        <button
          onClick={() => setMatrixSubMode('manual')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
            matrixSubMode === 'manual' 
              ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Edit2 size={14} />
          {t('matrix.manualMode')}
        </button>
      </div>

      {matrixSubMode === 'paint' ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-200">
          <div className="space-y-4">
            {settings.features.split && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">Side</label>
                <div className="flex bg-[var(--bg-app)] p-1 rounded border border-[var(--border-main)]/50">
                  {(['left', 'right'] as const).map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setPainter({ currentSide: side })}
                      className={cn(
                        "flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all",
                        painter.currentSide === side
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
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('matrix.currentRow')}</label>
                <input 
                  type="number" 
                  min="0"
                  value={painter.currentRow} 
                  onChange={(e) => setPainter({ currentRow: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--bg-button)] border border-[var(--border-main)] rounded px-2 py-1 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" 
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('matrix.currentCol')}</label>
                <input 
                  type="number" 
                  min="0"
                  value={painter.currentCol} 
                  onChange={(e) => setPainter({ currentCol: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[var(--bg-button)] border border-[var(--border-main)] rounded px-2 py-1 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('matrix.autoIncrement')}</label>
              <div className="grid grid-cols-3 gap-1">
                {(['matrix', 'col', 'row'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPainter({ autoIncrement: mode })}
                    className={`py-1.5 px-2 rounded text-[10px] font-bold uppercase transition-colors border ${
                      painter.autoIncrement === mode 
                        ? 'bg-amber-500 text-zinc-950 border-amber-500' 
                        : 'bg-[var(--bg-button)] text-[var(--text-muted)] border-[var(--border-main)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {t('matrix.inc' + mode.charAt(0).toUpperCase() + mode.slice(1))}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
          {!selectedKeyId ? (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border-main)] rounded-xl text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[var(--bg-button)] flex items-center justify-center text-[var(--text-muted)]">
                <LayoutGrid size={20} />
              </div>
              <p className="text-[10px] font-medium text-[var(--text-muted)] leading-relaxed uppercase tracking-wider">
                {t('matrix.selectKeyPrompt')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[var(--bg-app)]/60 border border-[var(--border-main)] rounded-xl p-4 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--text-highlight)] mb-1">
                  <Edit2 size={14} className="text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-tight">{t('properties.title')}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('matrix.currentRow')}</label>
                    <input 
                      type="number" 
                      min="0"
                      value={selectedMatrixPos?.row ?? 0} 
                      onChange={(e) => setMatrixPosition(selectedKeyId, parseInt(e.target.value) || 0, selectedMatrixPos?.col ?? 0)}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase text-[var(--text-muted)] font-bold">{t('matrix.currentCol')}</label>
                    <input 
                      type="number" 
                      min="0"
                      value={selectedMatrixPos?.col ?? 0} 
                      onChange={(e) => setMatrixPosition(selectedKeyId, selectedMatrixPos?.row ?? 0, parseInt(e.target.value) || 0)}
                      className="w-full bg-[var(--bg-app)] border border-[var(--border-main)] rounded px-3 py-2 text-sm focus:ring-1 focus:ring-amber-500 outline-none text-[var(--text-highlight)]" 
                    />
                  </div>
                </div>
                {settings.features.split && (
                  <div className="flex bg-[var(--bg-app)] p-1 rounded border border-[var(--border-main)]/50">
                    {(['left', 'right'] as const).map(side => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setSelectedSide(side)}
                        className={cn(
                          "flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all",
                          selectedMatrixSide === side
                            ? "bg-amber-500 text-zinc-950"
                            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        )}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                )}

                {!selectedMatrixPos && (
                  <p className="text-[10px] text-amber-500/70 italic">
                    {t('matrix.notAssigned')}
                  </p>
                )}
              </div>

              <button
                onClick={() => setMatrixPosition(selectedKeyId, undefined, undefined)}
                className="w-full py-2 px-3 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-wider border border-red-500/20 transition-all"
              >
                {t('matrix.clearAssignment')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="pt-4 border-t border-[var(--border-main)] space-y-2">
        <button
          onClick={() => confirm(t('matrix.autoAssign') + "?") && useKeyboardStore.getState().autoAssignMatrix()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all text-[10px] font-bold uppercase tracking-wider border border-amber-500/20"
        >
          <LayoutGrid size={14} />
          {t('matrix.autoAssign')}
        </button>

        <button
          onClick={() => confirm(t('matrix.confirmClearMatrix')) && clearMatrixMap()}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all text-[10px] font-bold uppercase tracking-wider border border-red-500/20"
        >
          <Trash2 size={14} />
          {t('matrix.clearMatrix')}
        </button>
      </div>
    </div>
  );
};
