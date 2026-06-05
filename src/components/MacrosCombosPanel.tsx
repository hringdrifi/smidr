import React, { useState, useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { MacroAction, ComboEntry, UniversalAction, UniversalKey, TapDanceEntry } from '@/types/actions';
import { KEY_MAP } from '@/lib/protocols/via-action-converter';
import { 
  WandSparkles, 
  Trash2, 
  Plus, 
  Clock, 
  Keyboard, 
  Save, 
  ChevronUp, 
  ChevronDown, 
  Type, 
  Settings, 
  Workflow, 
  ArrowRight,
  Sliders,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const MacrosCombosPanel: React.FC = () => {
  const { t } = useTranslation();
  const format = (path: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      t(path)
    );
  const { 
    remoteMacros, 
    remoteCombos, 
    updateRemoteMacro, 
    updateRemoteCombo,
    syncMacrosAndCombos,
    updateRemoteTapDance,
    remoteTapDances,
    connectedDevice,
    macroPanelActiveTab,
    setMacroPanelActiveTab,
    selectedTapDanceId,
    setSelectedTapDanceId,
  } = useKeyboardStore();

  const activeTab = macroPanelActiveTab;
  const setActiveTab = setMacroPanelActiveTab;
  const [selectedMacroId, setSelectedMacroId] = useState<number>(0);
  const [macroEditMode, setMacroEditMode] = useState<'text' | 'sequence'>('text');
  
  // Local edit states to prevent high-frequency write calls to HID
  const [localMacroActions, setLocalMacroActions] = useState<MacroAction[]>([]);
  const [textValue, setTextValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-fill local edits when macro changes
  useEffect(() => {
    const macro = remoteMacros[selectedMacroId] || [];
    setLocalMacroActions(macro);
    
    // If it's a text-only macro, construct text value
    const isTextOnly = macro.every(a => a.action === 'text');
    if (isTextOnly) {
      setTextValue(macro.map(a => a.text).join(''));
      setMacroEditMode('text');
    } else {
      setTextValue('');
      setMacroEditMode('sequence');
    }
  }, [selectedMacroId, remoteMacros]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Convert text input back into single MacroAction
  const handleSaveTextMacro = async () => {
    setIsSaving(true);
    try {
      const actions: MacroAction[] = [{ action: 'text', text: textValue }];
      await updateRemoteMacro(selectedMacroId, actions);
      showMessage(t('macros.macroSaved'), 'success');
    } catch (err: any) {
      showMessage(err.message || t('macros.macroSaveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSequenceMacro = async (actions: MacroAction[]) => {
    setIsSaving(true);
    try {
      await updateRemoteMacro(selectedMacroId, actions);
      showMessage(t('macros.sequenceSaved'), 'success');
    } catch (err: any) {
      showMessage(err.message || t('macros.macroSaveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const addSequenceAction = (actType: MacroAction['action']) => {
    const newActions = [...localMacroActions];
    if (actType === 'delay') {
      newActions.push({ action: 'delay', duration: 100 });
    } else if (actType === 'text') {
      newActions.push({ action: 'text', text: 'Text' });
    } else {
      newActions.push({ action: actType, keycodes: ['A'] });
    }
    setLocalMacroActions(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = localMacroActions.filter((_, idx) => idx !== index);
    setLocalMacroActions(newActions);
  };

  const updateActionKey = (index: number, keyIndex: number, newKey: string) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act && act.keycodes) {
      act.keycodes[keyIndex] = newKey;
      setLocalMacroActions(newActions);
    }
  };

  const updateActionDelay = (index: number, duration: number) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act && act.action === 'delay') {
      act.duration = duration;
      setLocalMacroActions(newActions);
    }
  };

  const updateActionText = (index: number, text: string) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act && act.action === 'text') {
      act.text = text;
      setLocalMacroActions(newActions);
    }
  };

  const moveAction = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localMacroActions.length - 1) return;
    
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newActions = [...localMacroActions];
    const temp = newActions[index];
    newActions[index] = newActions[targetIdx];
    newActions[targetIdx] = temp;
    
    setLocalMacroActions(newActions);
  };

  // --- Combos local save handlers ---
  const [editingComboIdx, setEditingComboIdx] = useState<number | null>(null);
  const [comboInputs, setComboInputs] = useState<UniversalAction[]>([
    { action: 'none' }, { action: 'none' }, { action: 'none' }, { action: 'none' }
  ]);
  const [comboOutput, setComboOutput] = useState<UniversalAction>({ action: 'none' });

  const startEditingCombo = (idx: number, combo: ComboEntry) => {
    setEditingComboIdx(idx);
    const pads = Array.from({ length: 4 }, (_, i) => combo.inputs[i] || { action: 'none' });
    setComboInputs(pads);
    setComboOutput(combo.output);
  };

  const saveCombo = async (idx: number) => {
    setIsSaving(true);
    try {
      const inputs = comboInputs.filter(inp => inp.action !== 'none');
      const combo: ComboEntry = {
        inputs,
        output: comboOutput || { action: 'none' }
      };
      await updateRemoteCombo(idx, combo);
      setEditingComboIdx(null);
      showMessage(format('macros.comboSaved', { id: idx }), 'success');
    } catch (err: any) {
      showMessage(err.message || t('macros.comboSaveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateComboKey = (slotIdx: number, val: string) => {
    const action: UniversalAction = val === 'none' ? { action: 'none' } : { action: 'tap', keycode: val as UniversalKey };
    const inputs = [...comboInputs];
    inputs[slotIdx] = action;
    setComboInputs(inputs);
  };

  const updateComboOutput = (val: string) => {
    const action: UniversalAction = val === 'none' ? { action: 'none' } : { action: 'tap', keycode: val as UniversalKey };
    setComboOutput(action);
  };

  const isVialRemap = connectedDevice?.protocolType === 'vial';
  const keyToAction = (keycode: string): UniversalAction => (
    keycode === 'none' ? { action: 'none' } : { action: 'tap', keycode: keycode as UniversalKey }
  );
  const actionToKey = (tdAction: UniversalAction | undefined, fallback = 'A') => (
    tdAction?.action === 'none' ? 'none' : tdAction?.action === 'tap' ? tdAction.keycode : fallback
  );

  const selectedTapDance = remoteTapDances.find(td => td.id === selectedTapDanceId) || remoteTapDances[0] || null;
  const updateSelectedTapDance = (patch: Partial<TapDanceEntry>) => {
    if (!selectedTapDance) return;
    const next: TapDanceEntry = {
      ...selectedTapDance,
      ...patch,
      id: selectedTapDance.id,
    };
    void updateRemoteTapDance(next.id, next).catch((err: any) => {
      console.error(`Failed to update Tap Dance ${next.id}:`, err);
    });
  };

  useEffect(() => {
    if (activeTab === 'tapDance' && !isVialRemap) {
      setActiveTab('macros');
    }
  }, [activeTab, isVialRemap, setActiveTab]);

  useEffect(() => {
    if (
      activeTab === 'tapDance' &&
      isVialRemap &&
      remoteTapDances.length > 0 &&
      !remoteTapDances.some(td => td.id === selectedTapDanceId)
    ) {
      setSelectedTapDanceId(remoteTapDances[0].id);
    }
  }, [activeTab, isVialRemap, remoteTapDances, selectedTapDanceId, setSelectedTapDanceId]);

  const keyOptions = Object.keys(KEY_MAP).sort();
  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden text-zinc-200">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border-main)] bg-zinc-950/40 p-1">
        <button
          onClick={() => setActiveTab('macros')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-lg",
            activeTab === 'macros' 
              ? "bg-amber-500 text-zinc-950 shadow-md" 
              : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <WandSparkles size={14} />
          {t('macros.macros')}
        </button>
        <button
          onClick={() => setActiveTab('combos')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-lg",
            activeTab === 'combos' 
              ? "bg-amber-500 text-zinc-950 shadow-md" 
              : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]"
          )}
        >
          <Workflow size={14} />
          {t('macros.combos')}
        </button>
        {isVialRemap && (
          <button
            onClick={() => setActiveTab('tapDance')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 rounded-lg",
              activeTab === 'tapDance'
                ? "bg-amber-500 text-zinc-950 shadow-md"
                : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]"
            )}
          >
            <Sliders size={14} />
            Tap Dance
          </button>
        )}
      </div>

      {/* Messages */}
      {message && (
        <div className={cn(
          "px-4 py-2 text-xs font-semibold text-center border-b animate-in slide-in-from-top-4 duration-300",
          message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          {message.text}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {activeTab === 'macros' ? (
          <div className="flex flex-col gap-4">
            {/* Macro Selector */}
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 16 }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedMacroId(idx)}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-black transition-all duration-300 flex items-center justify-center",
                    selectedMacroId === idx
                      ? "bg-amber-500/15 border-amber-500 text-amber-500 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                      : "bg-zinc-900/50 border-[var(--border-main)] hover:border-zinc-500 text-zinc-400"
                  )}
                >
                  M{idx}
                </button>
              ))}
            </div>

            {/* Editor Container */}
            <div className="border border-[var(--border-main)] bg-zinc-950/20 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-3">
                <span className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                  <Settings size={14} className="animate-spin-slow" />
                  {format('macros.macroEditor', { id: selectedMacroId })}
                </span>
                
                <div className="flex bg-zinc-900 border border-[var(--border-main)] p-0.5 rounded-lg">
                  <button
                    onClick={() => setMacroEditMode('text')}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors",
                      macroEditMode === 'text' ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {t('macros.text')}
                  </button>
                  <button
                    onClick={() => setMacroEditMode('sequence')}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors",
                      macroEditMode === 'sequence' ? "bg-amber-500 text-zinc-950" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {t('macros.sequence')}
                  </button>
                </div>
              </div>

              {macroEditMode === 'text' ? (
                /* Text mode editor */
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">{t('macros.textSimulation')}</label>
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder={t('macros.textPlaceholder')}
                    className="w-full min-h-[100px] bg-zinc-950/50 border border-[var(--border-main)] rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500/50 transition-colors custom-scrollbar font-mono leading-relaxed"
                  />
                  <div className="text-[10px] text-zinc-500 leading-relaxed bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-start gap-2">
                    <Clock size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    <span>{t('macros.textDesc')}</span>
                  </div>
                  <button
                    onClick={handleSaveTextMacro}
                    disabled={isSaving}
                    className="w-full h-9 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                  >
                    <Save size={14} />
                    {isSaving ? t('macros.saving') : t('macros.saveToKeyboard')}
                  </button>
                </div>
              ) : (
                /* Sequence mode editor */
                <div className="flex flex-col gap-4">
                  {/* Timeline listing */}
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {localMacroActions.length === 0 ? (
                      <div className="text-center py-8 text-xs text-zinc-500">
                        {t('macros.noActions')}
                      </div>
                    ) : (
                      localMacroActions.map((action, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-2 bg-zinc-900/50 border border-[var(--border-main)] hover:border-zinc-700 p-2 rounded-lg transition-all"
                        >
                          {/* Reordering */}
                          <div className="flex flex-col shrink-0">
                            <button onClick={() => moveAction(idx, 'up')} className="text-zinc-500 hover:text-zinc-300">
                              <ChevronUp size={14} />
                            </button>
                            <button onClick={() => moveAction(idx, 'down')} className="text-zinc-500 hover:text-zinc-300">
                              <ChevronDown size={14} />
                            </button>
                          </div>

                          {/* Action specifics */}
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            {action.action === 'delay' ? (
                              <>
                                <Clock size={13} className="text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t('macros.delay')}</span>
                                <input
                                  type="number"
                                  value={action.duration || 0}
                                  onChange={(e) => updateActionDelay(idx, Number(e.target.value))}
                                  className="w-20 h-7 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-xs focus:outline-none focus:border-amber-500/50 font-mono text-amber-500 font-semibold"
                                />
                                <span className="text-[10px] text-zinc-500 font-bold font-mono">ms</span>
                              </>
                            ) : action.action === 'text' ? (
                              <>
                                <Type size={13} className="text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">{t('macros.text')}</span>
                                <input
                                  type="text"
                                  value={action.text || ''}
                                  onChange={(e) => updateActionText(idx, e.target.value)}
                                  className="flex-1 h-7 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-xs focus:outline-none focus:border-amber-500/50 font-mono"
                                />
                              </>
                            ) : (
                              <>
                                <Keyboard size={13} className="text-amber-500 shrink-0" />
                                <span className="text-[10px] font-bold text-zinc-500 uppercase min-w-[36px]">{action.action}</span>
                                {action.keycodes?.map((key, keyIdx) => (
                                  <select
                                    key={keyIdx}
                                    value={key}
                                    onChange={(e) => updateActionKey(idx, keyIdx, e.target.value)}
                                    className="flex-1 h-7 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-xs focus:outline-none focus:border-amber-500/50 font-mono text-zinc-200 select-arrow"
                                  >
                                    {keyOptions.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ))}
                              </>
                            )}
                          </div>

                          {/* Delete */}
                          <button 
                            onClick={() => removeAction(idx)}
                            className="p-1 hover:bg-rose-500/20 rounded text-rose-400/80 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Actions to insert */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-[var(--border-main)] pt-3 gap-2">
                    <button
                      onClick={() => addSequenceAction('tap')}
                      className="h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-zinc-300 hover:text-amber-500"
                    >
                      <Plus size={10} />
                      {t('macros.tapKey')}
                    </button>
                    <button
                      onClick={() => addSequenceAction('down')}
                      className="h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-zinc-300 hover:text-amber-500"
                    >
                      <Plus size={10} />
                      {t('macros.downKey')}
                    </button>
                    <button
                      onClick={() => addSequenceAction('up')}
                      className="h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-zinc-300 hover:text-amber-500"
                    >
                      <Plus size={10} />
                      {t('macros.upKey')}
                    </button>
                    <button
                      onClick={() => addSequenceAction('delay')}
                      className="h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-zinc-300 hover:text-amber-500"
                    >
                      <Plus size={10} />
                      {t('macros.delay')}
                    </button>
                    <button
                      onClick={() => addSequenceAction('text')}
                      className="col-span-2 sm:col-span-1 h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-zinc-300 hover:text-amber-500"
                    >
                      <Plus size={10} />
                      {t('macros.text')}
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={() => handleSaveSequenceMacro(localMacroActions)}
                    disabled={isSaving}
                    className="w-full h-9 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                  >
                    <Save size={14} />
                    {isSaving ? t('macros.saving') : t('macros.saveSequence')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'combos' ? (
          /* Combos Panel content */
          <div className="flex flex-col gap-4">
            {remoteCombos.length === 0 ? (
              <div className="text-center py-12 bg-zinc-950/20 border border-[var(--border-main)] rounded-2xl p-6">
                <Workflow className="w-10 h-10 text-zinc-600 mx-auto mb-3 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{t('macros.noCombos')}</h3>
                <p className="text-[10px] text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                  {t('macros.noCombosDesc')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {remoteCombos.map((combo, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "border rounded-xl p-4 transition-all duration-300 flex flex-col gap-3",
                      editingComboIdx === idx
                        ? "bg-amber-500/5 border-amber-500/50 shadow-[0_4px_25px_rgba(245,158,11,0.05)]"
                        : "bg-zinc-950/20 border-[var(--border-main)] hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border-main)]/60 pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        <Sliders size={12} className="text-amber-500" />
                        {format('macros.combo', { id: idx })}
                      </span>
                      
                      {editingComboIdx === idx ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingComboIdx(null)}
                            className="px-2 py-1 bg-zinc-900 border border-[var(--border-main)] text-zinc-400 hover:text-zinc-200 text-[10px] font-bold rounded"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            onClick={() => saveCombo(idx)}
                            className="px-2 py-1 bg-amber-500 text-zinc-950 hover:bg-amber-600 text-[10px] font-black rounded flex items-center gap-1"
                          >
                            <Check size={10} />
                            {t('common.save')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingCombo(idx, combo)}
                          className="px-2.5 py-1 border border-zinc-700 text-zinc-300 hover:border-amber-500/40 hover:text-amber-500 text-[10px] font-bold rounded transition-colors"
                        >
                          {t('macros.edit')}
                        </button>
                      )}
                    </div>

                    {editingComboIdx === idx ? (
                      /* Editing Combo states */
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{t('macros.triggerInputs')}</span>
                          <div className="grid grid-cols-4 gap-2">
                            {comboInputs.map((input, slotIdx) => {
                              const keyStr = input.action === 'tap' ? input.keycode : 'none';
                              return (
                                <select
                                  key={slotIdx}
                                  value={keyStr}
                                  onChange={(e) => updateComboKey(slotIdx, e.target.value)}
                                  className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-1.5 text-[10px] font-mono text-zinc-300 select-arrow"
                                >
                                  <option value="none">{t('macros.noneOption')}</option>
                                  {keyOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-[var(--border-main)] pt-3 mt-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{t('macros.triggerOutput')}</span>
                          <select
                            value={comboOutput.action === 'tap' ? comboOutput.keycode : 'none'}
                            onChange={(e) => updateComboOutput(e.target.value)}
                            className="w-40 h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-amber-500 font-bold select-arrow"
                          >
                            <option value="none">{t('macros.noneOption')}</option>
                            {keyOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      /* Display Combo values */
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {/* List non-none trigger inputs */}
                          {combo.inputs
                            .filter(i => i.action === 'tap')
                            .map((i, sIdx) => (
                              <span 
                                key={sIdx}
                                className="h-6 px-2 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-[10px] font-mono text-zinc-300 font-semibold"
                              >
                                {(i as any).keycode}
                              </span>
                            ))}
                        </div>
                        
                        <ArrowRight size={14} className="text-zinc-600 shrink-0 mx-2" />
                        
                        <span className="h-6 px-2.5 bg-amber-500/10 border border-amber-500/20 rounded flex items-center justify-center text-[10px] font-mono text-amber-500 font-bold">
                          {combo.output.action === 'tap' ? combo.output.keycode : 'NONE'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {remoteTapDances.length === 0 ? (
              <div className="text-center py-12 bg-zinc-950/20 border border-[var(--border-main)] rounded-2xl p-6">
                <Sliders className="w-10 h-10 text-zinc-600 mx-auto mb-3 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">No Tap Dance</h3>
                <p className="text-[10px] text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                  This Vial device did not report dynamic Tap Dance entries.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {remoteTapDances.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedTapDanceId(entry.id)}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-black transition-all duration-300 flex items-center justify-center",
                        selectedTapDance?.id === entry.id
                          ? "bg-amber-500/15 border-amber-500 text-amber-500 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                          : "bg-zinc-900/50 border-[var(--border-main)] hover:border-zinc-500 text-zinc-400"
                      )}
                    >
                      TD{entry.id}
                    </button>
                  ))}
                </div>

                {selectedTapDance && (
                  <div className="border border-[var(--border-main)] bg-zinc-950/20 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-3">
                      <span className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                        <Settings size={14} />
                        TD{selectedTapDance.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tap</label>
                        <select
                          value={actionToKey(selectedTapDance.tapAction, 'ESC')}
                          onChange={(e) => updateSelectedTapDance({ tapAction: keyToAction(e.target.value) })}
                          className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 select-arrow"
                        >
                          <option value="none">{t('macros.noneOption')}</option>
                          {keyOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Hold</label>
                        <select
                          value={actionToKey(selectedTapDance.holdAction, 'none')}
                          onChange={(e) => updateSelectedTapDance({ holdAction: keyToAction(e.target.value) })}
                          className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 select-arrow"
                        >
                          <option value="none">{t('macros.noneOption')}</option>
                          {keyOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Double Tap</label>
                        <select
                          value={actionToKey(selectedTapDance.doubleTapAction, 'none')}
                          onChange={(e) => updateSelectedTapDance({ doubleTapAction: keyToAction(e.target.value) })}
                          className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 select-arrow"
                        >
                          <option value="none">{t('macros.noneOption')}</option>
                          {keyOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tap Hold</label>
                        <select
                          value={actionToKey(selectedTapDance.tapHoldAction, 'none')}
                          onChange={(e) => updateSelectedTapDance({ tapHoldAction: keyToAction(e.target.value) })}
                          className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 select-arrow"
                        >
                          <option value="none">{t('macros.noneOption')}</option>
                          {keyOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tapping Term</label>
                      <input
                        type="number"
                        min={1}
                        value={selectedTapDance.tappingTerm ?? 200}
                        onChange={(e) => updateSelectedTapDance({ tappingTerm: Number(e.target.value) })}
                        className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 focus:outline-none focus:border-amber-500/70"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
