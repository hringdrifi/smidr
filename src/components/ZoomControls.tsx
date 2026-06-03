'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Check, Pencil, Plus, Minus, Scan, Grid, MousePointer2, Hash, RefreshCcw, X, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';

import { clampZoom, getKeyVertices, PADDING_X, PADDING_Y, ZOOM_STEP } from '@/lib/canvas-utils';
import { VISUAL_LAYOUTS, normalizeVisualLayout } from '@/lib/visual-layouts';

export const ZoomControls = () => {
  const { 
    transform, 
    setTransform, 
    editorSettings, 
    updateEditorSettings, 
    setVisualLayout,
    editorMode,
    keys,
    settings,
    canvasDimensions,
    appMode,
    currentLayer,
    setCurrentLayer,
    addLayer,
    removeLastLayer,
    connectedDevice,
    zmkLayerMetadata,
    syncKeymap,
    renameZmkLayer,
    addZmkLayer,
    removeLastZmkLayer
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = React.useState<'grid' | 'mouse' | 'visual' | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [editingLayer, setEditingLayer] = React.useState<number | null>(null);
  const [layerNameDraft, setLayerNameDraft] = React.useState('');
  const [layerNameError, setLayerNameError] = React.useState<string | null>(null);
  const [isRenamingLayer, setIsRenamingLayer] = React.useState(false);
  const [isChangingLayers, setIsChangingLayers] = React.useState(false);
  const isZmkDevice = connectedDevice?.protocolType === 'zmk';
  const layerCount = settings.layers || 4;
  const zmkAvailableLayers = zmkLayerMetadata?.availableLayers || 0;
  const zmkMaxLayerNameLength = zmkLayerMetadata?.maxLayerNameLength || 0;
  const canAddZmkLayer = isZmkDevice && zmkLayerMetadata && zmkAvailableLayers > 0;
  const canRemoveZmkLayer = isZmkDevice && zmkLayerMetadata && layerCount > 1;

  const handleRefresh = async () => {
    if (!connectedDevice) return;
    setIsRefreshing(true);
    try {
      await syncKeymap();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const openLayerRename = () => {
    const layer = zmkLayerMetadata?.layers[currentLayer];
    setEditingLayer(currentLayer);
    setLayerNameDraft(layer?.name || `Layer ${currentLayer}`);
    setLayerNameError(null);
  };

  const closeLayerRename = () => {
    if (isRenamingLayer) return;
    setEditingLayer(null);
    setLayerNameDraft('');
    setLayerNameError(null);
  };

  const handleLayerRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingLayer === null) return;

    setIsRenamingLayer(true);
    setLayerNameError(null);
    try {
      await renameZmkLayer(editingLayer, layerNameDraft);
      setEditingLayer(null);
      setLayerNameDraft('');
    } catch (err: any) {
      setLayerNameError(err?.message || t('zoom.renameLayerFailed'));
    } finally {
      setIsRenamingLayer(false);
    }
  };

  const handleAddZmkLayer = async () => {
    setIsChangingLayers(true);
    try {
      await addZmkLayer();
    } catch (err) {
      console.error('Failed to add ZMK layer:', err);
    } finally {
      setIsChangingLayers(false);
    }
  };

  const handleRemoveLastZmkLayer = async () => {
    setIsChangingLayers(true);
    try {
      await removeLastZmkLayer();
    } catch (err) {
      console.error('Failed to remove ZMK layer:', err);
    } finally {
      setIsChangingLayers(false);
    }
  };

  const handleZoom = (delta: number) => {
    const newScale = clampZoom(transform.scale + delta);
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
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[200]">
      {/* Control Bar */}
      <div className="relative flex items-center gap-1.5 bg-[var(--bg-panel)]/90 backdrop-blur border border-[var(--border-main)] p-1.5 rounded-lg shadow-2xl">
        {/* Layer Selector & Refresh Sync */}
        {(appMode === 'remap' || editorMode === 'keymap') && (
          <>
            <div className="flex items-center gap-1 bg-[var(--bg-app)] border border-[var(--border-main)] rounded p-0.5">
              {Array.from({ length: layerCount }).map((_, layer) => {
                const zmkLayer = zmkLayerMetadata?.layers[layer];
                const layerName = zmkLayer?.name?.trim();
                const tooltipLabel = layerName
                  ? `${t('common.layer')} ${layer}: ${layerName}`
                  : `${t('common.layer')} ${layer}`;

                return (
                  <button
                    key={layer}
                    onClick={() => setCurrentLayer(layer)}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded text-[11px] font-bold transition-all relative group",
                      currentLayer === layer 
                        ? "bg-amber-500 text-zinc-950 font-black shadow-sm" 
                        : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    {layer}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      {tooltipLabel}
                    </div>
                  </button>
                );
              })}

              {isZmkDevice && zmkLayerMetadata && (
                <>
                  <div className="w-px h-4 bg-[var(--border-main)] mx-0.5" />
                  <button
                    onClick={openLayerRename}
                    className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)] transition-all relative group"
                  >
                    <Pencil size={12} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      {t('zoom.renameLayer')}
                    </div>
                  </button>
                  <button
                    onClick={handleAddZmkLayer}
                    disabled={!canAddZmkLayer || isChangingLayers}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded transition-all relative group",
                      canAddZmkLayer && !isChangingLayers
                        ? "text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]"
                        : "text-[var(--text-muted)] opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Plus size={12} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      {t('zoom.addZmkLayer')}
                    </div>
                  </button>
                  <button
                    onClick={handleRemoveLastZmkLayer}
                    disabled={!canRemoveZmkLayer || isChangingLayers}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded transition-all relative group",
                      canRemoveZmkLayer && !isChangingLayers
                        ? "text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]"
                        : "text-[var(--text-muted)] opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Minus size={12} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      {t('zoom.removeLastZmkLayer')}
                    </div>
                  </button>
                </>
              )}

              {appMode === 'design' && (
                <>
                  <div className="w-px h-4 bg-[var(--border-main)] mx-0.5" />
                  <button 
                    onClick={addLayer}
                    className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)] transition-all relative group"
                  >
                    <Plus size={12} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      Layer +
                    </div>
                  </button>
                  <button 
                    onClick={removeLastLayer}
                    className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)] transition-all relative group"
                  >
                    <span className="text-sm font-bold leading-none -translate-y-px">-</span>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      Layer -
                    </div>
                  </button>
                </>
              )}

              {appMode === 'remap' && connectedDevice && (
                <>
                  <div className="w-px h-4 bg-[var(--border-main)] mx-0.5" />
                  <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded transition-all relative group",
                      isRefreshing ? "opacity-50 cursor-wait text-amber-500" : "text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <RefreshCcw size={12} className={cn(isRefreshing && "animate-spin")} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-zinc-900/95 text-white text-[9px] font-bold rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-y-1 group-hover:translate-y-0 whitespace-nowrap border border-white/10 uppercase tracking-wider shadow-2xl backdrop-blur-sm z-50">
                      {isRefreshing ? (t('remap.refreshing') || 'Refreshing...') : (t('remap.refreshSync') || 'Refresh Sync')}
                    </div>
                  </button>
                </>
              )}
            </div>

            {isZmkDevice && zmkLayerMetadata && editingLayer !== null && (
              <>
                <div className="fixed inset-0" onClick={closeLayerRename} />
                <form
                  onSubmit={handleLayerRename}
                  className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)]/95 p-2 shadow-2xl backdrop-blur-xl"
                >
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={layerNameDraft}
                      maxLength={zmkMaxLayerNameLength || undefined}
                      onChange={(event) => setLayerNameDraft(event.target.value)}
                      className="h-8 min-w-0 flex-1 rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-2 text-xs font-semibold text-[var(--text-main)] outline-none focus:border-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={isRenamingLayer}
                      className="h-8 w-8 flex items-center justify-center rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={closeLayerRename}
                      disabled={isRenamingLayer}
                      className="h-8 w-8 flex items-center justify-center rounded text-[var(--text-dim)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)] disabled:cursor-wait disabled:opacity-60"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {layerNameError && (
                    <div className="mt-1.5 text-[10px] font-semibold text-red-400">{layerNameError}</div>
                  )}
                </form>
              </>
            )}
            
            <div className="w-px h-4 bg-[var(--border-main)] mx-1" />
          </>
        )}

        {/* Popovers Container */}
        {activeMenu && (
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

            {activeMenu === 'visual' && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] p-2 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-2 px-2 py-2 text-[var(--text-muted)] border-b border-[var(--border-main)]">
                  <Languages size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Visual Layout</span>
                </div>
                <div className="pt-1 max-h-72 overflow-y-auto custom-scrollbar">
                  {VISUAL_LAYOUTS.map(layout => {
                    const active = normalizeVisualLayout(settings.visualLayout) === layout.id;
                    return (
                      <button
                        key={layout.id}
                        onClick={() => {
                          setVisualLayout(layout.id);
                          setActiveMenu(null);
                        }}
                        className={cn(
                          "w-full px-2.5 py-2 rounded-lg text-left transition-colors flex items-center justify-between gap-3",
                          active ? "bg-amber-500/10 text-amber-500" : "text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-[11px] font-bold">{layout.name}</span>
                          <span className="block text-[9px] text-[var(--text-muted)] truncate">{layout.description}</span>
                        </span>
                        <span className={cn(
                          "shrink-0 min-w-8 rounded border px-1.5 py-0.5 text-center text-[9px] font-black",
                          active ? "border-amber-500/40 bg-amber-500 text-zinc-950" : "border-[var(--border-main)] text-[var(--text-muted)]"
                        )}>
                          {layout.shortName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        {(appMode === 'remap' || editorMode === 'keymap') && (
          <>
            <button
              onClick={() => setActiveMenu(activeMenu === 'visual' ? null : 'visual')}
              className={cn(
                "p-2 rounded transition-all relative",
                activeMenu === 'visual' ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" : "bg-[var(--bg-app)] border border-[var(--border-main)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
              )}
              title="Visual Layout"
            >
              <Languages size={14} />
              <span className="absolute -right-1 -bottom-1 min-w-5 h-4 px-1 rounded-full bg-amber-500 text-zinc-950 text-[8px] font-black leading-4 border border-zinc-950">
                {VISUAL_LAYOUTS.find(layout => layout.id === normalizeVisualLayout(settings.visualLayout))?.shortName}
              </span>
            </button>
            <div className="w-px h-4 bg-[var(--bg-button)] mx-1" />
          </>
        )}
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
            onClick={() => handleZoom(-ZOOM_STEP)}
            className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-colors"
            title={t('zoom.zoomOut')}
          >
            <Minus size={14} />
          </button>
          <div className="w-12 text-center text-[10px] font-mono font-bold text-amber-500 select-none">
            {Math.round(transform.scale * 100)}%
          </div>
          <button 
            onClick={() => handleZoom(ZOOM_STEP)}
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
