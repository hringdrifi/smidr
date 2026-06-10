'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { sortKeys } from '@/lib/sorting';
import { KEYCODES, Keycode, VIAL_TABS, KeycodeCategory } from '@/lib/keycodes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Keyboard, ChevronLeft, ChevronRight, Layers2 as LayersIcon, MousePointer2 } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalAction, UniversalKey } from '@/types/actions';
import { applyVisualLayoutToKeycode } from '@/lib/visual-layouts';
import { getKeycodeSupport, KeycodeSupportTarget } from '@/lib/keycode-support';
import { getFirmwareMatrixPosition } from '@/lib/matrix-utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SUPPORT_TARGETS: Array<{ id: KeycodeSupportTarget; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'via', label: 'VIA' },
  { id: 'vial', label: 'Vial' },
  { id: 'zmk', label: 'ZMK' },
];

export const KeycodePanel = () => {
  const { 
    keys, selectedKeyIds, setKeycode, setSelectedKeycode, setSelectedKeyIds, currentLayer, 
    editorSettings, settings, remoteKeymap,
    connectedDevice, deviceCapabilities, appMode, zmkTapDanceIds, remoteTapDances,
    updateEncoder, encoderActionDirection
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<KeycodeCategory>('Basic');
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [tapSearchQuery, setTapSearchQuery] = useState('');
  const [supportTarget, setSupportTarget] = useState<KeycodeSupportTarget>('all');
  const tabContainerRef = useRef<HTMLDivElement>(null);
  const showSupportTargetFilter = appMode === 'design';

  const layerDescription = (key: string, layer: number) =>
    t(`keycodeDescriptions.${key}`).replace('{layer}', String(layer));

  const layersCount = settings.layers || 4;
  const isZmkRemap = appMode === 'remap' && connectedDevice?.protocolType === 'zmk';
  const isVialRemap = appMode === 'remap' && connectedDevice?.protocolType === 'vial';
  const tapDanceKeycodes = isVialRemap
    ? remoteTapDances.map((td) => ({ code: `TD_${td.id}`, label: `TD${td.id}`, category: 'Tap Dance' as const, description: `Tap Dance ${td.id}` }))
    : isZmkRemap
    ? zmkTapDanceIds.map((id) => ({ code: `TD_${id}`, label: `TD${id}`, category: 'Tap Dance' as const, description: `Smiðr Tap Dance ${id}` }))
    : null;
  let filteredKeycodes: Keycode[] = activeTab === 'Layers' 
    ? [
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `MO(${i})`, label: `MO(${i})`, category: 'Layers' as const, description: layerDescription('layerMomentary', i) })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `TG(${i})`, label: `TG(${i})`, category: 'Layers' as const, description: layerDescription('layerToggle', i) })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `TO(${i})`, label: `TO(${i})`, category: 'Layers' as const, description: layerDescription('layerDirect', i) })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `LT(${i})`, label: `LT(${i})`, category: 'Layers' as const, description: layerDescription('layerTap', i) })),
      ]
    : activeTab === 'Tap Dance' && tapDanceKeycodes
    ? tapDanceKeycodes
    : KEYCODES.filter(k => k.category === activeTab).map(k => applyVisualLayoutToKeycode(k, settings.visualLayout));



  useEffect(() => {
    const checkOverflow = () => {
      if (tabContainerRef.current) {
        const { scrollWidth, clientWidth } = tabContainerRef.current;
        setIsOverflowing(scrollWidth > clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, []);

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = keys.find(k => k.id === selectedKeyId);
  const selectedEncoder = selectedKey?.encoderId && appMode === 'design'
    ? (settings.encoders || []).find(encoder => encoder.id === selectedKey.encoderId)
    : null;
  const hasEncoderButtonMatrix = selectedKey?.row !== undefined && selectedKey?.col !== undefined;
  const effectiveEncoderActionDirection = selectedEncoder && encoderActionDirection === 'button' && !hasEncoderButtonMatrix
    ? 'clockwise'
    : encoderActionDirection;
  const encoderRotationDirection = effectiveEncoderActionDirection === 'button' ? null : effectiveEncoderActionDirection;
  const isEncoderRotationTarget = !!selectedEncoder && !!encoderRotationDirection;
  const hasSelectedKey = selectedKeyIds.length > 0;
  const selectedFirmwarePosition = selectedKey
    ? getFirmwareMatrixPosition(settings, selectedKey, keys)
    : undefined;
  const selectedRemoteIndex = selectedKey?.zmkPosition ?? (
    selectedFirmwarePosition ? selectedFirmwarePosition.row * 32 + selectedFirmwarePosition.col : undefined
  );

  let action: UniversalAction = { action: 'trans' };
  if (selectedKey) {
    if (isEncoderRotationTarget) {
      action = selectedEncoder.keymap?.[currentLayer]?.[encoderRotationDirection] || { action: 'trans' };
    } else if (appMode === 'remap') {
      if (selectedRemoteIndex !== undefined) {
        action = remoteKeymap[currentLayer]?.[selectedRemoteIndex] || { action: 'trans' };
      }
    } else {
      action = selectedKey.keymap?.[currentLayer] || { action: 'trans' };
    }
  }

  const isLT = action.action === 'lt';
  const ltLayer = action.action === 'lt' ? action.layerId : 1;
  const ltKc = action.action === 'lt' 
    ? (action.tapAction.action === 'tap' ? action.tapAction.keycode : action.tapAction.action)
    : 'trans';

  const updateSelectedAction = (newAction: UniversalAction) => {
    if (selectedKeyIds.length === 1 && isEncoderRotationTarget && selectedEncoder) {
      updateEncoder(selectedEncoder.id!, {
        keymap: {
          ...(selectedEncoder.keymap || {}),
          [currentLayer]: {
            ...(selectedEncoder.keymap?.[currentLayer] || {}),
            [encoderRotationDirection]: newAction,
          },
        },
      });
      return;
    }
    setSelectedKeycode(newAction);
  };

  const getDefaultAnyAction = (): UniversalAction => {
    const protocol = connectedDevice?.protocolType === 'zmk'
      ? 'zmk'
      : connectedDevice?.protocolType === 'vial'
      ? 'vial'
      : connectedDevice?.protocolType === 'via'
      ? 'via'
      : 'qmk';

    return {
      action: 'custom',
      protocol,
      rawCode: protocol === 'zmk' ? '&none' : '0x0000',
      label: 'Any'
    };
  };

  const handleLtLayerChange = (newLayer: number) => {
    const newAction: UniversalAction = {
      action: 'lt',
      layerId: newLayer,
      tapAction: action.action === 'lt' ? action.tapAction : { action: 'trans' }
    };
    updateSelectedAction(newAction);
  };

  const handleLtKcChange = (newKc: string) => {
    let tapAction: UniversalAction;
    if (newKc === 'transparent') {
      tapAction = { action: 'trans' };
    } else if (newKc === 'none') {
      tapAction = { action: 'none' };
    } else {
      tapAction = { action: 'tap', keycode: newKc as UniversalKey };
    }

    const newAction: UniversalAction = {
      action: 'lt',
      layerId: ltLayer,
      tapAction: tapAction
    };
    updateSelectedAction(newAction);
  };

  const handleKeycodeClick = (code: string) => {
    if (!hasSelectedKey) return;
    
    const isNormalKeycode = !code.startsWith('MO(') && 
                            !code.startsWith('TG(') && 
                            !code.startsWith('TO(') && 
                            !code.startsWith('LT(') && 
                            code !== 'any' &&
                            !code.startsWith('MACRO_') &&
                            !code.startsWith('TD_');

    if (isNormalKeycode && (action.action === 'lt' || action.action === 'mt' || (action.action === 'tap' && action.mods !== undefined))) {
      let clickedAction: UniversalAction;
      if (code === 'transparent') {
        clickedAction = { action: 'trans' };
      } else if (code === 'none') {
        clickedAction = { action: 'none' };
      } else if (code === 'any') {
        clickedAction = getDefaultAnyAction();
      } else {
        clickedAction = { action: 'tap', keycode: code as UniversalKey };
      }

      if (action.action === 'lt' || action.action === 'mt') {
        updateSelectedAction({ ...action, tapAction: clickedAction });
      } else if (action.action === 'tap' && action.mods !== undefined) {
        const targetKey = clickedAction.action === 'tap' 
          ? clickedAction.keycode 
          : (clickedAction.action === 'none' ? 'NO' : 'TRNS');
        updateSelectedAction({ ...action, keycode: targetKey as any });
      }
    } else {
      let clickedAction: UniversalAction;

      if (code === 'transparent') {
        clickedAction = { action: 'trans' };
      } else if (code === 'none') {
        clickedAction = { action: 'none' };
      } else if (code === 'any') {
        clickedAction = getDefaultAnyAction();
      } else if (code.startsWith('MO(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { action: 'mo', layerId };
      } else if (code.startsWith('TG(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { action: 'tg', layerId };
      } else if (code.startsWith('TO(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { action: 'to', layerId };
      } else if (code.startsWith('LT(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { action: 'lt', layerId, tapAction: { action: 'trans' } };
      } else if (code.startsWith('MACRO_')) {
        const macroId = parseInt(code.split('_')[1] || '0', 10);
        clickedAction = { action: 'macro', macroId };
      } else if (code.startsWith('TD_')) {
        const tapDanceId = parseInt(code.split('_')[1] || '0', 10);
        clickedAction = { action: 'td', tapDanceId };
      } else {
        clickedAction = { action: 'tap', keycode: code as UniversalKey };
      }

      updateSelectedAction(clickedAction);
    }

    if (selectedKeyIds.length === 1 && !selectedEncoder) {
      const visKeys = keys.filter(k => !k.group || (settings.activeOptions[k.group] ?? 0) === k.option);
      const sortedKeys = sortKeys(visKeys, editorSettings.sortThresholdY);
      
      const lastSelectedIndex = Math.max(...selectedKeyIds.map(id => sortedKeys.findIndex(k => k.id === id)));
      if (lastSelectedIndex !== -1 && sortedKeys.length > 0) {
        const nextIndex = (lastSelectedIndex + 1) % sortedKeys.length;
        setSelectedKeyIds([sortedKeys[nextIndex].id!]);
      }
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
      const scrollAmount = 150;
      tabContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const isPhysicalTab = activeTab === 'Basic' || activeTab === 'ISO/JIS';
  const rows = isPhysicalTab ? Array.from(new Set(filteredKeycodes.map(k => k.row ?? 0))).sort((a, b) => a - b) : [0];

  const U = 54;
  const G = 4;
  const BASIC_UNIT = U;

  const calcWidth = (w: number) => (w * U) + (w - 1) * G;
  const calcMargin = (s: number) => s * (U + G);

  const selectKeycodes = KEYCODES
    .filter(k => k.category !== 'Layers' && k.code !== 'ISO_ENT_GHOST')
    .map(k => applyVisualLayoutToKeycode(k, settings.visualLayout));
  const filteredSelectKeycodes = selectKeycodes.filter(k => 
    k.code.toLowerCase().includes(tapSearchQuery.toLowerCase()) || 
    k.label.toLowerCase().includes(tapSearchQuery.toLowerCase())
  );

  const isTabSupported = (tab: KeycodeCategory) => {
    if (!deviceCapabilities) return true; // Offline design mode: assume support
    if (tab === 'Macro') return deviceCapabilities.hasMacros;
    if (tab === 'Lighting') return deviceCapabilities.hasLighting;
    return true;
  };

  const getKeycodeTitle = (k: Keycode, support: ReturnType<typeof getKeycodeSupport>) => {
    if (!support.supported) return `${k.code} (${support.reason})`;
    const translatedDescription = t(`keycodeDescriptions.${k.code}`);
    return translatedDescription === `keycodeDescriptions.${k.code}`
      ? (k.description || k.code)
      : translatedDescription;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 pr-4 shrink-0">
        <div className="flex items-center gap-2 px-4 py-3 border-r border-[var(--border-main)] shrink-0">
          <Keyboard size={16} className="text-amber-500" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('keycode.palette')}</span>
        </div>

        <div ref={tabContainerRef} className="flex-1 flex overflow-hidden no-scrollbar items-end h-full">
          {VIAL_TABS.map(tab => {
            const isSupported = isTabSupported(tab);
            const isDisabled = !isSupported;
            return (
              <button
                key={tab}
                disabled={isDisabled}
                onClick={() => { setActiveTab(tab); }}
                className={cn(
                  "px-6 py-3 text-xs font-bold transition-all border-r border-[var(--border-main)] shrink-0 relative",
                  activeTab === tab ? "bg-[var(--bg-panel)] text-amber-500" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)]/50 hover:text-[var(--text-main)]",
                  isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[var(--text-muted)]"
                )}
              >
                <span className="flex items-center gap-1.5">
                  {t(`keycodeTabs.${tab}`)}
                  {!isSupported && (
                    <span className="text-[7px] leading-none px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30 uppercase tracking-tighter shrink-0">
                      Off
                    </span>
                  )}
                </span>
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
              </button>
            );
          })}
        </div>

        {showSupportTargetFilter && (
          <div className="ml-3 flex items-center rounded border border-[var(--border-main)] bg-[var(--bg-panel)] p-0.5 shrink-0">
            {SUPPORT_TARGETS.map(target => (
              <button
                key={target.id}
                type="button"
                onClick={() => setSupportTarget(target.id)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded transition-colors",
                  supportTarget === target.id
                    ? "bg-amber-500 text-zinc-950"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                )}
              >
                {target.label}
              </button>
            ))}
          </div>
        )}

        {isOverflowing && (
          <div className="flex items-center border-l border-[var(--border-main)] shrink-0 bg-[var(--bg-app)]/50">
            <button onClick={() => scrollTabs('left')} className="p-3 text-[var(--text-muted)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scrollTabs('right')} className="p-3 text-[var(--text-muted)] hover:text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-colors border-l border-[var(--border-main)]">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area: Sidebar + Grid */}
      <div className="flex-1 flex overflow-hidden">


        {/* Grid Area */}
        <div className="relative flex-1 overflow-auto p-4 custom-scrollbar bg-[var(--bg-app)]/20">
          {!hasSelectedKey && (
            <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center">
              <div className="flex max-w-[min(520px,calc(100vw-2rem))] items-center gap-3 rounded border border-[var(--border-main)] bg-[var(--bg-hover)]/95 px-3 py-2 text-left shadow-sm backdrop-blur">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[var(--bg-panel)] text-[var(--text-muted)]">
                  <MousePointer2 size={15} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-main)]">
                    {t('keycode.selectKeyPrompt')}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium leading-snug text-[var(--text-muted)]">
                    {t('keycode.selectKeyDesc')}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={cn(
            "mx-auto w-fit min-w-max pb-4 flex flex-col gap-1",
            !isPhysicalTab && "grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14 gap-1 justify-start"
          )}>
            {isPhysicalTab ? (
              rows.map(rowIdx => (
                <div key={rowIdx} className="flex gap-1 justify-start">
                  {filteredKeycodes
                    .filter(k => k.row === rowIdx)
                    .map((k, idx) => {
                      if (k.code === 'ISO_ENT_GHOST') {
                        return <div key={idx} style={{ width: `${calcWidth(k.width ?? 1.0)}px` }} className="h-12 shrink-0" />;
                      }

                      const isIsoEnter = activeTab === 'ISO/JIS' && k.code === 'ENT' && k.w2 !== undefined && k.h2 !== undefined;
                      const w = calcWidth(k.width ?? 1.0);
                      const h = isIsoEnter ? (2 * 48 + G) : 48;
                      const support = getKeycodeSupport(k.code, showSupportTargetFilter ? supportTarget : 'all');
                      const isKeyDisabled = !hasSelectedKey || !support.supported;
                      const title = getKeycodeTitle(k, support);

                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            width: `${w}px`,
                            marginLeft: k.spacer ? `${calcMargin(k.spacer)}px` : undefined 
                          }} 
                          className={cn(
                            "h-12 shrink-0 relative",
                            isIsoEnter && "z-20 overflow-visible",
                            isIsoEnter && !isKeyDisabled && "group",
                            isIsoEnter && isKeyDisabled && "opacity-30 grayscale"
                          )}
                        >
                          {isIsoEnter && (
                            <svg
                              aria-hidden
                              className="absolute top-0 left-0 z-10 pointer-events-none overflow-visible drop-shadow-sm"
                              width={w}
                              height={h}
                            >
                              <path
                                d={`
                                  M 4,0.5 
                                  H ${w-4} Q ${w-0.5},0.5 ${w-0.5},4 
                                  V ${h-4} Q ${w-0.5},${h-0.5} ${w-4},${h-0.5} 
                                  H ${w*0.1667+4.5} Q ${w*0.1667+0.5},${h-0.5} ${w*0.1667+0.5},${h-4} 
                                  V 52.5 Q ${w*0.1667+0.5},48.5 ${w*0.1667-3.5},48.5 
                                  H 4 Q 0.5,48.5 0.5,44.5 
                                  V 4 Q 0.5,0.5 4,0.5 
                                  Z
                                `}
                                className={cn(
                                  "fill-[var(--bg-panel)] stroke-[var(--border-main)] transition-colors",
                                  hasSelectedKey && "group-hover:fill-[var(--bg-hover)]"
                                )}
                                strokeWidth="1"
                              />
                            </svg>
                          )}
                          <button
                            onClick={() => handleKeycodeClick(k.code)}
                            disabled={isKeyDisabled}
                            title={title}
                            style={{ 
                              width: `${w}px`,
                              height: `${h}px`,
                              zIndex: isIsoEnter ? 20 : 1,
                              clipPath: isIsoEnter ? 'polygon(0% 0%, 100% 0%, 100% 100%, 16.67% 100%, 16.67% 52%, 0% 52%)' : undefined
                            }}
                            className={cn(
                              "flex items-center justify-center transition-colors shrink-0 rounded overflow-visible",
                              isIsoEnter ? "absolute top-0 left-0 bg-transparent" : "h-12 border border-[var(--border-main)] shadow-sm bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)]",
                              isIsoEnter && "items-start pt-6",
                              !isIsoEnter && !isKeyDisabled && "cursor-pointer active:scale-95 group",
                              !isIsoEnter && isKeyDisabled && "opacity-30 grayscale cursor-not-allowed",
                              isIsoEnter && !isKeyDisabled && "cursor-pointer active:scale-95",
                              isIsoEnter && isKeyDisabled && "cursor-not-allowed"
                            )}
                          >
                            {isIsoEnter ? (
                              <span className="relative z-10 text-[12px] font-bold transition-colors leading-tight px-1 text-center whitespace-pre-line">
                                {k.label}
                              </span>
                            ) : (
                              <span className="text-[12px] font-bold transition-colors leading-tight px-1 text-center whitespace-pre-line">
                                {k.label}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                </div>
              ))
            ) : (
            filteredKeycodes.map(k => {
                const support = getKeycodeSupport(k.code, showSupportTargetFilter ? supportTarget : 'all');
                const isKeyDisabled = !hasSelectedKey || !support.supported;
                const isLayersTab = activeTab === 'Layers';

                // Layers tab: determine action type and layer number for JSX rendering
                let layerVariant: 'momentary' | 'toggle' | 'to' | 'tap' | null = null;
                let layerNum = 0;
                if (isLayersTab) {
                  const moMatch = k.code.match(/^MO\((\d+)\)$/);
                  const tgMatch = k.code.match(/^TG\((\d+)\)$/);
                  const toMatch = k.code.match(/^TO\((\d+)\)$/);
                  const ltMatch = k.code.match(/^LT\((\d+)/);
                  if (moMatch) { layerVariant = 'momentary'; layerNum = Number(moMatch[1]); }
                  else if (tgMatch) { layerVariant = 'toggle'; layerNum = Number(tgMatch[1]); }
                  else if (toMatch) { layerVariant = 'to'; layerNum = Number(toMatch[1]); }
                  else if (ltMatch) { layerVariant = 'tap'; layerNum = Number(ltMatch[1]); }
                }

                return (
                  <button
                    key={k.code}
                    onClick={() => handleKeycodeClick(k.code)}
                    disabled={isKeyDisabled}
                    title={getKeycodeTitle(k, support)}
                    style={{ width: `${U}px` }}
                    className={cn(
                      "flex flex-col items-center justify-center rounded border transition-colors h-12 group shadow-sm gap-0.5 px-1",
                      !isKeyDisabled ? "bg-[var(--bg-panel)] border-[var(--border-main)] hover:border-amber-500 hover:bg-[var(--bg-hover)] cursor-pointer active:scale-95" : "bg-[var(--bg-panel)]/30 border-[var(--border-main)]/50 opacity-30 grayscale cursor-not-allowed"
                    )}
                  >
                    {isLayersTab && layerVariant ? (
                      layerVariant === 'tap' ? (
                        // Layer Tap: 3 lines
                        <>
                          <span className="text-[8px] font-bold leading-none text-[var(--text-muted)]">{t('keycode.layerTapLayer') || 'Layer'}</span>
                          <span className="text-[8px] font-bold leading-none text-[var(--text-muted)]">{t('keycode.layerTapTap') || 'Tap'}</span>
                          <span className="flex items-center gap-0.5">
                            <LayersIcon size={8} className="text-amber-400 shrink-0" />
                            <span className="text-[9px] font-bold leading-none">{layerNum}</span>
                          </span>
                        </>
                      ) : (
                        // MO / TG / TO: 2 lines
                        <>
                          <span className="text-[9px] font-bold leading-none text-[var(--text-muted)]">
                            {layerVariant === 'momentary' ? (t('keycode.layerHold') || 'Hold') : layerVariant === 'toggle' ? (t('keycode.layerToggle') || 'Toggle') : (t('keycode.layerGoTo') || 'Go to')}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <LayersIcon size={9} className="text-amber-400 shrink-0" />
                            <span className="text-[10px] font-bold leading-none">{layerNum}</span>
                          </span>
                        </>
                      )
                    ) : (
                      <span className="text-[12px] font-bold transition-colors leading-tight text-center whitespace-pre-line">
                        {k.label}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
