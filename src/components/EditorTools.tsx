'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { parseKLE } from '@/lib/kle';
import { PRESET_LAYOUTS } from '@/lib/presets';
import { 
  Plus, Undo2, Redo2, Layout, ChevronDown, Download, Trash2, Grid2X2
} from 'lucide-react';
import { PhysicalKey } from '@/types/keyboard';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { MatrixPainter } from './MatrixPainter';

export const EditorTools = ({ floating = false }: { floating?: boolean }) => {
  const { 
    settings, keys, editorMode,
    addKeys, loadProject, resetProject,
    selectedKeyIds, removeKey, generateMatrix
  } = useKeyboardStore();
  
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = React.useState(false);

  const SPECIAL_KEYS = {
    'ISO Enter': [{ w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25, y2: 0 }],
    'Stepped Caps': [{ w: 1.25, h: 1, x2: 0, y2: 0, w2: 1.75, h2: 1, stepped: true }],
    'Big Ass Enter': [{ w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }]
  };

  const handleAddMultiple = (count: number) => {
    addKeys(Array(count).fill({ label: '' }));
    setIsAddMenuOpen(false);
  };

  const handleAddSpecial = (name: keyof typeof SPECIAL_KEYS) => {
    addKeys(SPECIAL_KEYS[name]);
    setIsAddMenuOpen(false);
  };

  const handleImportKLE = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      try {
        const json = JSON.parse(text);
        if (keys.length > 0 && !confirm(t('tools.confirmReplace'))) return;
        useKeyboardStore.getState().importKeyboardDefinition(json);
      } catch (err: any) {
        const isDebug = useKeyboardStore.getState().editorSettings.debugMode;
        alert(isDebug ? `Parse Error: ${err.message}` : t('tools.parseError'));
      }
    };
    input.click();
  };

  const handlePresetSelect = (presetName: string) => {
    if (!presetName) return;
    if (presetName === "Blank Layout") {
      if (keys.length > 0 && !confirm(t('common.deleteConfirm'))) return;
      resetProject(true);
      return;
    }
    if (keys.length > 0 && !confirm(t('tools.confirmReplace'))) return;

    const kleData = PRESET_LAYOUTS[presetName as keyof typeof PRESET_LAYOUTS];
    if (kleData) {
      const parsed = parseKLE(kleData);
      const newKeys: PhysicalKey[] = parsed.map(pk => ({
        id: crypto.randomUUID(),
        x: pk.x ?? 0,
        y: pk.y ?? 0,
        w: pk.w ?? 1,
        h: pk.h ?? 1,
        r: pk.r ?? 0,
        rx: pk.rx ?? (pk.x ?? 0),
        ry: pk.ry ?? (pk.y ?? 0),
        w2: pk.w2,
        h2: pk.h2,
        x2: pk.x2,
        y2: pk.y2,
        label: pk.label || '',
        keymap: {}
      }));
      loadProject({ 
        id: crypto.randomUUID(),
        updatedAt: Date.now(),
        ...settings,
        name: presetName,
        layoutOptions: {},
        activeOptions: {},
        keys: newKeys
      });
    }
  };

  const { t } = useTranslation();

  const FloatingButton = ({ icon: Icon, label, onClick, className = "", children }: any) => (
    <button
      onClick={onClick}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]",
        className
      )}
    >
      <Icon size={18} />
      <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
        {label}
      </div>
      {children}
    </button>
  );

  if (floating) {
    return (
      <div className="flex flex-col gap-2">
        {editorMode === 'layout' && (
          <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Load Preset */}
            <div className="relative">
              <FloatingButton 
                icon={Layout} 
                label={t('tools.loadPreset')} 
                onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)} 
                className={isPresetMenuOpen ? "bg-amber-500/10 text-amber-500" : ""}
              />
              {isPresetMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setIsPresetMenuOpen(false)} />
                  <div className="absolute top-0 left-full ml-4 w-48 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-xl shadow-2xl z-[110] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-0.5">
                      {Object.keys(PRESET_LAYOUTS).map(name => (
                        <button
                          key={name}
                          onClick={() => { handlePresetSelect(name); setIsPresetMenuOpen(false); }}
                          className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-amber-500"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Import KLE */}
            <FloatingButton icon={Download} label={t('tools.importKle')} onClick={handleImportKLE} />

            <div className="w-6 h-px bg-[var(--border-main)] mx-auto my-0.5" />

            {/* Add 1 Key */}
            <FloatingButton 
              icon={Plus} 
              label={t('tools.addKey')} 
              onClick={() => handleAddMultiple(1)} 
              className="bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 active:scale-90"
            />

            {/* Add Multiple */}
            <div className="relative">
              <FloatingButton 
                icon={ChevronDown} 
                label={t('tools.addMultiple')} 
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} 
                className={isAddMenuOpen ? "bg-amber-500/10 text-amber-500" : ""}
              />
              {isAddMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAddMenuOpen(false)} />
                  <div className="absolute top-0 left-full ml-4 w-56 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-3 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{t('tools.addMultiple')}</span>
                    </div>
                    <div className="p-2 flex flex-col gap-2">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 5, 10, 25].map(n => (
                          <button key={n} onClick={() => handleAddMultiple(n)} className="py-2 px-2 rounded-lg bg-[var(--bg-button)] border border-[var(--border-main)] hover:bg-amber-500 hover:text-zinc-950 hover:border-amber-500 text-[10px] font-bold transition-all active:scale-95 shadow-sm">
                            +{n}
                          </button>
                        ))}
                      </div>
                      <div className="h-px bg-[var(--border-main)] opacity-50 my-1" />
                      <div className="px-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{t('tools.specialShapes')}</div>
                      <div className="flex flex-col gap-1">
                        {Object.keys(SPECIAL_KEYS).map(name => (
                          <button key={name} onClick={() => handleAddSpecial(name as any)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] text-[10px] font-bold uppercase text-[var(--text-main)] hover:text-[var(--text-highlight)] transition-all flex items-center justify-between group">
                            {name}
                            <Plus size={12} className="opacity-0 group-hover:opacity-100 text-amber-500 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Generate Matrix */}
            <FloatingButton icon={Grid2X2} label={t('tools.generateMatrix')} onClick={() => { const r = prompt('Rows:', '4'); const c = prompt('Columns:', '12'); if (r && c) generateMatrix(parseInt(r), parseInt(c)); }} />
            
            {/* Delete Selected */}
            {selectedKeyIds.length > 0 && (
              <>
                <div className="w-6 h-px bg-[var(--border-main)] mx-auto my-1" />
                <button 
                  onClick={() => { selectedKeyIds.forEach(id => removeKey(id)); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group text-red-500 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={18} />
                  <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-red-900/90 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-red-500/20 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                    {t('tools.deleteSelection')} ({selectedKeyIds.length})
                  </div>
                </button>
              </>
            )}
          </div>
        )}
        
        {editorMode === 'matrix' && (
          <div className="w-72 bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-2xl p-4 animate-in fade-in slide-in-from-left-4 duration-500">
            <MatrixPainter />
          </div>
        )}
      </div>
    );
  }

  // Fallback for non-floating (just in case it's used elsewhere, though we might not need it)
  return null;
};
