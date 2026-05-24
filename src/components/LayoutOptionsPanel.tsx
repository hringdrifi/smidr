'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Plus, Trash2, Check, Settings2, List, ToggleLeft, Edit2, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';

export const LayoutOptionsPanel = () => {
  const { 
    settings, 
    editorMode,
    addLayoutOptionGroup, 
    removeLayoutOptionGroup, 
    addLayoutOptionChoice, 
    removeLayoutOptionChoice, 
    renameLayoutOptionChoice,
    setActiveOption,
    setLayoutOptionGroupType,
    appMode
  } = useKeyboardStore();
  const { t } = useTranslation();
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  const isLayoutMode = appMode === 'design' && editorMode === 'layout';

  const handleAddGroup = () => {
    if (!isLayoutMode) return;
    const name = prompt(t('options.groupNamePrompt'));
    if (name) addLayoutOptionGroup(name);
  };

  const handleAddChoice = (groupId: string) => {
    if (!isLayoutMode) return;
    const name = prompt(t('options.choiceNamePrompt'));
    if (name) addLayoutOptionChoice(groupId, name);
  };

  const handleRenameChoice = (groupId: string, index: number, currentName: string) => {
    if (!isLayoutMode) return;
    const newName = prompt(t('options.newNamePrompt'), currentName);
    if (newName && newName !== currentName) {
      renameLayoutOptionChoice(groupId, index, newName);
    }
  };

  const groups = Object.entries(settings.layoutOptions);

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-right-1 duration-200">
      {/* Header - Sticky and Full Width */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-[var(--border-main)] bg-[var(--bg-panel)]/95 backdrop-blur-sm shrink-0 mb-4">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-amber-500" />
          <h2 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('options.title')}</h2>
        </div>
        {isLayoutMode && (
          <button 
            onClick={handleAddGroup}
            className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-main)] hover:text-amber-500 transition-colors"
            title={t('options.addGroup')}
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="px-4 pb-4 space-y-6">

      {groups.length === 0 ? (
        <div className="bg-[var(--bg-button)]/50 border border-[var(--border-main)] rounded-md p-3">
          <p className="text-xs text-[var(--text-muted)] text-center">{t('options.noOptions')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([id, group]) => {
            const isToggle = group.type === 'toggle';
            const activeIndex = settings.activeOptions[id] ?? 0;

            if (!isLayoutMode) {
              // MINIMAL UI (Remap mode or non-layout Design mode)
              return (
                <div key={id} className={cn(
                  "bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-lg transition-colors p-3",
                  isToggle ? "flex items-center justify-between" : "flex flex-col gap-2"
                )}>
                  <span className="text-[11px] font-bold text-[var(--text-highlight)] uppercase tracking-tight truncate">
                    {group.name}
                  </span>

                  {isToggle ? (
                    <button
                      onClick={() => setActiveOption(id, activeIndex === 1 ? 0 : 1)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
                        activeIndex === 1 ? 'bg-amber-500' : 'bg-[var(--bg-button)] border border-[var(--border-main)]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          activeIndex === 1 ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === id ? null : id)}
                        className="w-full flex items-center justify-between bg-[var(--bg-app)] border border-[var(--border-main)] rounded-md px-3 py-2 text-[10px] font-bold text-[var(--text-highlight)] hover:bg-[var(--bg-hover)] transition-all group/btn uppercase tracking-wider"
                      >
                        <span className="truncate">{group.choices?.[activeIndex] || 'Choice ' + activeIndex}</span>
                        <ChevronDown size={12} className={cn("text-[var(--text-dim)] transition-transform duration-300", openMenuId === id && "rotate-180")} />
                      </button>

                      {openMenuId === id && (
                        <>
                          <div className="fixed inset-0 z-[100]" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[110] overflow-hidden animate-in fade-in slide-in-from-top-1">
                            <div className="p-1 flex flex-col gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                              {group.choices?.map((choice, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    setActiveOption(id, index);
                                    setOpenMenuId(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                                    activeIndex === index 
                                      ? "bg-amber-500 text-zinc-950 shadow-sm" 
                                      : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                                  )}
                                >
                                  {choice}
                                  {activeIndex === index && <Check size={12} className="opacity-40" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // FULL EDITABLE UI
            return (
              <div key={id} className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-lg overflow-hidden">
                <div className="bg-[var(--bg-button)]/50 px-3 py-2 flex items-center justify-between border-b border-[var(--border-main)]">
                  <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-tight">{group.name}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setLayoutOptionGroupType(id, isToggle ? 'list' : 'toggle')}
                      className={`p-1 rounded transition-colors ${isToggle ? 'text-amber-500 bg-amber-500/10' : 'text-[var(--text-muted)] hover:bg-[var(--bg-button)]'}`}
                      title={isToggle ? t('options.switchToList') : t('options.switchToToggle')}
                    >
                      {isToggle ? <ToggleLeft size={14} /> : <List size={14} />}
                    </button>
                    <button 
                      onClick={() => removeLayoutOptionGroup(id)}
                      className="p-1 hover:bg-[var(--bg-button)] rounded text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="p-2 space-y-1">
                  {isToggle ? (
                    <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--bg-app)] rounded-md border border-[var(--border-main)]">
                      <span className="text-[10px] text-[var(--text-main)] font-medium truncate mr-2">
                        {activeIndex === 1 ? t('common.on') : t('common.off')}
                      </span>
                      <button
                        onClick={() => setActiveOption(id, activeIndex === 1 ? 0 : 1)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 ${
                          activeIndex === 1 ? 'bg-amber-600' : 'bg-[var(--bg-button)]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                            activeIndex === 1 ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ) : (
                    group.choices?.map((choice, index) => {
                      const isActive = activeIndex === index;
                      return (
                        <div key={index} className="flex items-center gap-1 group">
                          <button
                            onClick={() => setActiveOption(id, index)}
                            className={`flex-1 flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${
                              isActive 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : 'hover:bg-[var(--bg-hover)] text-[var(--text-main)] border border-transparent'
                            }`}
                          >
                            <span className="truncate">{choice}</span>
                            {isActive && <Check size={12} className="shrink-0" />}
                          </button>
                          <button 
                            onClick={() => handleRenameChoice(id, index, choice)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] rounded text-[var(--text-dim)] hover:text-amber-500 transition-opacity"
                            title={t('options.renameChoice')}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => removeLayoutOptionChoice(id, index)}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover)] rounded text-[var(--text-dim)] hover:text-red-500 transition-opacity"
                            title={t('options.removeChoice')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                  
                  {!isToggle && (
                    <button 
                      onClick={() => handleAddChoice(id)}
                      className="w-full mt-1 flex items-center justify-center gap-1 py-1 px-2 rounded border border-dashed border-[var(--border-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--border-main)] transition-colors text-[10px]"
                    >
                      <Plus size={12} />
                      {t('options.addChoice')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
