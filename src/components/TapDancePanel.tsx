import React from 'react';
import { Plus, Settings, Sliders, Trash2 } from 'lucide-react';
import { TapDanceEntry, UniversalAction, UniversalKey } from '@/types/actions';
import { KEY_MAP } from '@/lib/protocols/via-action-converter';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AdvancedPanelScope } from './advanced-panel-types';

type TapDancePanelProps = {
  scope: AdvancedPanelScope;
};

export const TapDancePanel: React.FC<TapDancePanelProps> = ({ scope }) => {
  const { t } = useTranslation();
  const {
    settings,
    remoteTapDances,
    updateRemoteTapDance,
    updateTapDance,
    removeTapDance,
    selectedTapDanceId,
    setSelectedTapDanceId,
  } = useKeyboardStore();
  const tapDances = scope === 'device' ? remoteTapDances : (settings.tapDances || []);
  const keyOptions = Object.keys(KEY_MAP).sort();

  React.useEffect(() => {
    if (tapDances.length > 0 && !tapDances.some(td => td.id === selectedTapDanceId)) {
      setSelectedTapDanceId(tapDances[0].id);
    }
  }, [tapDances, selectedTapDanceId, setSelectedTapDanceId]);

  const selectedTapDance = tapDances.find(td => td.id === selectedTapDanceId) || tapDances[0] || null;

  const keyToAction = (keycode: string): UniversalAction => (
    keycode === 'none' ? { action: 'none' } : { action: 'tap', keycode: keycode as UniversalKey }
  );
  const actionToKey = (tdAction: UniversalAction | undefined, fallback = 'A') => (
    tdAction?.action === 'none' ? 'none' : tdAction?.action === 'tap' ? tdAction.keycode : fallback
  );

  const updateSelectedTapDance = (patch: Partial<TapDanceEntry>) => {
    if (!selectedTapDance) return;
    const next: TapDanceEntry = {
      ...selectedTapDance,
      ...patch,
      id: selectedTapDance.id,
    };

    if (scope === 'device') {
      void updateRemoteTapDance(next.id, next).catch((err: any) => {
        console.error(`Failed to update Tap Dance ${next.id}:`, err);
      });
    } else {
      updateTapDance(next.id, next);
    }
  };

  const addProjectTapDance = () => {
    const nextId = Math.max(-1, ...(settings.tapDances || []).map(td => td.id)) + 1;
    const next: TapDanceEntry = {
      id: nextId,
      tapAction: { action: 'tap', keycode: 'A' },
      holdAction: { action: 'none' },
      doubleTapAction: { action: 'none' },
      tapHoldAction: { action: 'none' },
      tappingTerm: 200,
    };
    updateTapDance(nextId, next);
    setSelectedTapDanceId(nextId);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] overflow-hidden text-zinc-200">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        <div className="flex flex-col gap-4">
          {scope === 'project' && (
            <button
              onClick={addProjectTapDance}
              className="h-9 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-zinc-950 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Plus size={13} />
              {t('macros.addTapDance') || 'Add Tap Dance'}
            </button>
          )}

          {tapDances.length === 0 ? (
            <div className="text-center py-12 bg-zinc-950/20 border border-[var(--border-main)] rounded-2xl p-6">
              <Sliders className="w-10 h-10 text-zinc-600 mx-auto mb-3 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{t('macros.noTapDance') || 'No Tap Dance'}</h3>
              <p className="text-[10px] text-zinc-500 max-w-[240px] mx-auto leading-relaxed">
                {scope === 'device'
                  ? (t('macros.noTapDanceDesc') || 'This Vial device did not report dynamic Tap Dance entries.')
                  : (t('macros.noProjectTapDanceDesc') || 'No project Tap Dance definitions have been added yet.')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {tapDances.map((entry) => (
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
                    {scope === 'project' && (
                      <button
                        onClick={() => removeTapDance(selectedTapDance.id)}
                        className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ['tapAction', 'Tap', 'ESC'],
                      ['holdAction', 'Hold', 'none'],
                      ['doubleTapAction', 'Double Tap', 'none'],
                      ['tapHoldAction', 'Tap Hold', 'none'],
                    ] as const).map(([field, label, fallback]) => (
                      <div key={field} className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>
                        <select
                          value={actionToKey(selectedTapDance[field], fallback)}
                          onChange={(e) => updateSelectedTapDance({ [field]: keyToAction(e.target.value) })}
                          className="h-8 bg-zinc-950 border border-[var(--border-main)] rounded px-2 text-[10px] font-mono text-zinc-300 select-arrow"
                        >
                          <option value="none">{t('macros.noneOption')}</option>
                          {keyOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    ))}
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
      </div>
    </div>
  );
};
