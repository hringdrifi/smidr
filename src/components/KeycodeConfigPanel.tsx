'use client';

import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';
import { Info, Check, Code2, Settings, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RightPanelEmptyState } from './RightPanelEmptyState';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MODIFIERS: Modifier[] = ['LCTL', 'LSFT', 'LALT', 'LGUI', 'RCTL', 'RSFT', 'RALT', 'RGUI'];

const describeAction = (action?: UniversalAction) => {
  if (!action) return 'TRNS';
  if (action.action === 'tap') {
    const mods = action.mods && action.mods.length > 0 ? `${action.mods.join('+')}+` : '';
    return `${mods}${action.keycode}`;
  }
  if (action.action === 'trans') return 'TRNS';
  if (action.action === 'none') return 'NO';
  if (action.action === 'mo') return `MO(${action.layerId})`;
  if (action.action === 'tg') return `TG(${action.layerId})`;
  if (action.action === 'to') return `TO(${action.layerId})`;
  if (action.action === 'lt') {
    const tap = action.tapAction.action === 'tap' ? action.tapAction.keycode : action.tapAction.action.toUpperCase();
    return `LT(${action.layerId}, ${tap})`;
  }
  if (action.action === 'mt') {
    const tap = action.tapAction.action === 'tap' ? action.tapAction.keycode : action.tapAction.action.toUpperCase();
    return `MT(${action.modifiers.join('+')}, ${tap})`;
  }
  if (action.action === 'td') return `TD${action.tapDanceId}`;
  if (action.action === 'macro') return `M${action.macroId}`;
  if (action.action === 'custom') return action.label || action.rawCode;
  return 'UNKNOWN';
};



