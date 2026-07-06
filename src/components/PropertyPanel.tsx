'use client';

import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { PhysicalKey } from '@/types/keyboard';
import { cn } from '@/lib/utils';
import { 
  Trash2, 
  AlignStartVertical as AlignLeft, 
  AlignEndVertical as AlignRight, 
  AlignStartHorizontal as AlignTop, 
  AlignEndHorizontal as AlignBottom,
  AlignCenterVertical as AlignCenterHorizontal,
  AlignCenterHorizontal as AlignCenterVertical,
  AlignHorizontalDistributeCenter as DistributeHorizontal,
  AlignVerticalDistributeCenter as DistributeVertical,
  FlipHorizontal2,
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
  ArrowLeftRight,
  ArrowUpDown,
  ArrowRight,
  ArrowDown,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

import { PropertyInput, PropertySection, Divider } from './ui/PropertyComponents';
import { RightPanelEmptyState } from './RightPanelEmptyState';

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'top' | 'bottom';
};

export const PropertyPanel = () => {
  const { 
    keys, settings, editorSettings, selectedKeyIds, 
    updateKey, batchUpdateKeys, removeKey, 
    alignSelectedKeys, distributeSelectedKeys,
    mirrorCopyAxisMode, setMirrorCopyAxisMode
  } = useKeyboardStore();
  const { t } = useTranslation();

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const toggleMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const margin = 8;
    const gap = 4;
    const desiredHeight = 192;
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placement = spaceBelow >= 160 || spaceBelow >= spaceAbove ? 'bottom' : 'top';
    const availableHeight = placement === 'bottom' ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(96, Math.min(desiredHeight, availableHeight));

    setMenuPosition({
      top: placement === 'bottom'
        ? rect.bottom + gap
        : Math.max(margin, rect.top - maxHeight - gap),
      left: rect.left,
      width: rect.width,
      maxHeight,
      placement,
    });
    setOpenMenuId(id);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  if (selectedKeyIds.length === 0) {
    return (
      <RightPanelEmptyState message={t('common.selectKeysDesc')} />
    );
  }

  // Batch Edit Mode
  if (selectedKeyIds.length > 1) {
    const firstKey = keys.find(k => selectedKeyIds.includes(k.id));
    return (
      <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200" key={selectedKeyIds.join(',')}>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]/20 p-4">
          <div className="flex flex-col gap-4">
            <div className="w-fit px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold">
              {selectedKeyIds.length} {t('properties.keysUnit')}
            </div>
            <PropertySection title={t('properties.alignment')} icon={AlignLeft} className="w-full">
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

            <Divider orientation="horizontal" />

            <PropertySection title={t('properties.distribution')} icon={DistributeHorizontal} className="w-full">
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

            <Divider orientation="horizontal" />

            <PropertySection title={t('properties.mirrorCopy')} icon={FlipHorizontal2} className="w-full">
              <button
                onClick={() => setMirrorCopyAxisMode(!mirrorCopyAxisMode)}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1.5 p-3 rounded border text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all active:scale-95 group",
                  mirrorCopyAxisMode
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-500"
                    : "bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border-[var(--border-main)]"
                )}
                title={mirrorCopyAxisMode ? t('properties.cancelMirrorCopy') : t('properties.pickMirrorAxis')}
              >
                <FlipHorizontal2 size={16} className="group-hover:text-amber-500 transition-colors" />
                <span className="text-[8px] uppercase font-bold tracking-tighter">
                  {mirrorCopyAxisMode ? t('properties.cancel') : t('properties.pickMirrorAxis')}
                </span>
              </button>
            </PropertySection>

            <Divider orientation="horizontal" />

            <PropertySection title={t('properties.visibility')} icon={Eye} className="w-full">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.group')}</label>
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu('batch-group', e)}
                      className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                    >
                      <span className="truncate">{firstKey?.group ? (settings.layoutOptions[firstKey.group]?.name || firstKey.group) : t('properties.alwaysVisible')}</span>
                      <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'batch-group' && "rotate-180")} />
                    </button>

                    {openMenuId === 'batch-group' && menuPosition && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={closeMenu} />
                        <div
                          className={cn(
                            "fixed bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in",
                            menuPosition.placement === 'bottom' ? "slide-in-from-top-1" : "slide-in-from-bottom-1"
                          )}
                          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                        >
                          <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: menuPosition.maxHeight }}>
                            <button
                              onClick={() => {
                                batchUpdateKeys(selectedKeyIds, { group: undefined, option: 0 });
                                closeMenu();
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
                                  closeMenu();
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
                        onClick={(e) => toggleMenu('batch-choice', e)}
                        className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                      >
                        <span className="truncate">
                          {settings.layoutOptions[firstKey.group].type === 'toggle' 
                            ? (firstKey.option === 1 ? t('properties.on') : t('properties.off'))
                            : (settings.layoutOptions[firstKey.group].choices?.[firstKey.option ?? 0] || 'Choice ' + (firstKey.option ?? 0))}
                        </span>
                        <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'batch-choice' && "rotate-180")} />
                      </button>

                      {openMenuId === 'batch-choice' && menuPosition && (
                        <>
                          <div className="fixed inset-0 z-[100]" onClick={closeMenu} />
                          <div
                            className={cn(
                              "fixed bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in",
                              menuPosition.placement === 'bottom' ? "slide-in-from-top-1" : "slide-in-from-bottom-1"
                            )}
                            style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                          >
                            <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: menuPosition.maxHeight }}>
                              {settings.layoutOptions[firstKey.group].type === 'toggle' ? (
                                [0, 1].map(val => (
                                  <button
                                    key={val}
                                    onClick={() => {
                                      batchUpdateKeys(selectedKeyIds, { option: val });
                                      closeMenu();
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
                                      closeMenu();
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
  const selectedKeyIsEncoder = selectedKey.kind === 'encoder' || !!selectedKey.encoderId || selectedKey.encoderIndex !== undefined;

  const isMm = editorSettings.layoutUnit === 'mm';
  const scaleUnit = (v: number) => isMm ? Math.round(v * 19.05 * 100000) / 100000 : v;
  const parseUnit = (v: number) => isMm ? Math.round((v / 19.05) * 10000000) / 10000000 : v;
  const formatStep = (step: number) => isMm ? (step * 19.05).toString() : step.toString();
  const formatMin = (min: number) => isMm ? (min * 19.05).toString() : min.toString();
  const unitLabel = isMm ? 'mm' : 'u';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden animate-in fade-in duration-200" onMouseLeave={() => setFocusedField(null)}>
      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]/20 p-4" key={selectedKey.id}>
        <div className="flex flex-col gap-4">
          {/* Placement */}
          <PropertySection 
            title={t('properties.placement')} 
            icon={Move}
            className="w-full"
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <PropertyInput label={t('properties.xPos')} value={scaleUnit(selectedKey.x)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={MoveHorizontal} onFocus={() => setFocusedField('x')} onChange={(val: number) => updateKey(selectedKey.id, { x: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { x: parseUnit(val) }, true); }} />
                <PropertyInput label={t('properties.yPos')} value={scaleUnit(selectedKey.y)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={MoveVertical} onFocus={() => setFocusedField('y')} onChange={(val: number) => updateKey(selectedKey.id, { y: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { y: parseUnit(val) }, true); }} />
              </div>
              
              <div className="space-y-2">
                <PropertyInput label={t('properties.rotationAngle')} value={selectedKey.r} step="1" unit="deg" icon={UndoDot} onFocus={() => setFocusedField('r')} onChange={(val: number) => updateKey(selectedKey.id, { r: val })} onFinalize={(val: number) => { updateKey(selectedKey.id, { r: val }, true); }} />
                <div className="flex gap-3">
                  <PropertyInput label={t('properties.pivotX')} value={scaleUnit(selectedKey.rx)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={Crosshair} onFocus={() => setFocusedField('rx')} onChange={(val: number) => updateKey(selectedKey.id, { rx: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { rx: parseUnit(val) }, true); }} />
                  <PropertyInput label={t('properties.pivotY')} value={scaleUnit(selectedKey.ry)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={Crosshair} onFocus={() => setFocusedField('ry')} onChange={(val: number) => updateKey(selectedKey.id, { ry: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { ry: parseUnit(val) }, true); }} />
                </div>
              </div>
            </div>
          </PropertySection>

          <Divider orientation="horizontal" />

          {/* Dimension */}
          <PropertySection 
            title={t('properties.dimension')} 
            icon={Box}
            className="w-full"
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

                          {selectedKeyIsEncoder ? (
                            <circle
                              cx={80}
                              cy={40}
                              r={Math.min(mainW, mainH) / 2}
                              fill="none"
                              stroke={focusedField === 'w' || focusedField === 'h' ? "#f59e0b" : "currentColor"}
                              strokeWidth={focusedField === 'w' || focusedField === 'h' ? "2" : "1"}
                              className="text-[var(--border-main)] transition-all"
                            />
                          ) : (
                            <rect
                              x={startX} y={startY} width={mainW} height={mainH}
                              fill="none"
                              stroke={focusedField === 'w' || focusedField === 'h' ? "#f59e0b" : "currentColor"}
                              strokeWidth={focusedField === 'w' || focusedField === 'h' ? "2" : "1"}
                              className="text-[var(--border-main)] transition-all"
                              rx="2"
                            />
                          )}

                          {/* Polygonal Part */}
                          {!selectedKeyIsEncoder && (selectedKey.w2 !== undefined || selectedKey.h2 !== undefined || selectedKey.x2 || selectedKey.y2) && (
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
                <PropertyInput label={t('properties.width')} value={scaleUnit(selectedKey.w)} step={formatStep(0.25)} min={formatMin(0.5)} unit={unitLabel} icon={MoveHorizontal} onFocus={() => setFocusedField('w')} onChange={(val: number) => updateKey(selectedKey.id, { w: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { w: parseUnit(val) }, true); }} />
                <PropertyInput label={t('properties.height')} value={scaleUnit(selectedKey.h)} step={formatStep(0.25)} min={formatMin(0.5)} unit={unitLabel} icon={MoveVertical} onFocus={() => setFocusedField('h')} onChange={(val: number) => updateKey(selectedKey.id, { h: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { h: parseUnit(val) }, true); }} />
              </div>
            </div>
          </PropertySection>

          <Divider orientation="horizontal" />

          {!selectedKeyIsEncoder && (
            <>
              {/* Visual Guide */}
              <PropertySection
                title={t('properties.specialShapes')}
                icon={Maximize}
                className="w-full"
              >
                <div className="flex flex-col h-full space-y-4">
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <PropertyInput label={t('properties.widthSub')} value={scaleUnit(selectedKey.w2 ?? selectedKey.w)} step={formatStep(0.25)} min={formatMin(0.5)} unit={unitLabel} icon={ArrowLeftRight} onFocus={() => setFocusedField('w2')} onChange={(val: number) => updateKey(selectedKey.id, { w2: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { w2: parseUnit(val) }, true); }} />
                      <PropertyInput label={t('properties.heightSub')} value={scaleUnit(selectedKey.h2 ?? selectedKey.h)} step={formatStep(0.25)} min={formatMin(0.5)} unit={unitLabel} icon={ArrowUpDown} onFocus={() => setFocusedField('h2')} onChange={(val: number) => updateKey(selectedKey.id, { h2: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { h2: parseUnit(val) }, true); }} />
                    </div>
                    <div className="flex gap-3">
                      <PropertyInput label={t('properties.offsetXSub')} value={scaleUnit(selectedKey.x2 ?? 0)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={ArrowRight} onFocus={() => setFocusedField('x2')} onChange={(val: number) => updateKey(selectedKey.id, { x2: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { x2: parseUnit(val) }, true); }} />
                      <PropertyInput label={t('properties.offsetYSub')} value={scaleUnit(selectedKey.y2 ?? 0)} step={formatStep(editorSettings.gridSnap)} unit={unitLabel} icon={ArrowDown} onFocus={() => setFocusedField('y2')} onChange={(val: number) => updateKey(selectedKey.id, { y2: parseUnit(val) })} onFinalize={(val: number) => { updateKey(selectedKey.id, { y2: parseUnit(val) }, true); }} />
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

              <Divider orientation="horizontal" />
            </>
          )}

          {/* Visibility */}
          <PropertySection 
            title={t('properties.visibility')} 
            icon={Eye}
            className="w-full"
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase text-[var(--text-muted)] font-bold tracking-wider ml-1">{t('properties.group')}</label>
                <div className="relative">
                  <button
                    onClick={(e) => toggleMenu('single-group', e)}
                    className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                  >
                    <span className="truncate">{selectedKey.group ? (settings.layoutOptions[selectedKey.group]?.name || selectedKey.group) : t('properties.alwaysVisible')}</span>
                    <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'single-group' && "rotate-180")} />
                  </button>

                  {openMenuId === 'single-group' && menuPosition && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={closeMenu} />
                      <div
                        className={cn(
                          "fixed bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in",
                          menuPosition.placement === 'bottom' ? "slide-in-from-top-1" : "slide-in-from-bottom-1"
                        )}
                        style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                      >
                        <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: menuPosition.maxHeight }}>
                          <button
                            onClick={() => {
                              updateKey(selectedKey.id, { group: undefined, option: 0 });
                              closeMenu();
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
                                closeMenu();
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
                      onClick={(e) => toggleMenu('single-choice', e)}
                      className="w-full flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-3 py-1.5 text-xs font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn"
                    >
                      <span className="truncate">
                        {settings.layoutOptions[selectedKey.group].type === 'toggle' 
                          ? (selectedKey.option === 1 ? t('properties.on') : t('properties.off'))
                          : (settings.layoutOptions[selectedKey.group].choices?.[selectedKey.option ?? 0] || 'Choice ' + (selectedKey.option ?? 0))}
                      </span>
                      <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === 'single-choice' && "rotate-180")} />
                    </button>

                    {openMenuId === 'single-choice' && menuPosition && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={closeMenu} />
                        <div
                          className={cn(
                            "fixed bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in",
                            menuPosition.placement === 'bottom' ? "slide-in-from-top-1" : "slide-in-from-bottom-1"
                          )}
                          style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
                        >
                          <div className="p-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar" style={{ maxHeight: menuPosition.maxHeight }}>
                            {settings.layoutOptions[selectedKey.group].type === 'toggle' ? (
                              [0, 1].map(val => (
                                <button
                                  key={val}
                                  onClick={() => {
                                    updateKey(selectedKey.id, { option: val });
                                    closeMenu();
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
                                    closeMenu();
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
