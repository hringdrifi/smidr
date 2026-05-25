'use client';

import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';
import { Info, Check, Keyboard } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MODIFIERS: Modifier[] = ['LCTL', 'LSFT', 'LALT', 'LGUI', 'RCTL', 'RSFT', 'RALT', 'RGUI'];



export const KeycodeConfigPanel = () => {
  const {
    keys, selectedKeyIds, setKeycode, currentLayer,
    settings, remoteKeymap, updateDeviceKeycode, appMode,
    isCapturingParam, setIsCapturingParam
  } = useKeyboardStore();
  const { t } = useTranslation();

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = keys.find(k => k.id === selectedKeyId);

  useEffect(() => {
    setIsCapturingParam(false);
  }, [selectedKeyId, setIsCapturingParam]);

  if (selectedKeyIds.length !== 1 || !selectedKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Info className="w-8 h-8 text-[var(--text-muted)] mb-3 animate-pulse" />
        <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
          {t('keycodeConfig.selectKey') || 'Select a single key to configure advanced actions.'}
        </p>
      </div>
    );
  }

  const hasMatrix = selectedKey.row !== undefined;
  let action: UniversalAction = { action: 'trans' };
  if (appMode === 'remap') {
    if (hasMatrix) {
      const flatIndex = selectedKey.row! * 32 + selectedKey.col!;
      action = remoteKeymap[currentLayer]?.[flatIndex] || { action: 'trans' };
    }
  } else {
    action = selectedKey.keymap?.[currentLayer] || { action: 'trans' };
  }

  const updateSelectedAction = (newAction: UniversalAction) => {
    if (appMode === 'remap') {
      if (hasMatrix) {
        updateDeviceKeycode(currentLayer, selectedKey.row!, selectedKey.col!, newAction);
      }
    } else {
      setKeycode(selectedKey.id!, currentLayer, newAction);
    }
  };

  const handleActionTypeChange = (actVal: string) => {
    const existingLayerId = ('layerId' in action) ? (action as any).layerId : 1;
    let existingModifiers = ('modifiers' in action) ? (action as any).modifiers : [];

    let existingKeycode: string | undefined = undefined;
    if (action.action === 'tap') {
      existingKeycode = action.keycode;
      if (action.mods) {
        existingModifiers = action.mods;
      }
    } else if (action.action === 'lt' || action.action === 'mt') {
      if (action.tapAction.action === 'tap') {
        existingKeycode = action.tapAction.keycode;
      } else if (action.tapAction.action === 'trans' || action.tapAction.action === 'none') {
        existingKeycode = action.tapAction.action;
      }
    }

    let newAction: UniversalAction;
    switch (actVal) {
      case 'mo':
        newAction = { action: 'mo', layerId: existingLayerId };
        break;
      case 'tg':
        newAction = { action: 'tg', layerId: existingLayerId };
        break;
      case 'to':
        newAction = { action: 'to', layerId: existingLayerId };
        break;
      case 'lt': {
        let tapAction: UniversalAction = { action: 'trans' };
        if (existingKeycode === 'none') {
          tapAction = { action: 'none' };
        } else if (existingKeycode && existingKeycode !== 'transparent') {
          tapAction = { action: 'tap', keycode: existingKeycode as any };
        }
        newAction = { action: 'lt', layerId: existingLayerId, tapAction };
        break;
      }
      case 'mt': {
        let tapAction: UniversalAction = { action: 'trans' };
        if (existingKeycode === 'none') {
          tapAction = { action: 'none' };
        } else if (existingKeycode && existingKeycode !== 'transparent') {
          tapAction = { action: 'tap', keycode: existingKeycode as any };
        }
        newAction = { action: 'mt', modifiers: existingModifiers, tapAction };
        break;
      }
      case 'tap':
      default: {
        if (existingKeycode === 'none') {
          newAction = { action: 'none' };
        } else if (existingKeycode && existingKeycode !== 'transparent') {
          newAction = { action: 'tap', keycode: existingKeycode as any };
          if (existingModifiers && existingModifiers.length > 0) {
            newAction.mods = existingModifiers;
          }
        } else {
          newAction = { action: 'trans' };
        }
        break;
      }
    }
    updateSelectedAction(newAction);
  };

  const handleLayerChange = (layerId: number) => {
    if (
      action.action === 'mo' ||
      action.action === 'tg' ||
      action.action === 'to' ||
      action.action === 'lt'
    ) {
      updateSelectedAction({ ...action, layerId });
    }
  };

  const handleModifierToggle = (mod: Modifier) => {
    if (action.action === 'mt') {
      const isSelected = action.modifiers.includes(mod);
      let nextModifiers = isSelected
        ? action.modifiers.filter(m => m !== mod)
        : [...action.modifiers, mod];
      
      // Automatically align other selected modifiers to the newly clicked modifier's handedness
      if (!isSelected) {
        const isNewModRight = mod.startsWith('R');
        const mapping: Record<Modifier, Modifier> = isNewModRight
          ? {
              "LCTL": "RCTL", "LSFT": "RSFT", "LALT": "RALT", "LGUI": "RGUI",
              "RCTL": "RCTL", "RSFT": "RSFT", "RALT": "RALT", "RGUI": "RGUI"
            }
          : {
              "RCTL": "LCTL", "RSFT": "LSFT", "RALT": "LALT", "RGUI": "LGUI",
              "LCTL": "LCTL", "LSFT": "LSFT", "LALT": "LALT", "LGUI": "LGUI"
            };
        nextModifiers = nextModifiers.map(m => mapping[m]);
      }

      updateSelectedAction({ ...action, modifiers: nextModifiers });
    } else {
      // action is 'tap', 'trans', 'none'
      const currentMods = (action.action === 'tap' && action.mods) ? action.mods : [];
      const isSelected = currentMods.includes(mod);
      let nextModifiers = isSelected
        ? currentMods.filter(m => m !== mod)
        : [...currentMods, mod];
      
      if (!isSelected) {
        const isNewModRight = mod.startsWith('R');
        const mapping: Record<Modifier, Modifier> = isNewModRight
          ? {
              "LCTL": "RCTL", "LSFT": "RSFT", "LALT": "RALT", "LGUI": "RGUI",
              "RCTL": "RCTL", "RSFT": "RSFT", "RALT": "RALT", "RGUI": "RGUI"
            }
          : {
              "RCTL": "LCTL", "RSFT": "LSFT", "RALT": "LALT", "RGUI": "LGUI",
              "LCTL": "LCTL", "LSFT": "LSFT", "LALT": "LALT", "LGUI": "LGUI"
            };
        nextModifiers = nextModifiers.map(m => mapping[m]);
      }

      let baseKeycode: UniversalKey = 'TRNS';
      if (action.action === 'tap') {
        baseKeycode = action.keycode;
      } else if (action.action === 'none') {
        baseKeycode = 'NO';
      }

      const nextAction: UniversalAction = {
        action: 'tap',
        keycode: baseKeycode
      };

      if (nextModifiers.length > 0) {
        nextAction.mods = nextModifiers;
      }
      updateSelectedAction(nextAction);
    }
  };

  const handleKeycodeSelection = (code: string) => {
    if (action.action === 'lt' || action.action === 'mt') {
      let tapAction: UniversalAction;
      if (code === 'transparent') {
        tapAction = { action: 'trans' };
      } else if (code === 'none') {
        tapAction = { action: 'none' };
      } else {
        tapAction = { action: 'tap', keycode: code as UniversalKey };
      }
      updateSelectedAction({ ...action, tapAction });
    } else {
      let newAction: UniversalAction;
      if (code === 'transparent') {
        newAction = { action: 'trans' };
      } else if (code === 'none') {
        newAction = { action: 'none' };
      } else {
        newAction = { action: 'tap', keycode: code as UniversalKey };
        if (action.action === 'tap' && action.mods && action.mods.length > 0) {
          newAction.mods = action.mods;
        }
      }
      updateSelectedAction(newAction);
    }
  };

  // Determine current active config type string
  let currentType = 'tap';
  if (['mo', 'tg', 'to', 'lt', 'mt'].includes(action.action)) {
    currentType = action.action;
  } else {
    currentType = 'tap';
  }



  // Get current active keycode code
  let currentActiveCode = 'transparent';
  if (action.action === 'tap') {
    currentActiveCode = action.keycode;
  } else if (action.action === 'lt' || action.action === 'mt') {
    currentActiveCode = action.tapAction.action === 'tap' ? action.tapAction.keycode : action.tapAction.action;
  } else if (action.action === 'trans' || action.action === 'none') {
    currentActiveCode = action.action;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden">
      <div className="p-4 flex flex-col gap-4 border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-app)]/30">
        {/* Action Type Dropdown */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.actionType') || 'Action Type'}
            </label>
            <div className="relative group cursor-help">
              <Info size={13} className="text-amber-500/80 hover:text-amber-500 transition-colors" />
              <div className="absolute right-0 top-full mt-1.5 w-60 p-2.5 bg-zinc-950/95 border border-[var(--border-main)] text-[9px] leading-relaxed text-[var(--text-main)] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-y-1 group-hover:translate-y-0 shadow-2xl backdrop-blur-sm z-50">
                {currentType === 'tap' && (() => {
                  const desc = t('keycodeConfig.selectKeyDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Assign standard keys using the bottom palette.';
                })()}
                {['mo', 'tg', 'to'].includes(currentType) && (() => {
                  const desc = t('keycodeConfig.layerDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Switches to the layer below or target layer.';
                })()}
                {currentType === 'lt' && (() => {
                  const desc = t('keycodeConfig.layerTapDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Switches to target layer when held, sends keycode when tapped.';
                })()}
                {currentType === 'mt' && (() => {
                  const desc = t('keycodeConfig.modTapDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Acts as modifiers when held, sends keycode when tapped.';
                })()}
                {currentType === 'mod' && (() => {
                  const desc = t('keycodeConfig.modifierDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Sends modifier keys combined with a base key (e.g. Ctrl + Shift + A).';
                })()}
              </div>
            </div>
          </div>
          <select
            value={currentType}
            onChange={(e) => handleActionTypeChange(e.target.value)}
            className="w-full bg-[var(--bg-app)]/85 border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-highlight)] focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
          >
            <option value="tap">{t('keycodeConfig.typeBasic') || 'Tap Key'}</option>
            <option value="mt">{t('keycodeConfig.typeModTap') || 'Modifier Tap (MT)'}</option>
            <option value="mo">{t('keycodeConfig.typeMomentary') || 'Momentary Layer (MO)'}</option>
            <option value="tg">{t('keycodeConfig.typeToggle') || 'Toggle Layer (TG)'}</option>
            <option value="to">{t('keycodeConfig.typeTo') || 'Direct Layer (TO)'}</option>
            <option value="lt">{t('keycodeConfig.typeTap') || 'Layer Tap (LT)'}</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {/* Layer Selector Grid */}
        {(action.action === 'mo' ||
          action.action === 'tg' ||
          action.action === 'to' ||
          action.action === 'lt') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.targetLayer') || 'Target Layer'}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: settings.layers || 4 }).map((_, idx) => {
                const isActive = (action as any).layerId === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleLayerChange(idx)}
                    className={cn(
                      "py-1.5 text-xs font-bold rounded transition-all shadow-sm flex items-center justify-center border",
                      isActive
                        ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-amber-500/10 scale-105"
                        : "bg-[var(--bg-app)]/50 border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Modifiers Checklist */}
        {(action.action === 'mt' || action.action === 'tap' || action.action === 'trans' || action.action === 'none') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {action.action === 'mt'
                ? (t('keycodeConfig.modifiers') || 'Hold Modifiers')
                : (t('keycodeConfig.modifiers') || 'Modifiers')}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {MODIFIERS.map(mod => {
                const isSelected = action.action === 'mt'
                  ? action.modifiers.includes(mod)
                  : (action.action === 'tap' && action.mods ? action.mods.includes(mod) : false);
                return (
                  <button
                    key={mod}
                    onClick={() => handleModifierToggle(mod)}
                    className={cn(
                      "px-1 py-1.5 text-[9px] font-black tracking-wide rounded transition-all flex items-center justify-center gap-0.5 border",
                      isSelected
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : "bg-[var(--bg-app)]/30 border-[var(--border-main)]/50 text-[var(--text-dim)] hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <span>{mod}</span>
                    {isSelected && <Check size={10} className="text-amber-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Keycode Selection */}
        {(action.action === 'tap' || action.action === 'trans' || action.action === 'none' || action.action === 'lt' || action.action === 'mt') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {action.action === 'tap' || action.action === 'trans' || action.action === 'none'
                ? (t('keymap.currentKeycode') || 'Keycode')
                : action.action === 'lt'
                ? (t('keycodeConfig.tapKeycode') || 'Tap Keycode')
                : (t('keycodeConfig.tapKeycode') || 'Tap Keycode')}
            </label>
            
            {/* Current Value Pill */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--bg-app)]/20 border border-[var(--border-main)] text-[10px] shrink-0 font-medium">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] font-bold">{t('keycodeConfig.currentValue') || 'Current Value'}:</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30 uppercase tracking-wide">
                  {currentActiveCode}
                </span>
              </div>
              <button
                onClick={() => setIsCapturingParam(!isCapturingParam)}
                className={cn(
                  "h-[22px] px-2 rounded text-[9px] font-bold transition-all flex items-center gap-1 border cursor-pointer",
                  isCapturingParam
                    ? "bg-red-500/20 text-red-500 border-red-500/30"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500 hover:text-zinc-950"
                )}
              >
                <Keyboard className={cn("w-3 h-3 shrink-0", isCapturingParam ? "animate-bounce" : "")} />
                <span>
                  {isCapturingParam
                    ? (t('keymap.capturingDesc') || 'Selecting...')
                    : (t('keymap.captureTapKey') || 'Select')}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