export const KeycodeConfigPanel = () => {
  const {
    keys, selectedKeyIds, setKeycode, currentLayer,
    settings, remoteKeymap, updateDeviceKeycode, appMode, connectedDevice,
    deviceCapabilities, remoteTapDances, openMacroSettings, openTapDanceSettings,
    updateEncoder, encoderActionDirection, setEncoderActionDirection
  } = useKeyboardStore();
  const { t } = useTranslation();
  const defaultCustomProtocol = connectedDevice?.protocolType === 'zmk'
    ? 'zmk'
    : connectedDevice?.protocolType === 'vial'
    ? 'vial'
    : connectedDevice?.protocolType === 'via'
    ? 'via'
    : 'qmk';
  const [rawDraft, setRawDraft] = useState('');
  const [rawProtocolDraft, setRawProtocolDraft] = useState<'qmk' | 'via' | 'vial' | 'zmk'>(defaultCustomProtocol);

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = keys.find(k => k.id === selectedKeyId);
  const selectedEncoder = selectedKey?.encoderId
    ? (settings.encoders || []).find(encoder => encoder.id === selectedKey.encoderId)
    : null;
  const isEncoderActionMode = appMode === 'design' && !!selectedEncoder;
  const hasEncoderButtonMatrix = selectedKey?.row !== undefined && selectedKey?.col !== undefined;
  const effectiveEncoderActionDirection = isEncoderActionMode && encoderActionDirection === 'button' && !hasEncoderButtonMatrix
    ? 'clockwise'
    : encoderActionDirection;
  const encoderRotationDirection = effectiveEncoderActionDirection === 'button' ? null : effectiveEncoderActionDirection;
  const isEncoderRotationTarget = isEncoderActionMode && !!encoderRotationDirection;
  const selectedRemoteIndex = selectedKey?.zmkPosition ?? (
    selectedKey?.row !== undefined && selectedKey?.col !== undefined ? selectedKey.row * 32 + selectedKey.col : undefined
  );
  let action: UniversalAction = { action: 'trans' };
  if (selectedKey) {
    if (isEncoderRotationTarget) {
      action = selectedEncoder?.keymap?.[currentLayer]?.[encoderRotationDirection] || { action: 'trans' };
    } else if (appMode === 'remap') {
      if (selectedRemoteIndex !== undefined) {
        action = remoteKeymap[currentLayer]?.[selectedRemoteIndex] || { action: 'trans' };
      }
    } else {
      action = selectedKey.keymap?.[currentLayer] || { action: 'trans' };
    }
  }
  const actionSignature = JSON.stringify(action);
  const [draftAction, setDraftAction] = useState<UniversalAction>(action);
  const activeAction = draftAction;
  const isVialRemap = appMode === 'remap' && connectedDevice?.protocolType === 'vial';

  useEffect(() => {
    setDraftAction(action);
  }, [selectedKeyId, currentLayer, appMode, effectiveEncoderActionDirection, actionSignature]);

  useEffect(() => {
    if (activeAction.action === 'custom') {
      setRawDraft(activeAction.rawCode);
      setRawProtocolDraft(activeAction.protocol);
    } else {
      setRawDraft(defaultCustomProtocol === 'zmk' ? '&kp A' : '0x0004');
      setRawProtocolDraft(defaultCustomProtocol);
    }
  }, [activeAction, defaultCustomProtocol]);

  if (selectedKeyIds.length !== 1 || !selectedKey) {
    return (
      <RightPanelEmptyState message={t('keycodeConfig.selectKey') || 'Select a single key to configure advanced actions.'} />
    );
  }

  const isCommitReady = (nextAction: UniversalAction) => {
    if (nextAction.action === 'mt') {
      return nextAction.modifiers.length > 0 && nextAction.tapAction.action === 'tap';
    }
    if (nextAction.action === 'lt') {
      return nextAction.tapAction.action === 'tap';
    }
    if (nextAction.action === 'custom') {
      return nextAction.rawCode.trim().length > 0;
    }
    return true;
  };

  const commitSelectedAction = (newAction: UniversalAction) => {
    if (isEncoderRotationTarget && selectedEncoder) {
      updateEncoder(selectedEncoder.id!, {
        keymap: {
          ...(selectedEncoder.keymap || {}),
          [currentLayer]: {
            ...(selectedEncoder.keymap?.[currentLayer] || {}),
            [encoderRotationDirection]: newAction,
          },
        },
      });
    } else if (appMode === 'remap') {
      if (selectedKey.zmkPosition !== undefined) {
        updateDeviceKeycode(currentLayer, selectedKey.zmkPosition, -1, newAction);
      } else if (selectedKey.row !== undefined && selectedKey.col !== undefined) {
        updateDeviceKeycode(currentLayer, selectedKey.row, selectedKey.col, newAction);
      }
    } else {
      setKeycode(selectedKey.id!, currentLayer, newAction);
    }
  };

  const updateDraftAction = (newAction: UniversalAction) => {
    setDraftAction(newAction);
    if (isCommitReady(newAction)) {
      commitSelectedAction(newAction);
    }
  };

  const handleActionTypeChange = (actVal: string) => {
    const existingLayerId = ('layerId' in activeAction) ? (activeAction as any).layerId : 1;
    let existingModifiers = ('modifiers' in activeAction) ? (activeAction as any).modifiers : [];

    let existingKeycode: string | undefined = undefined;
    if (activeAction.action === 'tap') {
      existingKeycode = activeAction.keycode;
      if (activeAction.mods) {
        existingModifiers = activeAction.mods;
      }
    } else if (activeAction.action === 'lt' || activeAction.action === 'mt') {
      if (activeAction.tapAction.action === 'tap') {
        existingKeycode = activeAction.tapAction.keycode;
      } else if (activeAction.tapAction.action === 'trans') {
        existingKeycode = 'TRNS';
      } else if (activeAction.tapAction.action === 'none') {
        existingKeycode = 'NO';
      }
    } else if (activeAction.action === 'trans') {
      existingKeycode = 'TRNS';
    } else if (activeAction.action === 'none') {
      existingKeycode = 'NO';
    }

    const isTrans = (kc: string | undefined) => !kc || kc === 'trans' || kc === 'transparent' || kc === 'TRNS';
    const isNone = (kc: string | undefined) => kc === 'none' || kc === 'NO';

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
        if (isNone(existingKeycode)) {
          tapAction = { action: 'none' };
        } else if (existingKeycode && !isTrans(existingKeycode)) {
          tapAction = { action: 'tap', keycode: existingKeycode as any };
        }
        newAction = { action: 'lt', layerId: existingLayerId, tapAction };
        break;
      }
      case 'mt': {
        let tapAction: UniversalAction = { action: 'trans' };
        if (isNone(existingKeycode)) {
          tapAction = { action: 'none' };
        } else if (existingKeycode && !isTrans(existingKeycode)) {
          tapAction = { action: 'tap', keycode: existingKeycode as any };
        }
        newAction = { action: 'mt', modifiers: existingModifiers, tapAction };
        break;
      }
      case 'td':
        newAction = { action: 'td', tapDanceId: activeAction.action === 'td' ? activeAction.tapDanceId : 0 };
        break;
      case 'macro':
        newAction = { action: 'macro', macroId: activeAction.action === 'macro' ? activeAction.macroId : 0 };
        break;
      case 'custom': {
        const protocol = activeAction.action === 'custom' ? activeAction.protocol : defaultCustomProtocol;
        const rawCode = activeAction.action === 'custom'
          ? activeAction.rawCode
          : protocol === 'zmk'
          ? '&kp A'
          : '0x0004';
        newAction = { action: 'custom', protocol, rawCode };
        break;
      }
      case 'tap':
      default: {
        if (isNone(existingKeycode)) {
          newAction = { action: 'none' };
        } else if (existingKeycode && !isTrans(existingKeycode)) {
          newAction = { action: 'tap', keycode: existingKeycode as any };
          if (existingModifiers && existingModifiers.length > 0) {
            newAction.mods = existingModifiers;
          }
        } else {
          if (existingModifiers && existingModifiers.length > 0) {
            newAction = { action: 'tap', keycode: 'TRNS', mods: existingModifiers };
          } else {
            newAction = { action: 'trans' };
          }
        }
        break;
      }
    }
    updateDraftAction(newAction);
  };

  const handleLayerChange = (layerId: number) => {
    if (
      activeAction.action === 'mo' ||
      activeAction.action === 'tg' ||
      activeAction.action === 'to' ||
      activeAction.action === 'lt'
    ) {
      updateDraftAction({ ...activeAction, layerId });
    }
  };

  const handleTapDanceChange = (tapDanceId: number) => {
    if (activeAction.action === 'td') {
      updateDraftAction({ ...activeAction, tapDanceId });
    }
  };

  const handleMacroChange = (macroId: number) => {
    if (activeAction.action === 'macro') {
      updateDraftAction({ ...activeAction, macroId });
    }
  };

  const handleModifierToggle = (mod: Modifier) => {
    if (activeAction.action === 'mt') {
      const isSelected = activeAction.modifiers.includes(mod);
      let nextModifiers = isSelected
        ? activeAction.modifiers.filter(m => m !== mod)
        : [...activeAction.modifiers, mod];
      
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

      updateDraftAction({ ...activeAction, modifiers: nextModifiers });
    } else {
      // action is 'tap', 'trans', 'none'
      const currentMods = (activeAction.action === 'tap' && activeAction.mods) ? activeAction.mods : [];
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
      if (activeAction.action === 'tap') {
        baseKeycode = activeAction.keycode;
      } else if (activeAction.action === 'none') {
        baseKeycode = 'NO';
      }

      let nextAction: UniversalAction;
      if (nextModifiers.length > 0) {
        nextAction = {
          action: 'tap',
          keycode: baseKeycode,
          mods: nextModifiers
        };
      } else {
        if (baseKeycode === 'TRNS') {
          nextAction = { action: 'trans' };
        } else if (baseKeycode === 'NO') {
          nextAction = { action: 'none' };
        } else {
          nextAction = {
            action: 'tap',
            keycode: baseKeycode
          };
        }
      }
      updateDraftAction(nextAction);
    }
  };

  // Determine current active config type string
  let currentType = 'tap';
  if (['mo', 'tg', 'to', 'lt', 'mt', 'td', 'macro'].includes(activeAction.action)) {
    currentType = activeAction.action;
  } else if (activeAction.action === 'custom') {
    currentType = 'custom';
  } else {
    currentType = 'tap';
  }



  // Get current active keycode code
  let currentActiveCode = 'transparent';
  if (activeAction.action === 'tap') {
    currentActiveCode = activeAction.keycode;
  } else if (activeAction.action === 'lt' || activeAction.action === 'mt') {
    currentActiveCode = activeAction.tapAction.action === 'tap' ? activeAction.tapAction.keycode : activeAction.tapAction.action;
  } else if (activeAction.action === 'trans' || activeAction.action === 'none') {
    currentActiveCode = activeAction.action;
  } else if (activeAction.action === 'custom') {
    currentActiveCode = activeAction.rawCode;
  } else if (activeAction.action === 'macro') {
    currentActiveCode = `M${activeAction.macroId}`;
  } else if (activeAction.action === 'td') {
    currentActiveCode = `TD${activeAction.tapDanceId}`;
  }
  const tapDanceSelectorIds = isVialRemap && remoteTapDances.length > 0
    ? remoteTapDances.map(td => td.id)
    : Array.from({ length: 16 }, (_, idx) => idx);
  const canOpenDeviceTapDanceSettings = activeAction.action === 'td' && isVialRemap && (
    remoteTapDances.some(td => td.id === activeAction.tapDanceId)
  );
  const canOpenProjectMacroSettings = activeAction.action === 'macro' && appMode === 'design';
  const canOpenDeviceMacroSettings = activeAction.action === 'macro' && appMode === 'remap' && !!deviceCapabilities?.hasMacros;
  const canOpenProjectTapDanceSettings = activeAction.action === 'td' && appMode === 'design';
  const canOpenMacroSettings = canOpenProjectMacroSettings || canOpenDeviceMacroSettings;
  const canOpenTapDanceSettingsButton = canOpenProjectTapDanceSettings || canOpenDeviceTapDanceSettings;

  const clearEncoderTargetAction = (target: 'counterClockwise' | 'clockwise' | 'button') => {
    if (!selectedKey) return;
    if (target === 'button') {
      setKeycode(selectedKey.id!, currentLayer, { action: 'trans' });
      return;
    }
    if (!selectedEncoder) return;
    updateEncoder(selectedEncoder.id!, {
      keymap: {
        ...(selectedEncoder.keymap || {}),
        [currentLayer]: {
          ...(selectedEncoder.keymap?.[currentLayer] || {}),
          [target]: { action: 'trans' },
        },
      },
    });
  };

  const handleApplyRawAction = () => {
    const rawCode = rawDraft.trim();
    if (!rawCode) return;
    updateDraftAction({
      action: 'custom',
      protocol: rawProtocolDraft,
      rawCode,
      label: rawCode
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden">
      <div className="p-4 flex flex-col gap-4 shrink-0 bg-[#151518]">
        {isEncoderActionMode && selectedEncoder && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.encoderTargets')}
            </label>
            <div className="flex flex-col gap-2">
              {([
                ...(hasEncoderButtonMatrix
                  ? [['button', t('keycodeConfig.encoderButton'), selectedKey.keymap?.[currentLayer]] as const]
                  : []),
                ['clockwise', t('keycodeConfig.encoderClockwise'), selectedEncoder.keymap?.[currentLayer]?.clockwise],
                ['counterClockwise', t('keycodeConfig.encoderCounterClockwise'), selectedEncoder.keymap?.[currentLayer]?.counterClockwise],
              ] as const).map(([direction, label, targetAction]) => {
                const isFocused = effectiveEncoderActionDirection === direction;
                const value = describeAction(targetAction);
                const hasValue = value !== 'TRNS';
                return (
                  <div key={direction} className="space-y-1">
                    <label className="text-[9px] text-[var(--text-muted)] font-mono uppercase">{label}</label>
                    <div
                      onClick={() => setEncoderActionDirection(direction)}
                      className={cn(
                        "flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 rounded border bg-[var(--bg-app)] px-2 text-xs font-mono transition-all duration-200",
                        isFocused
                          ? "border-amber-500 ring-1 ring-amber-500 text-amber-500"
                          : hasValue
                          ? "border-[var(--border-main)] text-[var(--text-highlight)] hover:border-amber-500/50"
                          : "border-[var(--border-main)] text-[var(--text-muted)] hover:border-amber-500/50 hover:text-[var(--text-main)]"
                      )}
                    >
                      <span className="min-w-0 truncate">{hasValue ? value : t('keycodeConfig.assignAction')}</span>
                      {hasValue && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearEncoderTargetAction(direction);
                          }}
                          className="rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-zinc-700/50 hover:text-red-400"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Type Dropdown */}
        <div
          className={cn(
            "flex flex-col gap-1.5",
            isEncoderActionMode && selectedEncoder
              ? "-mx-4 -mb-4 bg-[var(--bg-panel)] border-t border-[var(--border-main)] px-4 py-4"
              : ""
          )}
        >
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
                {currentType === 'custom' && 'Passes a protocol-specific raw keycode or behavior through to the connected device.'}
                {currentType === 'macro' && (() => {
                  const desc = t('keycodeConfig.macroDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Runs the selected macro slot from the keyboard firmware.';
                })()}
                {currentType === 'td' && (() => {
                  const desc = t('keycodeConfig.tapDanceDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Runs the selected Tap Dance definition from the project firmware.';
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
            <option value="macro">{t('keycodeConfig.typeMacro') || 'Macro'}</option>
            <option value="td">{t('keycodeConfig.typeTapDance') || 'Tap Dance (TD)'}</option>
            <option value="custom">{t('keycodeConfig.customKeycode') || 'Any'}</option>
          </select>
        </div>
      </div>

      <div className="mx-4 h-px shrink-0 bg-[var(--border-main)]" />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {/* Layer Selector Grid */}
        {activeAction.action === 'custom' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-500">
              <Code2 size={14} className="shrink-0" />
              <label className="text-[10px] font-bold uppercase tracking-wider">
                {t('keycodeConfig.customKeycode') || 'Any'}
              </label>
            </div>
            <select
              value={rawProtocolDraft}
              onChange={(e) => setRawProtocolDraft(e.target.value as 'qmk' | 'via' | 'vial' | 'zmk')}
              className="w-full bg-[var(--bg-app)]/85 border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-highlight)] focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
            >
              <option value="qmk">QMK</option>
              <option value="via">VIA</option>
              <option value="vial">Vial</option>
              <option value="zmk">ZMK</option>
            </select>
            <textarea
              value={rawDraft}
              onChange={(e) => setRawDraft(e.target.value)}
              spellCheck={false}
              rows={4}
              className="w-full resize-none bg-zinc-950/60 border border-[var(--border-main)] rounded-lg p-3 text-xs text-[var(--text-main)] focus:outline-none focus:border-amber-500/70 transition-colors font-mono leading-relaxed"
              placeholder={rawProtocolDraft === 'zmk' ? '&kp A' : '0x0004'}
            />
            <button
              onClick={handleApplyRawAction}
              disabled={!rawDraft.trim()}
              className={cn(
                "w-full h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                rawDraft.trim()
                  ? "bg-amber-500 text-zinc-950 border-amber-500 hover:bg-amber-400"
                  : "bg-[var(--bg-app)]/30 border-[var(--border-main)] text-[var(--text-dim)] cursor-not-allowed"
              )}
            >
              {t('keycodeConfig.applyRawAction') || 'Apply Any'}
            </button>
          </div>
        )}

        {(activeAction.action === 'mo' ||
          activeAction.action === 'tg' ||
          activeAction.action === 'to' ||
          activeAction.action === 'lt') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.targetLayer') || 'Target Layer'}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: settings.layers || 4 }).map((_, idx) => {
                const isActive = (activeAction as any).layerId === idx;
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

        {activeAction.action === 'macro' && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.macro') || 'Macro'}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 16 }, (_, idx) => {
                const isActive = activeAction.macroId === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleMacroChange(idx)}
                    className={cn(
                      "py-1.5 text-xs font-bold rounded transition-all shadow-sm flex items-center justify-center border",
                      isActive
                        ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-amber-500/10 scale-105"
                        : "bg-[var(--bg-app)]/50 border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                  >
                    M{idx}
                  </button>
                );
              })}
            </div>
            {canOpenMacroSettings && (
              <button
                onClick={() => openMacroSettings(activeAction.macroId)}
                className="mt-1 h-9 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Settings size={13} />
                {t('keycodeConfig.openMacroSettings') || 'Open Macro Settings'}
              </button>
            )}
          </div>
        )}

        {activeAction.action === 'td' && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.tapDance') || 'Tap Dance'}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {tapDanceSelectorIds.map((idx) => {
                const isActive = activeAction.tapDanceId === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleTapDanceChange(idx)}
                    className={cn(
                      "py-1.5 text-xs font-bold rounded transition-all shadow-sm flex items-center justify-center border",
                      isActive
                        ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-amber-500/10 scale-105"
                        : "bg-[var(--bg-app)]/50 border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                  >
                    TD{idx}
                  </button>
                );
              })}
            </div>
            {canOpenTapDanceSettingsButton && (
              <button
                onClick={() => openTapDanceSettings(activeAction.tapDanceId)}
                className="mt-1 h-9 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                <Settings size={13} />
                {t('keycodeConfig.openTapDanceSettings') || 'Open Tap Dance Settings'}
              </button>
            )}
          </div>
        )}

        {/* Modifiers Checklist */}
        {(activeAction.action === 'mt' || activeAction.action === 'tap' || activeAction.action === 'trans' || activeAction.action === 'none') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {activeAction.action === 'mt'
                ? (t('keycodeConfig.modifiers') || 'Hold Modifiers')
                : (t('keycodeConfig.modifiers') || 'Modifiers')}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {MODIFIERS.map(mod => {
                const isSelected = activeAction.action === 'mt'
                  ? activeAction.modifiers.includes(mod)
                  : (activeAction.action === 'tap' && activeAction.mods ? activeAction.mods.includes(mod) : false);
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
        {(activeAction.action === 'tap' || activeAction.action === 'trans' || activeAction.action === 'none' || activeAction.action === 'lt' || activeAction.action === 'mt') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {activeAction.action === 'tap' || activeAction.action === 'trans' || activeAction.action === 'none'
                ? (t('keymap.currentKeycode') || 'Keycode')
                : activeAction.action === 'lt'
                ? (t('keycodeConfig.tapKeycode') || 'Tap Keycode')
                : (t('keycodeConfig.tapKeycode') || 'Tap Keycode')}
            </label>
            
            {/* Current Value Pill */}
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-[var(--bg-app)]/20 border border-[var(--border-main)] text-[10px] shrink-0 font-medium">
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] font-bold">{t('keycodeConfig.currentValue') || 'Current Value'}:</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30 uppercase tracking-wide">
                  {currentActiveCode}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
