import React from 'react';
import { Cpu, RefreshCcw, Usb, SlidersHorizontal, X, Sliders, Wrench, WandSparkles } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { KeyboardCanvas } from './KeyboardCanvas';
import { ZoomControls } from './ZoomControls';
import { cn } from '@/lib/utils';
import { KeycodePanel } from './KeycodePanel';
import { LayoutOptionsPanel } from './LayoutOptionsPanel';
import { KeycodeConfigPanel } from './KeycodeConfigPanel';
import { MacrosCombosPanel } from './MacrosCombosPanel';

import { hidTransport } from '@/lib/transport/hid';

export const RemapView: React.FC = () => {
  const { t } = useTranslation();
  const { connectedDevice, syncKeymap, currentLayer, setCurrentLayer, settings } = useKeyboardStore();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = React.useState(false);
  const [isKeycodeConfigOpen, setIsKeycodeConfigOpen] = React.useState(false);
  const [isMacrosCombosOpen, setIsMacrosCombosOpen] = React.useState(false);

  const handleRefresh = async () => {
    if (!connectedDevice) return;
    setIsRefreshing(true);
    try {
      await syncKeymap();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden bg-[var(--bg-app)]">
      {/* Workspace Area */}
      <div className="flex-1 relative overflow-hidden flex flex-row">
        {connectedDevice ? (
          <>
            <div className="flex-1 relative flex flex-col overflow-hidden">
              {/* Full-screen absolute canvas flowing underneath the UI panels */}
              <div className="absolute inset-0 z-0">
                <KeyboardCanvas readonlyGeometry={true} />
              </div>
              
              {/* Position ZoomControls relative to the top of the KeycodePanel */}
              <div className="absolute inset-x-0 bottom-[425px] h-0 z-[160]">
                <ZoomControls />
              </div>
                
                {/* Right Side Floating Widgets (Swapped from Left Side) */}
                <div className="absolute top-4 right-4 z-[100] flex flex-col gap-4 items-end">
                  <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Layout Options Toggle Button */}
                    <button
                      onClick={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                        isLeftPanelOpen 
                          ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                          : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                      )}
                      title={t('sidebar.layoutOptions')}
                    >
                      <SlidersHorizontal size={18} className={cn("transition-transform duration-500", isLeftPanelOpen && "scale-110")} />
                      <div className="absolute right-full mr-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl">
                        {t('sidebar.layoutOptions')}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right Side Floating Panel (Layout Options) (Swapped from Left Side) */}
                {isLeftPanelOpen && (
                  <div className="absolute top-4 right-20 bottom-[441px] w-72 z-[130] bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
                    <div className="p-4 border-b border-[var(--border-main)] bg-amber-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal size={16} className="text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-amber-500">{t('sidebar.layoutOptions')}</span>
                      </div>
                      <button onClick={() => setIsLeftPanelOpen(false)} className="p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-500">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <LayoutOptionsPanel />
                    </div>
                  </div>
                )}

                {/* Left Side Floating Panel (Keycode Config) */}
                {isKeycodeConfigOpen && (
                  <div className="absolute top-4 left-20 bottom-[441px] w-72 z-[130] bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-8 duration-300">
                    <div className="p-4 border-b border-[var(--border-main)] bg-amber-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wrench size={16} className="text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-amber-500">{t('keycodeConfig.title') || 'Keycode Config'}</span>
                      </div>
                      <button onClick={() => setIsKeycodeConfigOpen(false)} className="p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-500">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <KeycodeConfigPanel />
                    </div>
                  </div>
                )}

                {/* Left Side Floating Panel (Macros & Combos) */}
                {isMacrosCombosOpen && (
                  <div className="absolute top-4 left-20 bottom-[441px] w-80 z-[130] bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-8 duration-300">
                    <div className="p-4 border-b border-[var(--border-main)] bg-amber-500/10 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <WandSparkles size={16} className="text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-amber-500">Macros & Combos</span>
                      </div>
                      <button onClick={() => setIsMacrosCombosOpen(false)} className="p-1 hover:bg-amber-500/20 rounded transition-colors text-amber-500">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                      <MacrosCombosPanel />
                    </div>
                  </div>
                )}

                {/* Left Side Floating Widgets (Swapped from Right Side) */}
                <div className="absolute top-4 left-4 z-[100] flex flex-col gap-4">
                  <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">
                    {Array.from({ length: settings.layers || 4 }).map((_, layer) => (
                      <button
                        key={layer}
                        onClick={() => setCurrentLayer(layer)}
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group font-bold text-[12px]",
                          currentLayer === layer 
                            ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                            : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        {layer}
                        <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                          {t('common.layer')} {layer}
                        </div>
                      </button>
                    ))}

                    <div className="w-6 h-px bg-[var(--border-main)] mx-auto my-0.5" />

                    <button 
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                        isRefreshing ? "opacity-50 cursor-wait text-amber-500" : "text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <RefreshCcw size={16} className={cn(isRefreshing && "animate-spin")} />
                      <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                        {isRefreshing ? (t('remap.refreshing') || 'Refreshing...') : (t('remap.refreshSync') || 'Refresh Sync')}
                      </div>
                    </button>

                  </div>

                  {/* Keycode Config & Macros Buttons — separate pill */}
                  <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500 animate-out fade-out duration-300">
                    <button 
                      onClick={() => {
                        setIsKeycodeConfigOpen(!isKeycodeConfigOpen);
                        if (isMacrosCombosOpen) setIsMacrosCombosOpen(false);
                      }}
                      className={cn(
                        "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                        isKeycodeConfigOpen 
                          ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                          : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                      )}
                      title={t('keycodeConfig.title') || 'Keycode Config'}
                    >
                      <Wrench size={18} className={cn("transition-transform duration-500", isKeycodeConfigOpen && "rotate-45 scale-110")} />
                      <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                        {t('keycodeConfig.title') || 'Keycode Config'}
                      </div>
                    </button>

                    {settings.features?.vial && (
                      <button 
                        onClick={() => {
                          setIsMacrosCombosOpen(!isMacrosCombosOpen);
                          if (isKeycodeConfigOpen) setIsKeycodeConfigOpen(false);
                        }}
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                          isMacrosCombosOpen 
                            ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                            : "text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg-hover)]"
                        )}
                        title="Macros & Combos"
                      >
                        <WandSparkles size={18} className={cn("transition-transform duration-500", isMacrosCombosOpen && "scale-110")} />
                        <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                          Macros & Combos
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-[425px] bg-[var(--bg-panel)] border-t border-[var(--border-main)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[150] flex flex-col overflow-hidden">
                <KeycodePanel />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 relative flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <Usb size={40} className="text-amber-500/40" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-highlight)] mb-3">{t('remap.connectKeyboard') || 'Connect your keyboard'}</h2>
            <p className="text-sm text-[var(--text-muted)] max-w-sm mb-10 leading-relaxed">
              {t('remap.connectKeyboardDesc') || 'Plug in your VIA/Vial or ZMK Studio compatible keyboard and click the connect button above to start remapping.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
