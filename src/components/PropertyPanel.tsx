'use client';

import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { PhysicalKey } from '@/types/keyboard';
import { cn } from '@/lib/utils';
import { 
  Settings, 
  Trash2, 
  AlignStartVertical as AlignLeft, 
  AlignEndVertical as AlignRight, 
  AlignStartHorizontal as AlignTop, 
  AlignEndHorizontal as AlignBottom,
  AlignCenterVertical as AlignCenterHorizontal,
  AlignCenterHorizontal as AlignCenterVertical,
  AlignHorizontalDistributeCenter as DistributeHorizontal,
  AlignVerticalDistributeCenter as DistributeVertical,
  Move,
  MoveHorizontal,
  MoveVertical,
  Maximize,
  RotateCcw,
  UndoDot,
  Crosshair,
  Box,
  Eye,
  Type,
  MousePointer2,
  ArrowLeftRight,
  ArrowUpDown,
  ArrowRight,
  ArrowDown,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

import { PropertyInput, PropertySection, Divider } from './ui/PropertyComponents';

export const PropertyPanel = () => {
  const { 
    keys, settings, editorSettings, selectedKeyIds, 
    updateKey, batchUpdateKeys, removeKey, 
    alignSelectedKeys, distributeSelectedKeys 
  } = useKeyboardStore();
  const { t } = useTranslation();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (selectedKeyIds.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
            <Settings size={16} className="text-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('properties.title')}</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50 bg-[var(--bg-app)]/20 p-8">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-button)]/50 flex items-center justify-center text-[var(--text-dim)]">
            <MousePointer2 size={24} />
          </div>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed max-w-[160px]">
            {t('common.selectKeysDesc')}
          </p>
        </div>
      </div>
    );
  }

  // Batch Edit Mode
  if (selectedKeyIds.length > 1) {
    const firstKey = keys.find(k => selectedKeyIds.includes(k.id));
    return (
      <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200" key={selectedKeyIds.join(',')}>
        {/* Header */}
        <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
          <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
            <Settings size={16} className="text-amber-500" />
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('properties.batchTitle')}</span>
          </div>
          <div className="ml-4 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold">
            {selectedKeyIds.length} {t('properties.keysUnit')}
          </div>
        </div>

        <div className="flex-1 overflow-x-auto custom-scrollbar bg-[var(--bg-app)]/20 py-4">
          <div className="flex items-stretch w-fit min-w-max h-full">
            <PropertySection title={t('properties.alignment')} icon={AlignLeft} className="w-[300px]">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'left', icon: AlignLeft, label: 'left' },
                  { type: 'center-x', icon: AlignCenterHorizontal, label: 'center' },
                  { type: 'right', icon: AlignRight, label: 'right' },
                  { type: 'top', icon: AlignTop, label: 'top' },
                  { type: 'center-y', icon: AlignCenterVertical, label: 'middle' },
                  { type: 'bottom', icon: AlignBottom, label: 'bottom' },
                ].map(align => (
                  <button 
                    key={align.type}
                    onClick={() => alignSelectedKeys(align.type as any)} 
                    className="flex flex-col items-center gap-1.5 p-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border-main)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all active:scale-95 group" 
                    title={`Align ${t('properties.' + align.label)}`}
                  >
                    <align.icon size={16} className="group-hover:text-amber-500 transition-colors" />
                    <span className="text-[8px] uppercase font-bold tracking-tighter">{t('properties.' + align.label)}</span>
                  </button>
                ))}
              </div>
            </PropertySection>

            <Divider />

            <PropertySection title={t('properties.distribution')} icon={DistributeHorizontal} className="w-[220px]">
              <div className="grid grid-cols-2 gap-2 h-full min-h-[100px]">
                <button 
                  onClick={() => distributeSelectedKeys('horizontal')} 
                  className="flex flex-col items-center justify-center gap-1.5 p-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border-main)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all disabled:opacity-30 disabled:cursor-not-allowed group h-full" 
                  disabled={selectedKeyIds.length < 3} 
                  title={t('properties.horizontal')}
                >
                  <DistributeHorizontal size={16} className="group-hover:text-amber-500 transition-colors" />
                  <span className="text-[8px] uppercase font-bold tracking-tighter">{t('properties.horizontal')}</span>
                </button>
                <button 
                  onClick={() => distributeSelectedKeys('vertical')} 
                  className="flex flex-col items-center justify-center gap-1.5 p-2 bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] rounded border border-[var(--border-main)] text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all disabled:opacity-30 disabled:cursor-not-allowed group h-full" 
                  disabled={selectedKeyIds.length < 3} 
                  title={t('properties.vertical')}
                >
                  <DistributeVertical size={16} className="group-hover:text-amber-500 transition-colors" />
                  <span className="text-[8px] uppercase font-bold tracking-tighter">{t('properties.vertical')}</span>
                </button>
              </div>
            </PropertySection>

            <Divider />

            <PropertySection title={t('properties.visibility')} icon={Eye} className="w-[300px]">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.group')}</label>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === 'batch-group' ? null : 'batch-group')}
                      className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                    >
                      <span className="truncate">{firstKey?.group ? (settings.layoutOptions[firstKey.group]?.name || firstKey.group) : t('properties.alwaysVisible')}</span>
                      <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'batch-group' && "rotate-180")} />
                    </button>

                    {openMenuId === 'batch-group' && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute top-auto bottom-full mb-1 left-0 right-0 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-bottom-1">
                          <div className="p-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                            <button
                              onClick={() => {
                                batchUpdateKeys(selectedKeyIds, { group: undefined, option: 0 });
                                setOpenMenuId(null);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                !firstKey?.group ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                              )}
                            >
                              {t('properties.alwaysVisible')}
                            </button>
                            {Object.entries(settings.layoutOptions).map(([id, group]) => (
                              <button
                                key={id}
                                onClick={() => {
                                  batchUpdateKeys(selectedKeyIds, { group: id, option: 0 });
                                  setOpenMenuId(null);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                  firstKey?.group === id ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                                )}
                              >
                                {group.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {firstKey?.group && settings.layoutOptions[firstKey.group] && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.choice')}</label>
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === 'batch-choice' ? null : 'batch-choice')}
                        className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                      >
                        <span className="truncate">
                          {settings.layoutOptions[firstKey.group].type === 'toggle' 
                            ? (firstKey.option === 1 ? t('properties.on') : t('properties.off'))
                            : (settings.layoutOptions[firstKey.group].choices?.[firstKey.option ?? 0] || 'Choice ' + (firstKey.option ?? 0))}
                        </span>
                        <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'batch-choice' && "rotate-180")} />
                      </button>

                      {openMenuId === 'batch-choice' && (
                        <>
                          <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute top-auto bottom-full mb-1 left-0 right-0 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-bottom-1">
                            <div className="p-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                              {settings.layoutOptions[firstKey.group].type === 'toggle' ? (
                                [0, 1].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => {
                                      batchUpdateKeys(selectedKeyIds, { option: val });
                                      setOpenMenuId(null);
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                      (firstKey.option ?? 0) === val ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                                    )}
                                  >
                                    {val === 1 ? t('properties.on') : t('properties.off')}
                                  </button>
                                ))
                              ) : (
                                settings.layoutOptions[firstKey.group].choices?.map((choice, i) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      batchUpdateKeys(selectedKeyIds, { option: i });
                                      setOpenMenuId(null);
                                    }}
                                    className={cn(
                                      "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                      (firstKey.option ?? 0) === i ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                                    )}
                                  >
                                    {choice}
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </PropertySection>
          </div>
        </div>
      </div>
    );
  }

  // Single Edit Mode
  const selectedKey = keys.find(k => k.id === selectedKeyIds[0]);
  if (!selectedKey) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200" onMouseLeave={() => setFocusedField(null)}>
      {/* Header */}
      <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
          <Settings size={16} className="text-amber-500" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('properties.title')}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-x-auto custom-scrollbar bg-[var(--bg-app)]/20 py-4" key={selectedKey.id}>
        <div className="flex items-stretch w-fit min-w-max h-full">
          {/* Placement */}
          <PropertySection 
            title={t('properties.placement')} 
            icon={Move}
            className="w-[300px]"
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <PropertyInput label={t('properties.xPos')} value={selectedKey.x} step={editorSettings.gridSnap.toString()} icon={MoveHorizontal} onFocus={() => setFocusedField('x')} onChange={(val: number) => updateKey(selectedKey.id, { x: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { x: val }, true); }} />
                <PropertyInput label={t('properties.yPos')} value={selectedKey.y} step={editorSettings.gridSnap.toString()} icon={MoveVertical} onFocus={() => setFocusedField('y')} onChange={(val: number) => updateKey(selectedKey.id, { y: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { y: val }, true); }} />
              </div>
              
              <div className="space-y-2">
                <PropertyInput label={t('properties.rotationAngle')} value={selectedKey.r} step="1" icon={UndoDot} onFocus={() => setFocusedField('r')} onChange={(val: number) => updateKey(selectedKey.id, { r: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { r: val }, true); }} />
                <div className="flex gap-3">
                  <PropertyInput label={t('properties.pivotX')} value={selectedKey.rx} step={editorSettings.gridSnap.toString()} icon={Crosshair} onFocus={() => setFocusedField('rx')} onChange={(val: number) => updateKey(selectedKey.id, { rx: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { rx: val }, true); }} />
                  <PropertyInput label={t('properties.pivotY')} value={selectedKey.ry} step={editorSettings.gridSnap.toString()} icon={Crosshair} onFocus={() => setFocusedField('ry')} onChange={(val: number) => updateKey(selectedKey.id, { ry: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { ry: val }, true); }} />
                </div>
              </div>
            </div>
          </PropertySection>

          <Divider />

          {/* Dimension */}
          <PropertySection 
            title={t('properties.dimension')} 
            icon={Box}
            className="w-[300px]"
          >
            <div className="space-y-4">
              {/* SVG Visual Guide moved here */}
              <div className="relative w-full h-[94px] bg-[var(--bg-app)]/30 flex items-center justify-center overflow-hidden border border-[var(--border-main)]/50 rounded group/diagram">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                
                <svg viewBox="0 0 160 80" className="w-full h-full drop-shadow-2xl opacity-80 group-hover/diagram:opacity-100 transition-opacity">
                   {/* Reference Grid */}
                   <path d="M 0 40 H 160 M 80 0 V 80" stroke="currentColor" strokeWidth="0.2" className="text-zinc-800" />
                   {(() => {
                      const scale = 22; 
                      const mainW = selectedKey.w * scale;
                      const mainH = selectedKey.h * scale;
                      const startX = 80 - mainW / 2;
                      const startY = 40 - mainH / 2;

                      return (
                        <>
                          {/* Main Rectangle Helper Lines */}
                          <g className={cn("transition-opacity duration-300", focusedField === 'w' || focusedField === 'h' ? "opacity-100" : "opacity-30")}>
                            <line x1={startX} y1={startY} x2={startX + mainW} y2={startY} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 1" />
                            <line x1={startX} y1={startY + mainH} x2={startX + mainW} y2={startY + mainH} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 1" />
                            <line x1={startX} y1={startY} x2={startX} y2={startY + mainH} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 1" />
                            <line x1={startX + mainW} y1={startY} x2={startX + mainW} y2={startY + mainH} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 1" />
                          </g>

                          {/* Main Rectangle */}
                          <rect 
                            x={startX} y={startY} width={mainW} height={mainH} 
                            fill="none" 
                            stroke={focusedField === 'w' || focusedField === 'h' ? "#f59e0b" : "currentColor"} 
                            strokeWidth={focusedField === 'w' || focusedField === 'h' ? "2" : "1"} 
                            className="text-[var(--border-main)] transition-all"
                            rx="2" 
                          />

                          {/* Polygonal Part */}
                          {(selectedKey.w2 !== undefined || selectedKey.h2 !== undefined || selectedKey.x2 || selectedKey.y2) && (
                            <g className="transition-all">
                              <rect 
                                x={startX + (selectedKey.x2 || 0) * scale} 
                                y={startY + (selectedKey.y2 || 0) * scale} 
                                width={(selectedKey.w2 || selectedKey.w) * scale} 
                                height={(selectedKey.h2 || selectedKey.h) * scale} 
                                fill="none" 
                                stroke={['w2', 'h2', 'x2', 'y2'].includes(focusedField || '') ? "#f59e0b" : "currentColor"} 
                                strokeWidth={['w2', 'h2', 'x2', 'y2'].includes(focusedField || '') ? "1.5" : "0.8"} 
                                strokeDasharray="2 1"
                                className="text-[var(--text-muted)] opacity-60"
                              />
                            </g>
                          )}

                          {/* Pivot Marker */}
                          <g className={cn("transition-all", focusedField === 'rx' || focusedField === 'ry' ? "scale-150 origin-center" : "")} transform={`translate(${startX + (selectedKey.rx - selectedKey.x) * scale}, ${startY + (selectedKey.ry - selectedKey.y) * scale})`}>
                            <circle cx="0" cy="0" r="2.5" fill="#f59e0b" className="animate-pulse" />
                            <circle cx="0" cy="0" r="1" fill="white" />
                          </g>
                        </>
                      );
                   })()}
                </svg>
              </div>

              <div className="flex gap-3">
                <PropertyInput label={t('properties.width')} value={selectedKey.w} step="0.25" min="0.5" icon={MoveHorizontal} onFocus={() => setFocusedField('w')} onChange={(val: number) => updateKey(selectedKey.id, { w: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { w: val }, true); }} />
                <PropertyInput label={t('properties.height')} value={selectedKey.h} step="0.25" min="0.5" icon={MoveVertical} onFocus={() => setFocusedField('h')} onChange={(val: number) => updateKey(selectedKey.id, { h: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { h: val }, true); }} />
              </div>
            </div>
          </PropertySection>

          <Divider />

          {/* Visual Guide */}
          <PropertySection 
            title={t('properties.specialShapes')} 
            icon={Maximize}
            className="w-[300px]"
          >
            <div className="flex flex-col h-full space-y-4">
              <div className="space-y-3">
                <div className="flex gap-3">
                  <PropertyInput label={t('properties.widthSub')} value={selectedKey.w2 ?? selectedKey.w} step="0.25" min="0.5" icon={ArrowLeftRight} onFocus={() => setFocusedField('w2')} onChange={(val: number) => updateKey(selectedKey.id, { w2: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { w2: val }, true); }} />
                  <PropertyInput label={t('properties.heightSub')} value={selectedKey.h2 ?? selectedKey.h} step="0.25" min="0.5" icon={ArrowUpDown} onFocus={() => setFocusedField('h2')} onChange={(val: number) => updateKey(selectedKey.id, { h2: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { h2: val }, true); }} />
                </div>
                <div className="flex gap-3">
                  <PropertyInput label={t('properties.offsetXSub')} value={selectedKey.x2 ?? 0} step={editorSettings.gridSnap.toString()} icon={ArrowRight} onFocus={() => setFocusedField('x2')} onChange={(val: number) => updateKey(selectedKey.id, { x2: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { x2: val }, true); }} />
                  <PropertyInput label={t('properties.offsetYSub')} value={selectedKey.y2 ?? 0} step={editorSettings.gridSnap.toString()} icon={ArrowDown} onFocus={() => setFocusedField('y2')} onChange={(val: number) => updateKey(selectedKey.id, { y2: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { y2: val }, true); }} />
                </div>
              </div>

              <div className="flex items-center gap-3 p-2 bg-[var(--bg-app)]/50 rounded border border-[var(--border-main)]/50 group hover:border-amber-500/30 transition-colors shrink-0">
                <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors bg-[var(--bg-button)]">
                  <input 
                    type="checkbox" 
                    checked={selectedKey.stepped ?? false}
                    onChange={(e) => { updateKey(selectedKey.id, { stepped: e.target.checked }); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    selectedKey.stepped ? "left-[18px] bg-amber-500" : "left-[2px] bg-zinc-400"
                  )} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <Layers size={10} className={cn("transition-colors", selectedKey.stepped ? "text-amber-500" : "text-[var(--text-dim)]")} />
                    <span className="text-xs font-bold text-[var(--text-main)] leading-none">{t('properties.stepped')}</span>
                  </div>
                </div>
              </div>
            </div>
          </PropertySection>

          <Divider />

          {/* Visibility */}
          <PropertySection 
            title={t('properties.visibility')} 
            icon={Eye}
            className="w-[300px]"
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.group')}</label>
                <div className="relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === 'single-group' ? null : 'single-group')}
                    className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                  >
                    <span className="truncate">{selectedKey.group ? (settings.layoutOptions[selectedKey.group]?.name || selectedKey.group) : t('properties.alwaysVisible')}</span>
                    <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'single-group' && "rotate-180")} />
                  </button>

                  {openMenuId === 'single-group' && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute top-auto bottom-full mb-1 left-0 right-0 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-bottom-1">
                        <div className="p-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                          <button
                            onClick={() => {
                              updateKey(selectedKey.id, { group: undefined, option: 0 });
                              setOpenMenuId(null);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                              !selectedKey.group ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                            )}
                          >
                            {t('properties.alwaysVisible')}
                          </button>
                          {Object.entries(settings.layoutOptions).map(([id, group]) => (
                            <button
                              key={id}
                              onClick={() => {
                                updateKey(selectedKey.id, { group: id, option: 0 });
                                setOpenMenuId(null);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                selectedKey.group === id ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                              )}
                            >
                              {group.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {selectedKey.group && settings.layoutOptions[selectedKey.group] && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.choice')}</label>
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === 'single-choice' ? null : 'single-choice')}
                      className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                    >
                      <span className="truncate">
                        {settings.layoutOptions[selectedKey.group].type === 'toggle' 
                          ? (selectedKey.option === 1 ? t('properties.on') : t('properties.off'))
                          : (settings.layoutOptions[selectedKey.group].choices?.[selectedKey.option ?? 0] || 'Choice ' + (selectedKey.option ?? 0))}
                      </span>
                      <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'single-choice' && "rotate-180")} />
                    </button>

                    {openMenuId === 'single-choice' && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute top-auto bottom-full mb-1 left-0 right-0 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-bottom-1">
                          <div className="p-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                            {settings.layoutOptions[selectedKey.group].type === 'toggle' ? (
                              [0, 1].map(val => (
                                <button
                                  key={val}
                                  onClick={() => {
                                    updateKey(selectedKey.id, { option: val });
                                    setOpenMenuId(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                    (selectedKey.option ?? 0) === val ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                                  )}
                                 >
                                  {val === 1 ? t('properties.on') : t('properties.off')}
                                </button>
                              ))
                            ) : (
                              settings.layoutOptions[selectedKey.group].choices?.map((choice, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    updateKey(selectedKey.id, { option: i });
                                    setOpenMenuId(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                    (selectedKey.option ?? 0) === i ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                                  )}
                                >
                                  {choice}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </PropertySection>
        </div>
      </div>
    </div>
  );
};
