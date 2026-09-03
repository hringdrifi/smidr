import React from 'react';
import { Usb, SlidersHorizontal, Wrench, ScrollText, WandSparkles, Workflow, PanelRight, X, Menu } from 'lucide-react';
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
  const { connectedDevice, keys, deviceCapabilities, zmkLocked, macroSettingsOpenRequest, tapDanceSettingsOpenRequest } = useKeyboardStore();
  type RemapRightPanelKind = 'options' | 'keymap' | AdvancedPanelKind;
  const [activeRightPanel, setActiveRightPanel] = React.useState<RemapRightPanelKind>('keymap');
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);
  const [isNavOpen, setIsNavOpen] = React.useState(false);
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
  const rightPanelWidth = connectedDevice ? 360 : 0;
  const canvasRight = `${rightPanelWidth}px`;

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden bg-[var(--bg-app)]">
      {/* Workspace Area */}
      <div className="flex-1 relative overflow-hidden flex flex-row">
        {connectedDevice ? (
          <>
            <div className="flex-1 relative flex flex-col overflow-hidden">
              {isNavOpen && <button type="button" aria-label="Close navigation" className="absolute inset-0 z-[175] bg-black/40 lg:hidden" onClick={() => setIsNavOpen(false)} />}
              <button type="button" onClick={() => setIsNavOpen(true)} className="absolute left-3 top-3 z-[170] flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--text-main)] shadow-lg lg:hidden" aria-label={t('workspace.navigation')}><Menu size={19} /></button>
              <aside className={cn("absolute inset-y-0 left-0 z-[180] flex w-[216px] flex-col border-r border-[var(--border-main)] bg-[var(--bg-panel)] transition-transform lg:translate-x-0", isNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full")}>
                <div className="border-b border-[var(--border-main)] px-4 py-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">{t('modes.remap')}</span>
                  <p className="mt-1 text-sm font-semibold text-[var(--text-highlight)]">{connectedDevice.productName || t('remap.defaultKeyboard')}</p>
                </div>
                <nav className="space-y-1 p-3" aria-label={t('workspace.navigation')}>
                  {rightPanelTabs.map(({ id, title, icon: Icon }, index) => (
                    <button key={id} type="button" onClick={() => { setActiveRightPanel(id); setIsInspectorOpen(true); setIsNavOpen(false); }} aria-current={activeRightPanel === id ? 'page' : undefined} className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                      activeRightPanel === id ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                    )}>
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-xs", activeRightPanel === id ? "bg-black/10" : "bg-[var(--bg-app)]")}>{index + 1}</span>
                      <Icon size={17} />
                      <span className="truncate">{title}</span>
                    </button>
                  ))}
                </nav>
              </aside>
              <button type="button" onClick={() => setIsInspectorOpen(true)} className="absolute right-3 top-3 z-[170] flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--text-main)] shadow-lg xl:hidden" aria-label={t('workspace.inspector')}><PanelRight size={19} /></button>
              {/* Canvas area stops above the keycode panel so centering and empty states use the visible workspace. */}
              <div className="workspace-canvas absolute inset-x-0 top-0 bottom-[400px] z-0" style={{ right: canvasRight }}>
                <KeyboardCanvas readonlyGeometry={true} />
              </div>
              
              {/* Position ZoomControls relative to the top of the KeycodePanel */}
              {shouldShowZoomControls && (
                <div className="absolute inset-x-0 bottom-[400px] h-0 z-[160]" style={{ right: canvasRight }}>
                  <ZoomControls />
                </div>
              )}
              <aside className={cn("workspace-inspector absolute top-0 right-0 bottom-0 z-[190] w-[360px] max-w-[88vw] bg-[var(--bg-panel)] border-l border-[var(--border-main)] overflow-visible flex transition-transform duration-200 xl:translate-x-0", isInspectorOpen ? "translate-x-0 shadow-2xl" : "max-xl:translate-x-full")}>
                <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
                  {activeRightPanelTab && (
                    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 px-4">
                      <activeRightPanelTab.icon size={15} className="text-amber-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                        {activeRightPanelTab.title}
                      </span>
                      <button type="button" onClick={() => setIsInspectorOpen(false)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] xl:hidden" aria-label="Close inspector"><X size={17} /></button>
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

              <div className="workspace-bottom-tray absolute bottom-0 left-0 h-[400px] bg-[var(--bg-panel)] border-t border-[var(--border-main)] z-[150] flex flex-col overflow-hidden" style={{ right: canvasRight }}>
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
