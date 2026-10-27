import React from 'react';
import { ChevronDown, ChevronUp, Clock, Keyboard, Plus, Save, Settings, Trash2, Type } from 'lucide-react';
import { MacroAction } from '@/types/actions';
import { KEY_MAP } from '@/lib/protocols/via-action-converter';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AdvancedPanelScope } from './advanced-panel-types';

type MacroPanelProps = {
  scope: AdvancedPanelScope;
};

export const MacroPanel: React.FC<MacroPanelProps> = ({ scope }) => {
  const { t } = useTranslation();
  const {
    remoteMacros,
    settings,
    updateRemoteMacro,
    updateProjectMacro,
    selectedMacroId,
    setSelectedMacroId,
  } = useKeyboardStore();

  const activeMacros = scope === 'device' ? remoteMacros : (settings.macros || []);
  const [macroEditMode, setMacroEditMode] = React.useState<'text' | 'sequence'>('text');
  const [localMacroActions, setLocalMacroActions] = React.useState<MacroAction[]>([]);
  const [textValue, setTextValue] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const keyOptions = Object.keys(KEY_MAP).sort();

  React.useEffect(() => {
    const macro = activeMacros[selectedMacroId] || [];
    setLocalMacroActions(macro);

    const isTextOnly = macro.every(a => a.action === 'text');
    if (isTextOnly) {
      setTextValue(macro.map(a => a.text).join(''));
      setMacroEditMode('text');
    } else {
      setTextValue('');
      setMacroEditMode('sequence');
    }
  }, [selectedMacroId, activeMacros]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveMacro = async (actions: MacroAction[], successText: string) => {
    setIsSaving(true);
    try {
      if (scope === 'device') {
        await updateRemoteMacro(selectedMacroId, actions);
      } else {
        updateProjectMacro(selectedMacroId, actions);
      }
      showMessage(successText, 'success');
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
    setLocalMacroActions(localMacroActions.filter((_, idx) => idx !== index));
  };

  const updateActionKey = (index: number, keyIndex: number, newKey: string) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act?.keycodes) {
      act.keycodes[keyIndex] = newKey;
      setLocalMacroActions(newActions);
    }
  };

  const updateActionDelay = (index: number, duration: number) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act?.action === 'delay') {
      act.duration = duration;
      setLocalMacroActions(newActions);
    }
  };

  const updateActionText = (index: number, text: string) => {
    const newActions = [...localMacroActions];
    const act = newActions[index];
    if (act?.action === 'text') {
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

  const saveTextMacro = () => {
    const actions: MacroAction[] = [{ action: 'text', text: textValue }];
    void saveMacro(
      actions,
      scope === 'device' ? t('macros.macroSaved') : (t('macros.projectMacroSaved') || 'Project macro updated.')
    );
  };

  const saveSequenceMacro = () => {
    void saveMacro(
      localMacroActions,
      scope === 'device' ? t('macros.sequenceSaved') : (t('macros.projectMacroSaved') || 'Project macro updated.')
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden text-[var(--text-main)]">
      {message && (
        <div className={cn(
          "px-4 py-2 text-xs font-semibold text-center border-b animate-in slide-in-from-top-4 duration-300",
          message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          {message.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 16 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedMacroId(idx)}
                className={cn(
                  "h-9 rounded-lg border text-xs font-black transition-all duration-300 flex items-center justify-center",
                  selectedMacroId === idx
                    ? "bg-amber-500/15 border-amber-500 text-amber-500 font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    : "bg-[var(--bg-button)] border-[var(--border-main)] hover:border-amber-500/40 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
              >
                M{idx}
              </button>
            ))}
          </div>

          <div className="border border-[var(--border-main)] bg-[var(--bg-app)]/40 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-3">
              <span className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                <Settings size={14} />
                {t('macros.macroEditor').replace('{id}', String(selectedMacroId))}
              </span>

              <div className="flex bg-[var(--bg-button)] border border-[var(--border-main)] p-0.5 rounded-lg">
                <button
                  onClick={() => setMacroEditMode('text')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors",
                    macroEditMode === 'text' ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:text-[var(--text-highlight)]"
                  )}
                >
                  {t('macros.text')}
                </button>
                <button
                  onClick={() => setMacroEditMode('sequence')}
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors",
                    macroEditMode === 'sequence' ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:text-[var(--text-highlight)]"
                  )}
                >
                  {t('macros.sequence')}
                </button>
              </div>
            </div>

            {macroEditMode === 'text' ? (
              <div className="flex flex-col gap-3">
                <label className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">{t('macros.textSimulation')}</label>
                <textarea
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder={t('macros.textPlaceholder')}
                  className="w-full min-h-[100px] bg-[var(--bg-app)] border border-[var(--border-main)] rounded-lg p-3 text-xs text-[var(--text-main)] focus:outline-none focus:border-amber-500/50 transition-colors custom-scrollbar font-mono leading-relaxed"
                />
                <div className="text-[10px] text-[var(--text-muted)] leading-relaxed bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg flex items-start gap-2">
                  <Clock size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>{t('macros.textDesc')}</span>
                </div>
                <button
                  onClick={saveTextMacro}
                  disabled={isSaving}
                  className="w-full h-9 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                >
                  <Save size={14} />
                  {isSaving ? t('macros.saving') : (scope === 'device' ? t('macros.saveToKeyboard') : t('common.save'))}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {localMacroActions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[var(--text-muted)]">{t('macros.noActions')}</div>
                  ) : (
                    localMacroActions.map((action, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-[var(--bg-app)]/60 border border-[var(--border-main)] hover:border-amber-500/30 p-2 rounded-lg transition-all">
                        <div className="flex flex-col shrink-0">
                          <button onClick={() => moveAction(idx, 'up')} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            <ChevronUp size={14} />
                          </button>
                          <button onClick={() => moveAction(idx, 'down')} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                            <ChevronDown size={14} />
                          </button>
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-0">
                          {action.action === 'delay' ? (
                            <>
                              <Clock size={13} className="text-amber-500 shrink-0" />
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t('macros.delay')}</span>
                              <input
                                type="number"
                                value={action.duration || 0}
                                onChange={(e) => updateActionDelay(idx, Number(e.target.value))}
                                className="w-20 h-7 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-2 text-xs focus:outline-none focus:border-amber-500/50 font-mono text-amber-500 font-semibold"
                              />
                              <span className="text-[10px] text-[var(--text-muted)] font-bold font-mono">ms</span>
                            </>
                          ) : action.action === 'text' ? (
                            <>
                              <Type size={13} className="text-amber-500 shrink-0" />
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{t('macros.text')}</span>
                              <input
                                type="text"
                                value={action.text || ''}
                                onChange={(e) => updateActionText(idx, e.target.value)}
                                className="flex-1 h-7 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-amber-500/50 font-mono"
                              />
                            </>
                          ) : (
                            <>
                              <Keyboard size={13} className="text-amber-500 shrink-0" />
                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase min-w-[36px]">{action.action}</span>
                              {action.keycodes?.map((key, keyIdx) => (
                                <select
                                  key={keyIdx}
                                  value={key}
                                  onChange={(e) => updateActionKey(idx, keyIdx, e.target.value)}
                                  className="flex-1 h-7 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded px-2 text-xs focus:outline-none focus:border-amber-500/50 font-mono text-[var(--text-main)] select-arrow"
                                >
                                  {keyOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ))}
                            </>
                          )}
                        </div>

                        <button onClick={() => removeAction(idx)} className="p-1 hover:bg-rose-500/20 rounded text-rose-400/80 hover:text-rose-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-[var(--border-main)] pt-3 gap-2">
                  {(['tap', 'down', 'up', 'delay', 'text'] as const).map((action) => (
                    <button
                      key={action}
                      onClick={() => addSequenceAction(action)}
                      className={cn(
                        "h-8 border border-[var(--border-main)] hover:border-amber-500/40 hover:bg-amber-500/5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-[var(--text-main)] hover:text-amber-500",
                        action === 'text' && "col-span-2 sm:col-span-1"
                      )}
                    >
                      <Plus size={10} />
                      {action === 'tap' ? t('macros.tapKey') : action === 'down' ? t('macros.downKey') : action === 'up' ? t('macros.upKey') : t(`macros.${action}`)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={saveSequenceMacro}
                  disabled={isSaving}
                  className="w-full h-9 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-zinc-950 text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
                >
                  <Save size={14} />
                  {isSaving ? t('macros.saving') : (scope === 'device' ? t('macros.saveSequence') : t('common.save'))}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
