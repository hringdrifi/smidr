'use client';

import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { KEYCODES, Keycode } from '@/lib/keycodes';
import { useTranslation } from '@/hooks/useTranslation';
import { UniversalAction, UniversalKey, Modifier } from '@/types/actions';
import { Search, Info, Check, Sparkles, Keyboard } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MODIFIERS: Modifier[] = ['LCTL', 'RCTL', 'LSFT', 'RSFT', 'LALT', 'RALT', 'LGUI', 'RGUI'];

const QMK_ORDER = [
  'transparent',
  'none',
  // Letters (A-Z)
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  // Numbers (1-0)
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  // Core edit & nav
  'ENT', 'ESC', 'BSPC', 'TAB', 'SPC',
  // Symbols
  'MINS', 'EQL', 'LBRC', 'RBRC', 'BSLS', 'NUHS', 'SCLN', 'QUOT', 'GRV', 'COMM', 'DOT', 'SLSH',
  // Functions
  'CAPS', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'PSCR', 'SLCK', 'PAUS', 'INS', 'HOME', 'PGUP', 'DEL', 'END', 'PGDN',
  // Arrow keys
  'RIGHT', 'LEFT', 'DOWN', 'UP',
  // Numpad
  'NLCK', 'PSLS', 'PAST', 'PMNS', 'PPLS', 'PENT',
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P0', 'PDOT',
  // Specialized ISO/JIS & extra keys
  'NUBS', 'APP', 'PEQL',
  'YEN', 'RO', 'MHEN', 'HENK', 'KANA',
  // Modifiers
  'LCTL', 'LSFT', 'LALT', 'LGUI', 'RCTL', 'RSFT', 'RALT', 'RGUI'
];

const getQmkIndex = (code: string) => {
  const idx = QMK_ORDER.indexOf(code);
  return idx === -1 ? 9999 : idx;
};

const uniqueCodes = new Set<string>();
const rawSelectable = [
  { code: 'transparent', label: '▽ (Transparent)', category: 'Special' as const },
  { code: 'none', label: 'None', category: 'Special' as const },
  ...KEYCODES.filter(k => (k.category === 'Basic' || k.category === 'ISO/JIS') && k.code !== 'ISO_ENT_GHOST')
];

const deduplicatedSelectable: Keycode[] = [];
for (const item of rawSelectable) {
  if (!uniqueCodes.has(item.code)) {
    uniqueCodes.add(item.code);
    deduplicatedSelectable.push(item);
  }
}

const SELECTABLE_KEYCODES: Keycode[] = deduplicatedSelectable.sort((a, b) => {
  return getQmkIndex(a.code) - getQmkIndex(b.code);
});

