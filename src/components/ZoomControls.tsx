'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Plus, Minus, Scan, Grid, MousePointer2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

import { getKeyVertices, PADDING_X, PADDING_Y } from '@/lib/canvas-utils';

export const ZoomControls = () => {
  const { 
    transform, 
    setTransform, 
    editorSettings, 
    updateEditorSettings, 
    editorMode,
    keys,
    settings,
    canvasDimensions,
    appMode
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = React.useState<'grid' | 'mouse' | null>(null);

  const handleZoom = (delta: number) => {
    const newScale = Math.min(Math.max(transform.scale + delta, 0.1), 3.0);
    setTransform({ ...transform, scale: newScale });
  };

  const handleResetView = () => {
    const visKeys = keys.filter(k => !k.group || (settings.activeOptions[k.group] ?? 0) === k.option);
    
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    visKeys.forEach(k => {
      const vertices = getKeyVertices(k);
      vertices.forEach(v => {
        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
      });
    });

    const hasKeys = visKeys.length > 0;
    const keyboardWidth = hasKeys ? (maxX - minX) : 0;
    const keyboardHeight = hasKeys ? (maxY - minY) : 0;
    const keyboardCenterX = hasKeys ? (minX + keyboardWidth / 2) : 0;
    const keyboardCenterY = hasKeys ? (minY + keyboardHeight / 2) : 0;

    // Read the true live size from the DOM directly to avoid any stale React state
    // if ResizeObserver hasn't fired yet (e.g. window was never resized).
    const container = document.getElementById('keyboard-canvas-container');
    const stageWidth = container ? container.clientWidth : (canvasDimensions?.width ?? 1000);
    const stageHeight = container ? container.clientHeight : (canvasDimensions?.height ?? 800);

    // Center horizontally, but fix vertically to exactly the same initial coordinate (resetY = 0)
    const resetX = stageWidth / 2 - PADDING_X - keyboardCenterX;
    const resetY = 0;

    setTransform({ scale: 1, x: resetX, y: resetY });
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[200]">
      {/* Popovers Container */}
      {appMode !== 'remap' && editorMode === 'layout' && activeMenu && (
        <>
          <div className="fixed inset-0" onClick={() => setActiveMenu(null)} />
          
          {activeMenu === 'grid' && (
            <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] p-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
                  <Grid size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('zoom.gridSettings')}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-main)] font-medium">{t('zoom.showGrid')}</span>
                  <button 
                    onClick={() => updateEditorSettings({ gridVisible: !editorSettings.gridVisible })}
                    className={cn(
                      "w-8 h-4 rounded-full transition-colors relative",
                      editorSettings.gridVisible ? 'bg-amber-500' : 'bg-zinc-700'
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                      editorSettings.gridVisible ? 'left-[18px]' : 'left-[2px]'
                    )} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-[var(--text-main)] font-medium">{t('zoom.snapInterval')}</span>
                    <span className="text-amber-500 font-mono font-bold">{editorSettings.gridSnap}u</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[1, 0.5, 0.25, 0.125, 0.1].map(snap => (
                      <button
                        key={snap}
                        onClick={() => updateEditorSettings({ gridSnap: snap })}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-bold transition-all border",
                          editorSettings.gridSnap === snap 
                            ? "bg-amber-500 text-zinc-950 border-amber-600" 
                            : "bg-[var(--bg-button)] text-[var(--text-main)] border-[var(--border-main)] hover:bg-zinc-700"
                        )}
                      >
                        {snap}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeMenu === 'mouse' && (
            <div className="absolute bottom-full left-[44px] mb-2 w-56 bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] p-4 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
                  <MousePointer2 size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('zoom.mouseBehavior')}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-main)] font-medium">{t('zoom.syncPivot')}</span>
                  <button 
                    onClick={() => updateEditorSettings({ syncOrigin: !editorSettings.syncOrigin })}
                    className={cn(
                      "w-8 h-4 rounded-full transition-colors relative",
                      editorSettings.syncOrigin ? 'bg-amber-500' : 'bg-zinc-700'
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                      editorSettings.syncOrigin ? 'left-[18px]' : 'left-[2px]'
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-main)] font-medium whitespace-nowrap">{t('zoom.fixedKey')}</span>
                  <button 
                    onClick={() => updateEditorSettings({ keepPosOnOriginChange: !editorSettings.keepPosOnOriginChange })}
                    className={cn(
                      "w-8 h-4 rounded-full transition-colors relative",
                      editorSettings.keepPosOnOriginChange ? 'bg-amber-500' : 'bg-zinc-700'
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                      editorSettings.keepPosOnOriginChange ? 'left-[18px]' : 'left-[2px]'
                    )} />
                  </button>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* Control Bar */}
      <div className="flex items-center gap-1.5 bg-[var(--bg-panel)]/90 backdrop-blur border border-[var(--border-main)] p-1.5 rounded-lg shadow-2xl">
        {appMode !== 'remap' && editorMode === 'layout' && (
          <>
            <button 
              onClick={() => setActiveMenu(activeMenu === 'grid' ? null : 'grid')}
              className={cn(
                "p-2 rounded transition-all",
                activeMenu === 'grid' ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
              )}
              title={t('zoom.gridSettings')}
            >
              <Grid size={14} />
            </button>

            <button 
              onClick={() => setActiveMenu(activeMenu === 'mouse' ? null : 'mouse')}
              className={cn(
                "p-2 rounded transition-all",
                activeMenu === 'mouse' ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
              )}
              title={t('zoom.mouseBehavior')}
            >
              <MousePointer2 size={14} />
            </button>

            <div className="w-px h-4 bg-[var(--bg-button)] mx-1" />
          </>
        )}

        {editorMode === 'matrix' && (
          <button 
            onClick={() => updateEditorSettings({ showMatrixLines: !editorSettings.showMatrixLines })}
            className={cn(
              "p-2 rounded transition-all",
              editorSettings.showMatrixLines 
                ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" 
                : "bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
            )}
            title={t('matrix.showWiring')}
          >
            <Hash size={14} />
          </button>
        )}

        <div className="flex items-center bg-[var(--bg-app)] border border-[var(--border-main)] rounded overflow-hidden">
          <button 
            onClick={() => handleZoom(-0.1)}
            className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-colors"
            title={t('zoom.zoomOut')}
          >
            <Minus size={14} />
          </button>
          <div className="w-12 text-center text-[10px] font-mono font-bold text-amber-500 select-none">
            {Math.round(transform.scale * 100)}%
          </div>
          <button 
            onClick={() => handleZoom(0.1)}
            className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-colors"
            title={t('zoom.zoomIn')}
          >
            <Plus size={14} />
          </button>
        </div>

        <button 
          onClick={handleResetView}
          className="p-2 bg-[var(--bg-app)] border border-[var(--border-main)] rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-colors"
          title={t('zoom.resetView')}
        >
          <Scan size={14} />
        </button>
      </div>
    </div>
  );
};
