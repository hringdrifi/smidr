import React from 'react';
import { ArrowRight, Check, Plus, Sliders, Trash2, Workflow } from 'lucide-react';
import { ComboEntry, UniversalAction, UniversalKey } from '@/types/actions';
import { KEY_MAP } from '@/lib/protocols/via-action-converter';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AdvancedPanelScope } from './advanced-panel-types';
import { RightPanelEmptyState } from './RightPanelEmptyState';

type ComboPanelProps = {
  scope: AdvancedPanelScope;
};

export const ComboPanel: React.FC<ComboPanelProps> = ({ scope }) => {
  const { t } = useTranslation();
  const format = (path: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, String(value)),
      t(path)
    );
  const {
    remoteCombos,
    settings,
    addProjectCombo,
    updateProjectCombo,
    removeProjectCombo,
    updateRemoteCombo,
  } = useKeyboardStore();
  const combos = scope === 'device' ? remoteCombos : (settings.combos || []);
  const keyOptions = Object.keys(KEY_MAP).sort();
  const [editingComboIdx, setEditingComboIdx] = React.useState<number | null>(null);
  const [comboInputs, setComboInputs] = React.useState<UniversalAction[]>([
    { action: 'none' }, { action: 'none' }, { action: 'none' }, { action: 'none' }
  ]);
  const [comboOutput, setComboOutput] = React.useState<UniversalAction>({ action: 'none' });
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const startEditingCombo = (idx: number, combo: ComboEntry) => {
    setEditingComboIdx(idx);
    setComboInputs(Array.from({ length: 4 }, (_, i) => combo.inputs[i] || { action: 'none' }));
    setComboOutput(combo.output);
  };

  const saveCombo = async (idx: number) => {
    setIsSaving(true);
    try {
      const combo: ComboEntry = {
        inputs: comboInputs.filter(inp => inp.action !== 'none'),
        output: comboOutput || { action: 'none' }
      };

      if (scope === 'device') {
        await updateRemoteCombo(idx, combo);
        showMessage(format('macros.comboSaved', { id: idx }), 'success');
      } else {
        updateProjectCombo(idx, combo);
        showMessage(t('macros.projectComboSaved') || 'Project combo updated.', 'success');
      }
      setEditingComboIdx(null);
    } catch (err: any) {
      showMessage(err.message || t('macros.comboSaveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const keyToAction = (val: string): UniversalAction => (
    val === 'none' ? { action: 'none' } : { action: 'tap', keycode: val as UniversalKey }
  );

  const actionToKey = (action: UniversalAction) => (
    action.action === 'tap' ? action.keycode : 'none'
  );

  const updateComboKey = (slotIdx: number, val: string) => {
    const inputs = [...comboInputs];
    inputs[slotIdx] = keyToAction(val);
    setComboInputs(inputs);
  };

  if (combos.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-panel)]">
        {message && (
          <div className={cn(
            "px-4 py-2 text-xs font-semibold text-center border-b animate-in slide-in-from-top-4 duration-300",
            message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          )}>
            {message.text}
          </div>
        )}

        {scope === 'project' && (
          <div className="shrink-0 p-4 pb-0">
            <button
              onClick={addProjectCombo}
              className="h-9 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Plus size={13} />
              {t('macros.addCombo') || 'Add Combo'}
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <RightPanelEmptyState message={t('macros.noCombos')} icon={Workflow} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden text-zinc-200">
      {message && (
        <div className={cn(
          "px-4 py-2 text-xs font-semibold text-center border-b animate-in slide-in-from-top-4 duration-300",
          message.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
        )}>
          {message.text}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex min-h-full flex-col gap-4 p-4">
          {scope === 'project' && (
            <button
              onClick={addProjectCombo}
              className="h-9 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Plus size={13} />
              {t('macros.addCombo') || 'Add Combo'}
            </button>
          )}

            <div className="flex flex-col gap-3">
              {combos.map((combo, idx) => (
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
                          disabled={isSaving}
                          className="px-2 py-1 bg-amber-500 text-zinc-950 hover:bg-amber-600 text-[10px] font-black rounded flex items-center gap-1"
                        >
                          <Check size={10} />
                          {t('common.save')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditingCombo(idx, combo)}
                          className="px-2.5 py-1 border border-zinc-700 text-zinc-300 hover:border-amber-500/40 hover:text-amber-500 text-[10px] font-bold rounded transition-colors"
                        >
                          {t('macros.edit')}
                        </button>
                        {scope === 'project' && (
                          <button
                            onClick={() => removeProjectCombo(idx)}
                            className="px-2 py-1 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[10px] font-bold rounded transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {editingComboIdx === idx ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{t('macros.triggerInputs')}</span>
                        <div className="grid grid-cols-4 gap-2">
                          {comboInputs.map((input, slotIdx) => (
                            <select
                              key={slotIdx}
                              value={actionToKey(input)}
                              onChange={(e) => updateComboKey(slotIdx, e.target.value)}
                              className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-1.5 text-[10px] font-mono text-zinc-300 select-arrow"
                            >
                              <option value="none">{t('macros.noneOption')}</option>
                              {keyOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-[var(--border-main)] pt-3 mt-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{t('macros.triggerOutput')}</span>
                        <select
                          value={actionToKey(comboOutput)}
                          onChange={(e) => setComboOutput(keyToAction(e.target.value))}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {combo.inputs.filter(i => i.action === 'tap').map((i, sIdx) => (
                          <span key={sIdx} className="h-6 px-2 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-[10px] font-mono text-zinc-300 font-semibold">
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
        </div>
      </div>
    </div>
  );
};