export const KeycodeConfigPanel = () => {
  const {
    keys, selectedKeyIds, setKeycode, currentLayer,
    settings, remoteKeymap, updateDeviceKeycode, appMode,
    isCapturingParam, setIsCapturingParam
  } = useKeyboardStore();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');

  const selectedKeyId = selectedKeyIds[0];
  const selectedKey = keys.find(k => k.id === selectedKeyId);

  useEffect(() => {
    setIsCapturingParam(false);
    setSearchQuery('');
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
  let action: UniversalAction = { type: 'transparent' };
  if (appMode === 'remap') {
    if (hasMatrix) {
      const flatIndex = selectedKey.row! * 32 + selectedKey.col!;
      action = remoteKeymap[currentLayer]?.[flatIndex] || { type: 'transparent' };
    }
  } else {
    action = selectedKey.keymap?.[currentLayer] || { type: 'transparent' };
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

  const handleActionTypeChange = (type: string) => {
    let newAction: UniversalAction;
    switch (type) {
      case 'layer_momentary':
        newAction = { type: 'layer_momentary', layerId: 1 };
        break;
      case 'layer_toggle':
        newAction = { type: 'layer_toggle', layerId: 1 };
        break;
      case 'layer_to':
        newAction = { type: 'layer_to', layerId: 1 };
        break;
      case 'layer_tap':
        newAction = { type: 'layer_tap', layerId: 1, tapAction: { type: 'transparent' } };
        break;
      case 'mod_tap':
        newAction = { type: 'mod_tap', modifiers: [], tapAction: { type: 'transparent' } };
        break;
      case 'modifier':
        newAction = { type: 'modifier', modifiers: [], key: 'TRNS' };
        break;
      case 'basic':
      default:
        newAction = { type: 'transparent' };
        break;
    }
    updateSelectedAction(newAction);
  };

  const handleLayerChange = (layerId: number) => {
    if (
      action.type === 'layer_momentary' ||
      action.type === 'layer_toggle' ||
      action.type === 'layer_to' ||
      action.type === 'layer_tap'
    ) {
      updateSelectedAction({ ...action, layerId });
    }
  };

  const handleModifierToggle = (mod: Modifier) => {
    if (action.type === 'mod_tap' || action.type === 'modifier') {
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
    }
  };

  const handleBasicKeycodeChange = (code: string) => {
    let newAction: UniversalAction;
    if (code === 'transparent') {
      newAction = { type: 'transparent' };
    } else if (code === 'none') {
      newAction = { type: 'none' };
    } else {
      newAction = { type: 'basic', key: code as UniversalKey };
    }
    updateSelectedAction(newAction);
  };

  const handleTapKeycodeChange = (code: string) => {
    if (action.type === 'layer_tap' || action.type === 'mod_tap') {
      let tapAction: UniversalAction;
      if (code === 'transparent') {
        tapAction = { type: 'transparent' };
      } else if (code === 'none') {
        tapAction = { type: 'none' };
      } else {
        tapAction = { type: 'basic', key: code as UniversalKey };
      }
      updateSelectedAction({ ...action, tapAction });
    } else if (action.type === 'modifier') {
      updateSelectedAction({ ...action, key: code as UniversalKey });
    }
  };

  // Determine current active config type string
  let currentType = 'basic';
  if (['layer_momentary', 'layer_toggle', 'layer_to', 'layer_tap', 'mod_tap', 'modifier'].includes(action.type)) {
    currentType = action.type;
  }

  // Filter selectable keycodes
  const localizedKeycodes = SELECTABLE_KEYCODES.map(k => {
    if (k.code === 'transparent') return { ...k, description: t('keycode.transparentDesc') || 'Passes through the keycode of the layer below' };
    if (k.code === 'none') return { ...k, description: t('keycode.noneDesc') || 'Does nothing' };
    return k;
  });

  const filteredKeycodes = localizedKeycodes.filter(k =>
    k.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get current active keycode code
  let currentActiveCode = 'transparent';
  if (currentType === 'basic') {
    currentActiveCode = action.type === 'basic' ? action.key : action.type;
  } else if (action.type === 'layer_tap' || action.type === 'mod_tap') {
    currentActiveCode = action.tapAction.type === 'basic' ? action.tapAction.key : action.tapAction.type;
  } else if (action.type === 'modifier') {
    currentActiveCode = action.key;
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
                {currentType === 'basic' && (() => {
                  const desc = t('keycodeConfig.selectKeyDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Assign standard keys using the bottom palette.';
                })()}
                {['layer_momentary', 'layer_toggle', 'layer_to'].includes(currentType) && (() => {
                  const desc = t('keycodeConfig.layerDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Switches to the layer below or target layer.';
                })()}
                {currentType === 'layer_tap' && (() => {
                  const desc = t('keycodeConfig.layerTapDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Switches to target layer when held, sends keycode when tapped.';
                })()}
                {currentType === 'mod_tap' && (() => {
                  const desc = t('keycodeConfig.modTapDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Acts as modifiers when held, sends keycode when tapped.';
                })()}
                {currentType === 'modifier' && (() => {
                  const desc = t('keycodeConfig.modifierDescription');
                  return desc && !desc.startsWith('keycodeConfig.') ? desc : 'Sends modifier keys combined with a base key (e.g. Ctrl + Shift + A).';
                })()}
              </div>
            </div>
          </div>
          <select
            value={currentType}
            onChange={(e) => handleActionTypeChange(e.target.value)}
            className="w-full bg-[var(--bg-app)]/80 border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs font-bold text-[var(--text-highlight)] focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
          >
            <option value="basic">{t('keycodeConfig.typeBasic') || 'Basic Key / Transparent'}</option>
            <option value="layer_momentary">{t('keycodeConfig.typeMomentary') || 'Momentary Layer (MO)'}</option>
            <option value="layer_toggle">{t('keycodeConfig.typeToggle') || 'Toggle Layer (TG)'}</option>
            <option value="layer_to">{t('keycodeConfig.typeTo') || 'Direct Layer (TO)'}</option>
            <option value="layer_tap">{t('keycodeConfig.typeTap') || 'Layer Tap (LT)'}</option>
            <option value="mod_tap">{t('keycodeConfig.typeModTap') || 'Modifier Tap (MT)'}</option>
            <option value="modifier">{t('keycodeConfig.typeModifier') || 'Modifiers (Combo)'}</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
        {/* Layer Selector Grid */}
        {(action.type === 'layer_momentary' ||
          action.type === 'layer_toggle' ||
          action.type === 'layer_to' ||
          action.type === 'layer_tap') && (
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
        {(action.type === 'mod_tap' || action.type === 'modifier') && (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keycodeConfig.modifiers') || 'Modifiers'}
            </label>
            <div className="grid grid-cols-2 gap-1">
              {MODIFIERS.map(mod => {
                const isSelected = (action.type === 'mod_tap' || action.type === 'modifier') && action.modifiers.includes(mod);
                return (
                  <button
                    key={mod}
                    onClick={() => handleModifierToggle(mod)}
                    className={cn(
                      "px-2.5 py-1.5 text-[9px] font-black tracking-wide rounded transition-all flex items-center justify-between border",
                      isSelected
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        : "bg-[var(--bg-app)]/30 border-[var(--border-main)]/50 text-[var(--text-dim)] hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    <span>{mod}</span>
                    {isSelected && <Check size={10} className="text-amber-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Basic Keycode Search & Selection */}
        {currentType === 'basic' && (
          <div className="flex flex-col gap-2 flex-1 min-h-[220px]">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t('keymap.currentKeycode') || 'Keycode'}
            </label>
            
            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('keycodeConfig.searchKeycode') || 'Search keycode...'}
                className="w-full bg-[var(--bg-app)]/85 border border-[var(--border-main)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--text-highlight)] focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

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

            {/* Scrollable Keycode Grid */}
            <div className="flex-1 min-h-0 border border-[var(--border-main)] rounded-lg overflow-hidden bg-[var(--bg-app)]/10 flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                {filteredKeycodes.length === 0 ? (
                  <div className="p-6 text-center text-[10px] italic text-[var(--text-muted)]">
                    {t('keycodeConfig.noResults') || 'No keycodes found'}
                  </div>
                ) : (
                  filteredKeycodes.map(k => {
                    const isSelected = k.code === currentActiveCode;
                    return (
                      <button
                        key={k.code}
                        onClick={() => handleBasicKeycodeChange(k.code)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded text-[10px] font-bold transition-all flex items-center justify-between group",
                          isSelected
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "hover:bg-[var(--bg-hover)] text-[var(--text-main)]"
                        )}
                        title={k.description || k.code}
                      >
                        <div className="flex flex-col gap-0.5 max-w-[85%] truncate">
                          <span className="truncate">{k.label}</span>
                          <span className={cn(
                            "text-[8px] truncate leading-none font-medium",
                            isSelected ? "text-zinc-800" : "text-[var(--text-muted)] group-hover:text-[var(--text-dim)]"
                          )}>
                            {k.code}
                          </span>
                        </div>
                        {isSelected && <Check size={12} className="text-zinc-950 stroke-[3]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tap Action Keycode Search & Selection */}
        {(action.type === 'layer_tap' || action.type === 'mod_tap' || action.type === 'modifier') && (
          <div className="flex flex-col gap-2 flex-1 min-h-[220px]">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {action.type === 'modifier'
                ? (t('keycodeConfig.baseKeycode') || 'Base Keycode')
                : (t('keycodeConfig.tapKeycode') || 'Tap Keycode')}
            </label>
            
            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('keycodeConfig.searchKeycode') || 'Search keycode...'}
                className="w-full bg-[var(--bg-app)]/85 border border-[var(--border-main)] rounded-lg pl-9 pr-4 py-2 text-xs text-[var(--text-highlight)] focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

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

            {/* Scrollable Keycode Grid */}
            <div className="flex-1 min-h-0 border border-[var(--border-main)] rounded-lg overflow-hidden bg-[var(--bg-app)]/10 flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
                {filteredKeycodes.length === 0 ? (
                  <div className="p-6 text-center text-[10px] italic text-[var(--text-muted)]">
                    {t('keycodeConfig.noResults') || 'No keycodes found'}
                  </div>
                ) : (
                  filteredKeycodes.map(k => {
                    const isSelected = k.code === currentActiveCode;
                    return (
                      <button
                        key={k.code}
                        onClick={() => handleTapKeycodeChange(k.code)}
                        className={cn(
                          "w-full text-left px-2.5 py-2 rounded text-[10px] font-bold transition-all flex items-center justify-between group",
                          isSelected
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "hover:bg-[var(--bg-hover)] text-[var(--text-main)]"
                        )}
                        title={k.description || k.code}
                      >
                        <div className="flex flex-col gap-0.5 max-w-[85%] truncate">
                          <span className="truncate">{k.label}</span>
                          <span className={cn(
                            "text-[8px] truncate leading-none font-medium",
                            isSelected ? "text-zinc-800" : "text-[var(--text-muted)] group-hover:text-[var(--text-dim)]"
                          )}>
                            {k.code}
                          </span>
                        </div>
                        {isSelected && <Check size={12} className="text-zinc-950 stroke-[3]" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
