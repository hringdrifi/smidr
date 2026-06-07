import React from 'react';
import { Usb, SlidersHorizontal, Wrench, ScrollText, WandSparkles, Workflow } from 'lucide-react';
import { useKeyboardStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { KeyboardCanvas } from './KeyboardCanvas';
import { ZoomControls } from './ZoomControls';
import { cn } from '@/lib/utils';
import { KeycodePanel } from './KeycodePanel';
import { LayoutOptionsPanel } from './LayoutOptionsPanel';
import { KeycodeConfigPanel } from './KeycodeConfigPanel';
import { AdvancedPanelKind } from './advanced-panel-types';
import { MacroPanel } from './MacroPanel';
import { ComboPanel } from './ComboPanel';
import { TapDancePanel } from './TapDancePanel';
export const RemapView: React.FC = () => {
  const { t } = useTranslation();
  const { connectedDevice, keys, deviceCapabilities, zmkLocked, macroSettingsOpenRequest, tapDanceSettingsOpenRequest, editorSettings } = useKeyboardStore();
  type RemapRightPanelKind = 'options' | 'keymap' | AdvancedPanelKind;
  const [activeRightPanel, setActiveRightPanel] = React.useState<RemapRightPanelKind>('keymap');
  const lastMacroSettingsOpenRequest = React.useRef(macroSettingsOpenRequest);
  const lastTapDanceSettingsOpenRequest = React.useRef(tapDanceSettingsOpenRequest);
  const isMacroPanelAvailable = connectedDevice?.protocolType === 'vial' || !!deviceCapabilities?.hasMacros;
  const isVialDynamicPanelAvailable = connectedDevice?.protocolType === 'vial';
  const macroPanelMeta = {
    macros: { title: t('macros.macros'), icon: ScrollText },
    combos: { title: t('macros.combos'), icon: Workflow },
    tapDance: { title: t('keycodeConfig.tapDance') || 'Tap Dance', icon: WandSparkles },
  } satisfies Record<AdvancedPanelKind, { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }>;
  const rightPanelTabs: Array<{ id: RemapRightPanelKind; title: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [
    { id: 'keymap', title: t('keycodeConfig.title') || 'Keymap Config', icon: Wrench },
    ...(isMacroPanelAvailable ? [{ id: 'macros' as RemapRightPanelKind, title: macroPanelMeta.macros.title, icon: macroPanelMeta.macros.icon }] : []),
    ...(isVialDynamicPanelAvailable
      ? [
          { id: 'combos' as RemapRightPanelKind, title: macroPanelMeta.combos.title, icon: macroPanelMeta.combos.icon },
          { id: 'tapDance' as RemapRightPanelKind, title: macroPanelMeta.tapDance.title, icon: macroPanelMeta.tapDance.icon },
        ]
      : []),
    { id: 'options', title: t('sidebar.layoutOptions'), icon: SlidersHorizontal },
  ];
  const activeRightPanelTab = rightPanelTabs.find(tab => tab.id === activeRightPanel);

  React.useEffect(() => {
    if (macroSettingsOpenRequest === lastMacroSettingsOpenRequest.current) return;
    lastMacroSettingsOpenRequest.current = macroSettingsOpenRequest;
    setActiveRightPanel('macros');
  }, [macroSettingsOpenRequest]);

  React.useEffect(() => {
    if (tapDanceSettingsOpenRequest === lastTapDanceSettingsOpenRequest.current) return;
    lastTapDanceSettingsOpenRequest.current = tapDanceSettingsOpenRequest;
    setActiveRightPanel('tapDance');
  }, [tapDanceSettingsOpenRequest]);

  React.useEffect(() => {
    if ((activeRightPanel === 'tapDance' || activeRightPanel === 'combos') && connectedDevice?.protocolType !== 'vial') {
      setActiveRightPanel('keymap');
    }
    if (activeRightPanel === 'macros' && !isMacroPanelAvailable) {
      setActiveRightPanel('keymap');
    }
  }, [activeRightPanel, connectedDevice?.protocolType, isMacroPanelAvailable]);

  const shouldShowZoomControls = !(keys.length === 0 && !zmkLocked);
  const rightPanelWidth = connectedDevice ? 380 : 0;
  const canvasRight = `${rightPanelWidth}px`;

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden bg-[var(--bg-app)]">
      {/* Workspace Area */}
      <div className="flex-1 relative overflow-hidden flex flex-row">
        {connectedDevice ? (
          <>
            <div className="flex-1 relative flex flex-col overflow-hidden">
              {/* Canvas area stops above the keycode panel so centering and empty states use the visible workspace. */}
              <div className="absolute inset-x-0 top-0 bottom-[400px] z-0" style={{ right: canvasRight }}>
                <KeyboardCanvas readonlyGeometry={true} />
              </div>
              
              {/* Position ZoomControls relative to the top of the KeycodePanel */}
              {shouldShowZoomControls && (
                <div className="absolute inset-x-0 bottom-[400px] h-0 z-[160]" style={{ right: canvasRight }}>
                  <ZoomControls />
                </div>
              )}
              <aside className="absolute top-0 right-0 bottom-0 z-[90] w-[380px] bg-[var(--bg-panel)] border-l border-[var(--border-main)] overflow-visible flex animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="shrink-0 w-12 border-r border-[var(--border-main)] bg-[var(--bg-app)]/50">
                  <div className="flex flex-col items-center gap-1 px-1.5 py-2">
                    {rightPanelTabs.map(({ id, title, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveRightPanel(id)}
                        className={cn(
                          "group relative flex h-9 w-9 items-center justify-center rounded transition-all shrink-0",
                          activeRightPanel === id
                            ? "bg-amber-500 text-zinc-950 shadow-sm"
                            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                        )}
                        aria-label={title}
                      >
                        <Icon size={16} />
                        <span className={cn(
                          "pointer-events-none absolute right-full top-1/2 z-[220] mr-3 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] opacity-0 shadow-2xl transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100",
                          editorSettings.theme === 'dark'
                            ? "border border-white/10 bg-zinc-900/95 text-white"
                            : "border border-white/10 bg-zinc-950/95 text-white"
                        )}>
                          {title}
                          <span className={cn(
                            "absolute left-full top-1/2 h-2 w-2 -translate-x-1 -translate-y-1/2 rotate-45 border-r border-t",
                            editorSettings.theme === 'dark'
                              ? "border-white/10 bg-zinc-900/95"
                              : "border-white/10 bg-zinc-950/95"
                          )} />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                  {activeRightPanelTab && (
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 px-4">
                      <activeRightPanelTab.icon size={15} className="text-amber-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {activeRightPanelTab.title}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {activeRightPanel === 'options' && <LayoutOptionsPanel />}
                    {activeRightPanel === 'keymap' && <KeycodeConfigPanel />}
                    {activeRightPanel === 'macros' && <MacroPanel scope="device" />}
                    {activeRightPanel === 'combos' && <ComboPanel scope="device" />}
                    {activeRightPanel === 'tapDance' && <TapDancePanel scope="device" />}
                  </div>
                </div>
              </aside>

              <div className="absolute bottom-0 left-0 h-[400px] bg-[var(--bg-panel)] border-t border-[var(--border-main)] z-[150] flex flex-col overflow-hidden" style={{ right: canvasRight }}>
                <KeycodePanel />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 relative flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
              <Usb size={40} className="text-amber-500" />
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
