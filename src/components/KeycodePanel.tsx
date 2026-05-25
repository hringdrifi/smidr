'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { sortKeys } from '@/lib/sorting';
import { KEYCODES, Keycode, VIAL_TABS, KeycodeCategory } from '@/lib/keycodes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Keyboard, ChevronLeft, ChevronRight, Layers2 as LayersIcon } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalAction, UniversalKey } from '@/types/actions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const KeycodePanel = () => {
  const { 
    keys, selectedKeyIds, setKeycode, setSelectedKeyIds, currentLayer, 
    editorSettings, settings, remoteKeymap,
    deviceCapabilities, isCapturingParam, setIsCapturingParam
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<KeycodeCategory>('Basic');
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [tapSearchQuery, setTapSearchQuery] = useState('');
  const tabContainerRef = useRef<HTMLDivElement>(null);

  const layersCount = settings.layers || 4;
  let filteredKeycodes: Keycode[] = activeTab === 'Layers' 
    ? [
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `MO(${i})`, label: `MO(${i})`, category: 'Layers' as const, description: `Momentary layer: switches to layer ${i} while held` })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `TG(${i})`, label: `TG(${i})`, category: 'Layers' as const, description: `Toggle layer: toggles layer ${i} active/inactive on press` })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `TO(${i})`, label: `TO(${i})`, category: 'Layers' as const, description: `Direct layer: switches directly to layer ${i}` })),
        ...Array.from({ length: layersCount }, (_, i) => ({ code: `LT(${i})`, label: `LT(${i})`, category: 'Layers' as const, description: `Layer Tap: switches to layer ${i} when held, sends transparent keycode when tapped` })),
      ]
    : KEYCODES.filter(k => k.category === activeTab);



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

  // Capture mode useEffect deprecated

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = keys.find(k => k.id === selectedKeyId);
  const hasMatrix = selectedKey && selectedKey.row !== undefined;

  let action: UniversalAction = { type: 'trans' };
  if (selectedKey) {
    if (useKeyboardStore.getState().appMode === 'remap') {
      if (hasMatrix) {
        const flatIndex = selectedKey.row! * 32 + selectedKey.col!;
        action = remoteKeymap[currentLayer]?.[flatIndex] || { type: 'trans' };
      }
    } else {
      action = selectedKey.keymap?.[currentLayer] || { type: 'trans' };
    }
  }

  const isLT = action.type === 'lt';
  const ltLayer = action.type === 'lt' ? action.layerId : 1;
  const ltKc = action.type === 'lt' 
    ? (action.tapAction.type === 'tap' ? action.tapAction.keycode : action.tapAction.type)
    : 'trans';

  const updateSelectedAction = (newAction: UniversalAction) => {
    if (!selectedKey) return;
    if (useKeyboardStore.getState().appMode === 'remap') {
      const { updateDeviceKeycode } = useKeyboardStore.getState();
      if (hasMatrix) {
        updateDeviceKeycode(currentLayer, selectedKey.row!, selectedKey.col!, newAction);
      }
    } else {
      setKeycode(selectedKey.id!, currentLayer, newAction);
    }
  };

  const handleLtLayerChange = (newLayer: number) => {
    const newAction: UniversalAction = {
      type: 'lt',
      layerId: newLayer,
      tapAction: action.type === 'lt' ? action.tapAction : { type: 'trans' }
    };
    updateSelectedAction(newAction);
  };

  const handleLtKcChange = (newKc: string) => {
    let tapAction: UniversalAction;
    if (newKc === 'transparent') {
      tapAction = { type: 'trans' };
    } else if (newKc === 'none') {
      tapAction = { type: 'none' };
    } else {
      tapAction = { type: 'tap', keycode: newKc as UniversalKey };
    }

    const newAction: UniversalAction = {
      type: 'lt',
      layerId: ltLayer,
      tapAction: tapAction
    };
    updateSelectedAction(newAction);
  };

  const handleKeycodeClick = (code: string) => {
    if (selectedKeyIds.length === 0) return;
    
    if (isCapturingParam && selectedKey) {
      let clickedAction: UniversalAction;
      if (code === 'transparent') {
        clickedAction = { type: 'trans' };
      } else if (code === 'none') {
        clickedAction = { type: 'none' };
      } else {
        clickedAction = { type: 'tap', keycode: code as UniversalKey };
      }

      if (action.type === 'lt' || action.type === 'mt') {
        updateSelectedAction({ ...action, tapAction: clickedAction });
      } else if (action.type === 'mod') {
        const targetKey = clickedAction.type === 'tap' ? clickedAction.keycode : 'TRNS';
        updateSelectedAction({ ...action, keycode: targetKey });
      } else {
        updateSelectedAction(clickedAction);
      }
      setIsCapturingParam(false);
      return;
    }

    const isNormalKeycode = !code.startsWith('MO(') && 
                            !code.startsWith('TG(') && 
                            !code.startsWith('TO(') && 
                            !code.startsWith('LT(') && 
                            !code.startsWith('MACRO_') && 
                            !['RGB_TOG', 'RGB_MOD', 'RGB_RMOD', 'RGB_VAI', 'RGB_VAD'].includes(code);

    if (isNormalKeycode && (action.type === 'lt' || action.type === 'mt' || action.type === 'mod')) {
      let clickedAction: UniversalAction;
      if (code === 'transparent') {
        clickedAction = { type: 'trans' };
      } else if (code === 'none') {
        clickedAction = { type: 'none' };
      } else {
        clickedAction = { type: 'tap', keycode: code as UniversalKey };
      }

      if (action.type === 'lt' || action.type === 'mt') {
        updateSelectedAction({ ...action, tapAction: clickedAction });
      } else if (action.type === 'mod') {
        const targetKey = clickedAction.type === 'tap' ? clickedAction.keycode : 'TRNS';
        updateSelectedAction({ ...action, keycode: targetKey as any });
      }
    } else {
      let clickedAction: UniversalAction;

      if (code === 'transparent') {
        clickedAction = { type: 'trans' };
      } else if (code === 'none') {
        clickedAction = { type: 'none' };
      } else if (code.startsWith('MO(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { type: 'mo', layerId };
      } else if (code.startsWith('TG(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { type: 'tg', layerId };
      } else if (code.startsWith('TO(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { type: 'to', layerId };
      } else if (code.startsWith('LT(')) {
        const layerId = parseInt((code.match(/\d+/) || ['0'])[0], 10);
        clickedAction = { type: 'lt', layerId, tapAction: { type: 'trans' } };
      } else if (code.startsWith('MACRO_')) {
        const macroId = parseInt(code.split('_')[1] || '0', 10);
        clickedAction = { type: 'macro', macroId };
      } else if (['RGB_TOG', 'RGB_MOD', 'RGB_RMOD', 'RGB_VAI', 'RGB_VAD'].includes(code)) {
        const lightingMap: Record<string, any> = {
          'RGB_TOG': 'TOGGLE',
          'RGB_MOD': 'MODE_UP',
          'RGB_RMOD': 'MODE_DOWN',
          'RGB_VAI': 'BRIGHTNESS_UP',
          'RGB_VAD': 'BRIGHTNESS_DOWN'
        };
        clickedAction = { type: 'lighting', command: lightingMap[code] };
      } else {
        clickedAction = { type: 'tap', keycode: code as UniversalKey };
      }

      updateSelectedAction(clickedAction);
    }

    const visKeys = keys.filter(k => !k.group || (settings.activeOptions[k.group] ?? 0) === k.option);
    const sortedKeys = sortKeys(visKeys, editorSettings.sortThresholdY);
    
    const lastSelectedIndex = Math.max(...selectedKeyIds.map(id => sortedKeys.findIndex(k => k.id === id)));
    if (lastSelectedIndex !== -1 && sortedKeys.length > 0) {
      const nextIndex = (lastSelectedIndex + 1) % sortedKeys.length;
      setSelectedKeyIds([sortedKeys[nextIndex].id!]);
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

  const selectKeycodes = KEYCODES.filter(k => k.category !== 'Layers' && k.code !== 'ISO_ENT_GHOST');
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
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[var(--bg-app)]/20">
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
                      const isKeyDisabled = selectedKeyIds.length === 0;

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
                                  selectedKeyIds.length > 0 && "group-hover:fill-[var(--bg-hover)]"
                                )}
                                strokeWidth="1"
                              />
                            </svg>
                          )}
                          <button
                            onClick={() => handleKeycodeClick(k.code)}
                            disabled={isKeyDisabled}
                            title={k.code}
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
                const isKeyDisabled = selectedKeyIds.length === 0;
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
                    title={k.description || k.code}
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
