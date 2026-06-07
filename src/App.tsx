import React from 'react';
import { LayoutGrid, Settings, CircuitBoard, Save, Download, Keyboard, X, FolderOpen, FileUp, FileDown, Trash2, Undo2, Redo2, Move, Wrench, SlidersHorizontal, Layers, SquarePen, Sun, Moon, Languages, Cpu, ChevronDown, Plus, MousePointer2, Sparkles, Loader2, Check, ScrollText, WandSparkles, Workflow, Hash } from 'lucide-react';
import { useStore } from 'zustand';
import { useTranslation } from '@/hooks/useTranslation';
import { LANGUAGE_NAMES } from '@/lib/i18n';
import { KeyboardCanvas } from '@/components/KeyboardCanvas';
import { ZoomControls } from '@/components/ZoomControls';
import { EditorTools } from '@/components/EditorTools';
import { PropertyPanel } from '@/components/PropertyPanel';
import { LayoutOptionsPanel } from '@/components/LayoutOptionsPanel';
import { KeycodePanel } from '@/components/KeycodePanel';
import { RemapView } from '@/components/RemapView';
import { DeviceConnector } from '@/components/DeviceConnector';
import { HardwareSettingsPanel } from '@/components/HardwareSettingsPanel';
import { KeycodeConfigPanel } from '@/components/KeycodeConfigPanel';
import { MatrixPainter } from '@/components/MatrixPainter';
import { MatrixPinInspectorPanel } from '@/components/MatrixPinSettingsPanel';
import { AdvancedPanelKind } from '@/components/advanced-panel-types';
import { MacroPanel } from '@/components/MacroPanel';
import { ComboPanel } from '@/components/ComboPanel';
import { TapDancePanel } from '@/components/TapDancePanel';
import { UnlockModal } from '@/components/UnlockModal';
import { ZmkUnlockModal } from '@/components/ZmkUnlockModal';
import { useKeyboardStore } from '@/lib/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSmidrProjectJson, downloadJson, downloadBlob, generateViaJson, generateKleJson } from '@/lib/export';
import { generateQmkZip } from '@/lib/qmk';
import { generateVialZip } from '@/lib/vial';
import { generateZmkZip } from '@/lib/zmk';
import { FirmwareExportTarget, formatExportValidationIssues, validateFirmwareExport } from '@/lib/export-validation';
import { isQmkSourceExportSupported, isZmkSourceExportSupported } from '@/lib/mcu-presets';
import { qmkStringToAction } from '@/lib/protocols/via-action-converter';
import { UniversalAction } from '@/types/actions';
import { SmidrProject, PhysicalKey } from '@/types/keyboard';
import { saveProject, listProjects, deleteProject } from '@/lib/storage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RightPanelKind = 'settings' | 'properties' | 'matrixPainter' | 'options' | 'keymap' | 'pins' | AdvancedPanelKind;

export default function App() {
  const storeState = useKeyboardStore();
  const { 
    editorMode, setEditorMode, settings, updateSettings, keys,
    currentProjectId, loadProject,
    editorSettings, updateEditorSettings, connectedDevice,
    appMode, currentLayer
  } = storeState;

  // Use zundo temporal store for reactive undo/redo states
  const { undo, redo, pastStates, futureStates } = useStore((useKeyboardStore as any).temporal, (state: any) => state);
  const { t, language, setLanguage } = useTranslation();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = React.useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = React.useState(false);
  const [isEditorModeMenuOpen, setIsEditorModeMenuOpen] = React.useState(false);
  const [savedProjects, setSavedProjects] = React.useState<any[]>([]);
  const [activeRightPanel, setActiveRightPanel] = React.useState<RightPanelKind>('settings');

  const [lastSavedHistoryLength, setLastSavedHistoryLength] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = React.useState(false);
  const isDirty = pastStates.length !== lastSavedHistoryLength;
  const [isRestoring, setIsRestoring] = React.useState(false);
  const remapFileInputRef = React.useRef<HTMLInputElement>(null);
  const keyboardFileInputRef = React.useRef<HTMLInputElement>(null);
  const lastMacroSettingsOpenRequest = React.useRef(storeState.macroSettingsOpenRequest);
  const lastTapDanceSettingsOpenRequest = React.useRef(storeState.tapDanceSettingsOpenRequest);
  const macroPanelMeta = {
    macros: { title: t('macros.macros'), icon: ScrollText },
    combos: { title: t('macros.combos'), icon: Workflow },
    tapDance: { title: t('keycodeConfig.tapDance') || 'Tap Dance', icon: WandSparkles },
  } satisfies Record<AdvancedPanelKind, { title: string; icon: React.ComponentType<{ size?: number; className?: string }> }>;

  React.useEffect(() => {
    if (storeState.appMode !== 'design') return;
    if (storeState.macroSettingsOpenRequest === lastMacroSettingsOpenRequest.current) return;
    lastMacroSettingsOpenRequest.current = storeState.macroSettingsOpenRequest;
    setActiveRightPanel('macros');
  }, [storeState.appMode, storeState.macroSettingsOpenRequest]);

  React.useEffect(() => {
    if (storeState.appMode !== 'design') return;
    if (storeState.tapDanceSettingsOpenRequest === lastTapDanceSettingsOpenRequest.current) return;
    lastTapDanceSettingsOpenRequest.current = storeState.tapDanceSettingsOpenRequest;
    setActiveRightPanel('tapDance');
  }, [storeState.appMode, storeState.tapDanceSettingsOpenRequest]);

  const connectedDeviceLabel = React.useMemo(() => {
    if (!connectedDevice) return '';

    const protocolLabel =
      connectedDevice.protocolType === 'vial'
        ? t('remap.vialConnected')
        : connectedDevice.protocolType === 'via'
          ? t('remap.viaConnected')
          : t('remap.zmkConnected');

    const deviceName =
      connectedDevice.protocolType === 'zmk'
        ? settings.name || connectedDevice.productName || t('remap.defaultKeyboard')
        : connectedDevice.productName || settings.name || t('remap.defaultKeyboard');

    return `${protocolLabel}: ${deviceName}`;
  }, [connectedDevice, settings.name, t]);

  const refreshProjectList = () => {
    if (storeState.isDemoMode) {
      setSavedProjects([]);
      return;
    }
    setSavedProjects(listProjects());
  };

  const handleNewProject = () => {
    if (keys.length > 0 && !confirm(t('common.discardConfirm'))) return;
    storeState.resetProject(true);
    storeState.setIsHardwareModalOpen(true);
    setLastSavedHistoryLength(0);
  };

  React.useEffect(() => {
    if (storeState.isDemoMode && !storeState.isProjectOpen) {
      storeState.initializeDemoMode();
      return;
    }
    refreshProjectList();
  }, [storeState.isDemoMode, storeState.isProjectOpen]);

  // Update lastSavedHistoryLength when project changes
  React.useEffect(() => {
    setLastSavedHistoryLength(pastStates.length);
  }, [currentProjectId]);

  const handleSaveProject = async () => {
    setIsSaving(true);
    
    // Slight delay to show the spinner and feel "pro"
    await new Promise(r => setTimeout(r, 600));

    const id = currentProjectId || crypto.randomUUID();
    const project: SmidrProject = {
      id,
      updatedAt: Date.now(),
      ...settings,
      keys
    };
    if (!storeState.isDemoMode) {
      saveProject(project);
      loadProject(project, true);
      refreshProjectList();
    }
    setLastSavedHistoryLength(pastStates.length);
    
    setIsSaving(false);
    setShowSavedFeedback(true);
    setTimeout(() => setShowSavedFeedback(false), 2000);
  };

  const handleLoadProject = (project: SmidrProject) => {
    if (keys.length > 0 && !confirm(t('common.discardConfirm'))) return;
    loadProject(project);
    setIsProjectMenuOpen(false);
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t('common.deleteConfirm'))) return;
    deleteProject(id);
    refreshProjectList();
  };

  const handleExportJson = () => {
    const projectJson = generateSmidrProjectJson({ settings, keys });
    downloadJson(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'project'}.smidr`, projectJson);
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportKleJson = () => {
    const kleJson = generateKleJson(
      { settings, keys },
      { editorMode, currentLayer, appMode, remoteKeymap: storeState.remoteKeymap }
    );
    downloadJson(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_kle.json`, kleJson);
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const confirmFirmwareExportValidation = (target: FirmwareExportTarget) => {
    const issues = validateFirmwareExport(settings, keys, target);
    if (issues.length === 0) return true;

    const message = formatExportValidationIssues(target, issues);
    if (issues.some(issue => issue.severity === 'error')) {
      alert(message);
      return false;
    }

    return confirm(`${message}\n\n${t('common.continueExport')}`);
  };

  const handleExportViaZip = async () => {
    if (!isQmkSourceExportSupported(settings.hardware)) return;
    if (!confirmFirmwareExportValidation('qmk')) return;
    const zipBlob = await generateQmkZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_qmk.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportVialZip = async () => {
    if (!isQmkSourceExportSupported(settings.hardware)) return;
    if (!confirmFirmwareExportValidation('vial')) return;
    const zipBlob = await generateVialZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_vial.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportZmkZip = async () => {
    if (!isZmkSourceExportSupported(settings.hardware)) return;
    if (!confirmFirmwareExportValidation('zmk')) return;
    const zipBlob = await generateZmkZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_zmk.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const qmkSourceUnsupported = !isQmkSourceExportSupported(settings.hardware);
  const zmkSourceUnsupported = !isZmkSourceExportSupported(settings.hardware);
  const designBottomTrayHeight = storeState.isProjectOpen
    ? editorMode === 'keymap' ? 400 : 0
    : 0;
  const designCanvasBottom = `${designBottomTrayHeight}px`;
  const designRightInspectorWidth = storeState.isProjectOpen ? 380 : 0;
  const designCanvasRight = `${designRightInspectorWidth}px`;
  const designCanvasInsetShadow = [
    designRightInspectorWidth > 0 ? 'inset -18px 0 28px -24px rgba(0,0,0,0.95)' : '',
    designBottomTrayHeight > 0 ? 'inset 0 -18px 32px -26px rgba(0,0,0,0.95)' : '',
  ].filter(Boolean).join(', ');
  const designModes = [
    { id: 'layout', icon: Move },
    { id: 'matrix', icon: CircuitBoard },
    { id: 'keymap', icon: Keyboard },
  ] as const;
  const rightPanelTabs: Array<
    | { type: 'tab'; id: RightPanelKind; title: string; icon: React.ComponentType<{ size?: number; className?: string }> }
    | { type: 'separator'; id: string }
  > = [
    { type: 'tab', id: 'settings', title: t('hardware.title') || t('header.setupTooltip'), icon: Settings },
    { type: 'tab', id: 'options', title: t('sidebar.layoutOptions'), icon: SlidersHorizontal },
    { type: 'separator', id: 'editor-specific' },
    ...(editorMode === 'layout'
      ? [{ type: 'tab' as const, id: 'properties' as RightPanelKind, title: t('properties.title'), icon: SquarePen }]
      : []),
    ...(editorMode === 'matrix'
      ? [{ type: 'tab' as const, id: 'matrixPainter' as RightPanelKind, title: t('modes.matrix'), icon: MousePointer2 }]
      : []),
    ...(editorMode === 'matrix'
      ? [{ type: 'tab' as const, id: 'pins' as RightPanelKind, title: t('hardware.pins'), icon: Hash }]
      : []),
    ...(editorMode === 'keymap'
      ? [{ type: 'tab' as const, id: 'keymap' as RightPanelKind, title: t('keycodeConfig.title') || 'Keymap Config', icon: Wrench }]
      : []),
    ...(editorMode === 'keymap'
      ? [
          { type: 'tab' as const, id: 'macros' as RightPanelKind, title: macroPanelMeta.macros.title, icon: macroPanelMeta.macros.icon },
          { type: 'tab' as const, id: 'combos' as RightPanelKind, title: macroPanelMeta.combos.title, icon: macroPanelMeta.combos.icon },
          { type: 'tab' as const, id: 'tapDance' as RightPanelKind, title: macroPanelMeta.tapDance.title, icon: macroPanelMeta.tapDance.icon },
        ]
      : []),
  ];
  const activeRightPanelTab = rightPanelTabs.find(
    (item): item is Extract<(typeof rightPanelTabs)[number], { type: 'tab' }> => item.type === 'tab' && item.id === activeRightPanel
  );
  const defaultRightPanelForEditor = (mode: typeof editorMode): RightPanelKind => {
    if (mode === 'layout') return 'properties';
    if (mode === 'matrix') return 'matrixPainter';
    return 'keymap';
  };

  React.useEffect(() => {
    const isUnavailablePanel =
      (activeRightPanel === 'keymap' && editorMode !== 'keymap') ||
      ((activeRightPanel === 'macros' || activeRightPanel === 'combos' || activeRightPanel === 'tapDance') && editorMode !== 'keymap') ||
      (activeRightPanel === 'pins' && editorMode !== 'matrix') ||
      (activeRightPanel === 'matrixPainter' && editorMode !== 'matrix') ||
      (activeRightPanel === 'properties' && editorMode !== 'layout');

    if (isUnavailablePanel) {
      setActiveRightPanel(defaultRightPanelForEditor(editorMode));
    }
  }, [activeRightPanel, editorMode]);

  React.useEffect(() => {
    setActiveRightPanel(defaultRightPanelForEditor(editorMode));
  }, [editorMode]);

  const handleImportKeyboard = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (keys.length > 0 && !confirm(t('tools.confirmReplace'))) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      storeState.importKeyboardDefinition(json);
    } catch (err) {
      console.error('Import keyboard failed:', err);
      alert(t('common.parseFailed'));
    }
    e.target.value = '';
  };

  const handleImportProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as SmidrProject;
      if (!json.keys || !json.name) {
        alert(t('common.invalidFile'));
      } else {
        loadProject(json);
      }
      setIsProjectMenuOpen(false);
    } catch (err) {
      console.error('Import failed:', err);
      alert(t('common.parseFailed'));
    }
    e.target.value = '';
  };

  const handleExportBackup = () => {
    if (!connectedDevice) return;
    
    // Merge latest keycodes from real device to each key
    const keysWithCurrentKeymap = keys.map(k => {
      const keymap: Record<number, UniversalAction> = { ...k.keymap };
      const remoteIndex = k.zmkPosition ?? (
        k.row !== undefined && k.col !== undefined ? k.row * 32 + k.col : undefined
      );
      if (remoteIndex !== undefined) {
        Object.keys(remoteKeymap || {}).forEach(lStr => {
          const l = Number(lStr);
          const action = remoteKeymap[l]?.[remoteIndex];
          if (action) {
            keymap[l] = action;
          }
        });
      }
      return { ...k, keymap };
    });

    const projectJson = generateSmidrProjectJson({ 
      settings, 
      keys: keysWithCurrentKeymap
    });

    downloadJson(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_backup.smidr`, projectJson);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connectedDevice) return;
    
    try {
      const text = await file.text();
      const json = JSON.parse(text) as SmidrProject;
      const importKeys = json.keys;
      if (!importKeys) {
        alert(t('common.invalidFile'));
        return;
      }

      const writeQueue: { layer: number; row: number; col: number; action: UniversalAction }[] = [];
      const layersCount = settings.layers || 4;
      
      importKeys.forEach((k: PhysicalKey) => {
        const pos = k.zmkPosition !== undefined
          ? { row: k.zmkPosition, col: -1 }
          : (k.row !== undefined && k.col !== undefined)
          ? { row: k.row, col: k.col }
          : null;
        if (pos && k.keymap) {
          for (let l = 0; l < layersCount; l++) {
            const val = k.keymap[l];
            if (val) {
              const action = val as UniversalAction;
              writeQueue.push({ layer: l, row: pos.row, col: pos.col, action });
            }
          }
        }
      });

      if (writeQueue.length === 0) {
        alert(t('remap.noValidMappings'));
        return;
      }

      setIsRestoring(true);
      
      for (let i = 0; i < writeQueue.length; i++) {
        const item = writeQueue[i];
        await storeState.updateDeviceKeycode(item.layer, item.row, item.col, item.action);
      }
      
      await storeState.syncKeymap();
      alert(t('remap.restoreSuccess'));
    } catch (err) {
      console.error("Failed to restore backup:", err);
      alert(t('remap.restoreFailed'));
    } finally {
      setIsRestoring(false);
      if (remapFileInputRef.current) remapFileInputRef.current.value = '';
    }
  };

  const remoteKeymap = storeState.remoteKeymap;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden relative">
      {isRestoring && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md z-[1000] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">{t('remap.restoring')}</h3>
          <p className="text-sm text-zinc-400">{t('remap.restoringDesc')}</p>
        </div>
      )}
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 md:h-14 md:flex-nowrap md:px-4 md:py-0 bg-[var(--bg-panel)] border-b border-[var(--border-main)] shrink-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Smiðr Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-[var(--text-highlight)]">Smiðr</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-px h-4 bg-[var(--border-main)]" />
            <span className="hidden xl:block text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-[0.3em] whitespace-nowrap translate-y-[1px]">Custom Keyboard Forge</span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="h-4 w-px bg-[var(--border-main)]" />

            <div className="flex h-8 items-center rounded-md border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5">
              <button
                onClick={() => storeState.setAppMode('remap')}
                className={cn(
                  "flex h-full items-center justify-center gap-1.5 rounded-[4px] px-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                  storeState.appMode === 'remap'
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title={t('modes.remap')}
              >
                <Keyboard size={14} />
                <span className="hidden sm:block">{t('modes.remap')}</span>
              </button>
              <button
                onClick={() => storeState.setAppMode('design')}
                className={cn(
                  "flex h-full items-center justify-center gap-1.5 rounded-[4px] px-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                  storeState.appMode === 'design'
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title={t('modes.design')}
              >
                <SquarePen size={14} />
                <span className="hidden sm:block">{t('modes.design')}</span>
              </button>
            </div>

            {storeState.appMode === 'design' && storeState.isProjectOpen && (
              <div className="flex h-8 items-center rounded-md border border-[var(--border-main)] bg-[var(--bg-app)] p-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
                {designModes.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditorMode(id)}
                    className={cn(
                      "flex h-full items-center justify-center gap-1.5 rounded-[4px] px-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                      editorMode === id
                        ? "bg-[var(--bg-panel)] text-amber-500 shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    )}
                    title={t(`modes.${id}`)}
                  >
                    <Icon size={14} />
                    <span className="hidden xl:block">{t(`modes.${id}`)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-end gap-2 md:w-auto">



          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                className="flex items-center gap-1.5 px-3 h-8 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-highlight)] transition-all border border-transparent hover:border-[var(--border-main)]"
                title={t('header.changeLanguage')}
              >
                <Languages size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{language}</span>
                <ChevronDown size={10} className={cn("transition-transform duration-300", isLangMenuOpen && "rotate-180")} />
              </button>

              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)} />
                  <div className="absolute top-full right-0 mt-1 w-36 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-1 flex flex-col gap-0.5">
                      {(['en', 'zh', 'ko', 'ja', 'es', 'de'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang);
                            setIsLangMenuOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded text-[10px] font-bold uppercase transition-all flex items-center justify-between group",
                            language === lang 
                              ? "bg-amber-500 text-zinc-950 shadow-sm" 
                              : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                          )}
                        >
                          {LANGUAGE_NAMES[lang]}
                          {language === lang && <div className="w-1 h-1 rounded-full bg-zinc-950 opacity-40" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Theme Toggle */}
            <button
              onClick={() => updateEditorSettings({ theme: editorSettings.theme === 'dark' ? 'light' : 'dark' })}
              className="flex items-center justify-center w-8 h-8 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-highlight)] transition-all border border-transparent hover:border-[var(--border-main)]"
              title={editorSettings.theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
            >
              {editorSettings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>


          </div>
        </div>
      </header>

      <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 overflow-visible border-b border-[var(--border-main)] bg-[var(--bg-app)]/80 px-3 py-1.5 md:px-4">
        {storeState.appMode === 'remap' ? (
          <div className="flex min-w-max items-center gap-2 md:gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <DeviceConnector />

            {connectedDevice && (
              <>
                <div
                  className="flex min-w-0 items-center gap-2 px-3 h-8 bg-amber-500/5 border border-amber-500/10 rounded-md shrink"
                  title={`VID: 0x${connectedDevice.vid.toString(16).toUpperCase().padStart(4, '0')} PID: 0x${connectedDevice.pid.toString(16).toUpperCase().padStart(4, '0')}`}
                >
                  <Cpu size={14} className="text-amber-500 shrink-0" />
                  <span className="truncate text-[10px] font-bold text-[var(--text-highlight)] uppercase tracking-wider">
                    {connectedDeviceLabel}
                  </span>
                </div>

                <div className="w-px h-4 bg-[var(--border-main)] shrink-0" />

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => remapFileInputRef.current?.click()}
                    className="flex items-center justify-center w-10 h-8 bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
                    title={t('remap.importBackup')}
                  >
                    <FileUp size={16} className="group-hover:scale-110 transition-transform" />
                  </button>

                  <button
                    onClick={handleExportBackup}
                    className="flex items-center justify-center w-10 h-8 bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
                    title={t('remap.exportBackup')}
                  >
                    <FileDown size={16} className="group-hover:scale-110 transition-transform" />
                  </button>

                  <input
                    type="file"
                    ref={remapFileInputRef}
                    accept=".smidr"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-w-max items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center bg-[var(--bg-panel)] rounded-lg p-0.5 border border-[var(--border-main)]">
              <button
                onClick={() => undo()}
                disabled={pastStates.length === 0}
                className="p-1.5 hover:bg-[var(--bg-hover)] rounded disabled:opacity-20 disabled:pointer-events-none text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all"
                title={t('header.undo')}
              >
                <Undo2 size={16} />
              </button>
              <div className="w-px h-4 bg-[var(--border-main)] mx-0.5" />
              <button
                onClick={() => redo()}
                disabled={futureStates.length === 0}
                className="p-1.5 hover:bg-[var(--bg-hover)] rounded disabled:opacity-20 disabled:pointer-events-none text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all"
                title={t('header.redo')}
              >
                <Redo2 size={16} />
              </button>
            </div>

            <div className="w-px h-4 bg-[var(--border-main)] shrink-0" />

            <button
              onClick={handleNewProject}
              className="flex items-center justify-center w-10 h-8 bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
              title={t('common.new')}
            >
              <Sparkles size={16} className="group-hover:scale-110 transition-transform" />
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setIsProjectMenuOpen(!isProjectMenuOpen);
                  refreshProjectList();
                }}
                className={cn(
                  "h-8 w-10 flex items-center justify-center rounded-md bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all",
                  isProjectMenuOpen && "bg-[var(--bg-hover)] border-amber-500/50 text-amber-500"
                )}
                title={t('header.projectsTooltip')}
              >
                <FolderOpen size={16} />
              </button>

              {isProjectMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)} />
                  <div className="absolute top-full left-0 w-64 mt-2 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{t('common.projects')}</span>
                      <button onClick={() => setIsProjectMenuOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar flex flex-col gap-0.5">
                      {savedProjects.length === 0 ? (
                        <div className="p-4 text-center text-[var(--text-muted)] text-[11px] italic">{t('common.noProjects')}</div>
                      ) : (
                        savedProjects.sort((a,b) => b.updatedAt - a.updatedAt).map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleLoadProject(p)}
                            className={cn(
                              "w-full text-left px-3 py-2 rounded transition-all group flex flex-col gap-0.5",
                              currentProjectId === p.id
                                ? "bg-amber-500 text-zinc-950 shadow-sm"
                                : "hover:bg-[var(--bg-hover)] text-[var(--text-main)]"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-bold truncate">{p.name || p.data?.settings?.name || 'Untitled'}</span>
                              <Trash2
                                size={12}
                                className={cn(
                                  "opacity-0 group-hover:opacity-100 transition-opacity",
                                  currentProjectId === p.id ? "text-zinc-900 hover:text-zinc-700" : "text-red-500/50 hover:text-red-500"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(e, p.id);
                                }}
                              />
                            </div>
                            <span className={cn(
                              "text-[9px] flex items-center justify-between opacity-60",
                              currentProjectId === p.id ? "text-zinc-800" : "text-[var(--text-muted)]"
                            )}>
                              <span>{new Date(p.updatedAt).toLocaleString()}</span>
                              <span className="font-mono">{(p.keys?.length ?? p.data?.keys?.length ?? 0)} keys</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-1 border-t border-[var(--border-main)] bg-[var(--bg-app)]/50">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left relative overflow-hidden"
                      >
                        <FileUp size={14} className="text-amber-500" />
                        <span>{t('header.importProject')}</span>
                        <input
                          type="file"
                          accept=".smidr"
                          onChange={handleImportProject}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => keyboardFileInputRef.current?.click()}
              disabled={!storeState.isProjectOpen}
              className="flex items-center justify-center w-10 h-8 rounded-md bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all disabled:pointer-events-none group"
              title={t('header.readTooltip')}
            >
              <FileUp size={16} className={cn(
                storeState.isProjectOpen ? "group-hover:scale-110 transition-transform" : "opacity-20"
              )} />
            </button>

            <input
              type="file"
              ref={keyboardFileInputRef}
              accept=".json"
              onChange={handleImportKeyboard}
              className="hidden"
            />

            <button
              id="header-save-btn"
              onClick={handleSaveProject}
              disabled={isSaving || !storeState.isProjectOpen}
              className={cn(
                "flex items-center justify-center w-10 h-8 rounded-md transition-all group shrink-0 relative overflow-hidden disabled:pointer-events-none",
                storeState.isProjectOpen && showSavedFeedback
                  ? "bg-green-500/10 border border-green-500/20 text-green-500"
                  : storeState.isProjectOpen && isDirty
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 hover:text-amber-400"
                    : "bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)]",
                isSaving && "cursor-wait opacity-80"
              )}
              title={t('header.saveTooltip')}
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : showSavedFeedback ? (
                <Check size={16} className="animate-in zoom-in duration-300" />
              ) : (
                <Save size={16} className={cn(
                  storeState.isProjectOpen ? "group-hover:scale-110 transition-transform" : "opacity-20"
                )} />
              )}
            </button>

            <div className="relative shrink-0">
              <button
                id="header-export-btn"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={!storeState.isProjectOpen}
                className={cn(
                  "flex items-center justify-center w-10 h-8 rounded-md transition-all group shrink-0 relative overflow-hidden disabled:pointer-events-none",
                  isExportMenuOpen
                    ? "bg-[var(--bg-hover)] border-amber-500/50 text-amber-500"
                    : "bg-[var(--bg-panel)] border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)]"
                )}
                title={`${t('common.export')}...`}
              >
                <Download size={16} className={cn(
                  storeState.isProjectOpen ? "group-hover:scale-110 transition-transform" : "opacity-20"
                )} />
              </button>

              {isExportMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                  <div className="absolute top-full left-0 w-64 mt-2 bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-md shadow-2xl z-[150] overflow-hidden animate-in fade-in slide-in-from-top-1">
                    <div className="p-2 border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">{t('common.export')}</span>
                      <button onClick={() => setIsExportMenuOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-1 flex flex-col gap-0.5">
                      <button
                        onClick={handleExportJson}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                      >
                        <FileDown size={14} className="text-amber-500" />
                        <span>{t('header.exportProject')}</span>
                      </button>

                      <button
                        onClick={handleExportKleJson}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                      >
                        <FileDown size={14} className="text-amber-500" />
                        <span>{t('header.exportKle')}</span>
                      </button>

                      <button
                        onClick={handleExportViaZip}
                        disabled={qmkSourceUnsupported}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all text-left",
                          qmkSourceUnsupported
                            ? "opacity-40 cursor-not-allowed text-[var(--text-muted)]"
                            : "hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] cursor-pointer"
                        )}
                        title={qmkSourceUnsupported ? "QMK export is not supported for the selected MCU or development board." : undefined}
                      >
                        <Download size={14} className={qmkSourceUnsupported ? "text-[var(--text-muted)]" : "text-amber-500"} />
                        <span>{t('header.exportViaZip')}</span>
                      </button>
                      <button
                        onClick={handleExportVialZip}
                        disabled={qmkSourceUnsupported}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all text-left",
                          qmkSourceUnsupported
                            ? "opacity-40 cursor-not-allowed text-[var(--text-muted)]"
                            : "hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] cursor-pointer"
                        )}
                        title={qmkSourceUnsupported ? "Vial export is not supported for the selected MCU or development board." : undefined}
                      >
                        <Download size={14} className={qmkSourceUnsupported ? "text-[var(--text-muted)]" : "text-amber-500"} />
                        <span>{t('header.exportVialZip')}</span>
                      </button>

                      {(() => {
                        return (
                          <button
                            onClick={handleExportZmkZip}
                            disabled={zmkSourceUnsupported}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all text-left",
                              zmkSourceUnsupported
                                ? "opacity-40 cursor-not-allowed text-[var(--text-muted)]"
                                : "hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] cursor-pointer"
                            )}
                            title={zmkSourceUnsupported ? "ZMK export is not supported for the selected MCU or development board." : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <Download size={14} className={zmkSourceUnsupported ? "text-[var(--text-muted)]" : "text-amber-500"} />
                              <span>{t('header.exportZmkZip')}</span>
                            </div>
                            {zmkSourceUnsupported && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold tracking-tighter">
                                Unsupported
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>

            {storeState.isProjectOpen && (
              <input
                type="text"
                value={settings.name}
                onChange={(e) => updateSettings({ name: e.target.value })}
                className="bg-[var(--bg-panel)] border border-[var(--border-main)] px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 w-48 transition-all"
                placeholder={t('header.projectName')}
              />
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main Workspace Area */}
        {storeState.appMode === 'design' ? (
          <main className="flex-1 relative overflow-hidden flex flex-col bg-[var(--bg-app)]">
            {/* Canvas area stops above the bottom tray so centering and empty states use the visible workspace. */}
            <div
              className="absolute inset-x-0 top-0 z-0 transition-all"
              style={{ bottom: designCanvasBottom, right: designCanvasRight, boxShadow: designCanvasInsetShadow }}
            >
              <KeyboardCanvas />
            </div>

            {storeState.isProjectOpen && (
              <>
                {/* Position ZoomControls dynamically relative to the top of the Bottom Tray */}
                <div 
                  className="absolute inset-x-0 h-0 z-[160] transition-all duration-300"
                  style={{ bottom: designCanvasBottom, right: designCanvasRight }}
                >
                  <ZoomControls />
                </div>

                <aside
                  className="absolute top-0 right-0 z-[90] w-[380px] bg-[var(--bg-panel)] border-l border-[var(--border-main)] overflow-visible flex animate-in fade-in slide-in-from-right-2 duration-200"
                  style={{ bottom: 0 }}
                >
                  <div className="shrink-0 w-12 border-r border-[var(--border-main)] bg-[var(--bg-app)]/50">
                    <div className="flex flex-col items-center gap-1 px-1.5 py-2">
                      {rightPanelTabs.map(item => {
                        if (item.type === 'separator') {
                          return <div key={item.id} className="my-1 h-px w-7 bg-[var(--border-main)]/70" />;
                        }

                        const { id, title, icon: Icon } = item;
                        return (
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
                        );
                      })}
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
                    {activeRightPanel === 'settings' && (
                      <HardwareSettingsPanel />
                    )}
                    {activeRightPanel === 'properties' && editorMode === 'layout' && <PropertyPanel />}
                    {activeRightPanel === 'matrixPainter' && editorMode === 'matrix' && (
                      <div className="h-full">
                        <MatrixPainter />
                      </div>
                    )}
                    {activeRightPanel === 'options' && <LayoutOptionsPanel />}
                    {activeRightPanel === 'keymap' && editorMode === 'keymap' && <KeycodeConfigPanel />}
                    {activeRightPanel === 'pins' && editorMode === 'matrix' && (
                      <div className="h-full overflow-hidden">
                        <MatrixPinInspectorPanel />
                      </div>
                    )}
                    {activeRightPanel === 'macros' && <MacroPanel scope="project" />}
                    {activeRightPanel === 'combos' && <ComboPanel scope="project" />}
                    {activeRightPanel === 'tapDance' && <TapDancePanel scope="project" />}
                    </div>
                  </div>
                </aside>

                  {/* Left Side Floating Widgets */}
                  <div className="absolute top-4 left-4 z-[100] flex flex-col gap-4">
                    <EditorTools floating />
                  </div>
                </>
                )}

              {/* Bottom Tray */}
              {storeState.isProjectOpen && editorMode === 'keymap' && (
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 bg-[var(--bg-panel)] border-t border-[var(--border-main)] z-[150] flex flex-col overflow-hidden transition-all h-[400px]"
                  )}
                  style={{ right: designCanvasRight }}
                >
                  <KeycodePanel />
                </div>
              )}
            </main>
        ) : (
          <RemapView />
        )}
      </div>

      {/* Hardware Setup Modal */}
      {storeState.isHardwareModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-all" onClick={() => storeState.setIsHardwareModalOpen(false)} />
          <div className="relative bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-app)]/50">
              <div className="flex items-center gap-3">
                <Settings size={18} className="text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-highlight)]">{t('hardware.title')}</h2>
                  <p className="text-xs text-[var(--text-muted)] font-medium">{t('hardware.desc')}</p>
                </div>
              </div>
              <button 
                onClick={() => storeState.setIsHardwareModalOpen(false)}
                className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-highlight)] rounded transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-panel)]">
              <HardwareSettingsPanel />
            </div>
            
            <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-end shrink-0 gap-3">
              <button 
                onClick={() => {
                  storeState.setIsProjectOpen(true);
                  storeState.setIsHardwareModalOpen(false);
                }}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-xs font-bold transition-all shadow-lg shadow-amber-500/10 active:scale-95"
              >
                {t('hardware.confirmBtn')}
              </button>
            </div>
          </div>


        </div>
      )}
      <UnlockModal />
      <ZmkUnlockModal />
      {editorSettings.debugMode && <DebugOverlay />}
    </div>
  );
}

// Global debug helper for Vial integration
if (typeof window !== 'undefined') {
  (window as any).setAppDebug = (data: any) => {
    const event = new CustomEvent('app-debug', { detail: data });
    window.dispatchEvent(event);
  };
}

function DebugOverlay() {
  const { t } = useTranslation();
  const [importData, setImportData] = React.useState<any>(null);
  const [liveData, setLiveData] = React.useState<any>(null);
  const [isVisible, setIsVisible] = React.useState(true);

  React.useEffect(() => {
    const handler = (e: any) => {
      const data = e.detail;
      console.log('[DebugOverlay] Received event:', data.type);
      if (data.type === 'import') {
        setImportData(data);
      } else {
        setLiveData(data);
      }
      setIsVisible(true);
    };
    window.addEventListener('app-debug', handler);
    return () => window.removeEventListener('app-debug', handler);
  }, []);

  if (!isVisible) return (
    <button 
      onClick={() => setIsVisible(true)}
      className="fixed bottom-4 right-4 px-3 py-1 bg-zinc-800 text-zinc-500 rounded text-[10px] border border-zinc-700 hover:text-white z-[999]"
    >
      {t('debug.openConsole')}
    </button>
  );

  const handleCopy = (data: any) => {
    if (!data) return;
    const text = JSON.stringify(data.raw || data, null, 2);
    navigator.clipboard.writeText(text);
    const btn = document.activeElement as HTMLElement;
    if (btn) {
      const original = btn.innerText;
      btn.innerText = t('common.copied');
      setTimeout(() => { btn.innerText = original; }, 2000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-[500px] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col z-[999] text-[10px] font-mono animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-zinc-300 uppercase font-bold tracking-widest">{t('debug.consoleTitle')}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setImportData(null); setLiveData(null); }} className="text-zinc-500 hover:text-white transition-colors">{t('debug.clearAll')}</button>
          <button onClick={() => setIsVisible(false)} className="text-zinc-500 hover:text-white transition-colors">{t('debug.minimize')}</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-950/90 custom-scrollbar p-4 space-y-6">
        {/* Import Section */}
        <section className="border border-zinc-800 rounded-md bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-2">
            <h3 className="text-amber-500 font-bold uppercase tracking-wider">📁 {t('debug.lastImportedJson')}</h3>
            {importData && (
              <button 
                onClick={() => handleCopy(importData)}
                className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-all font-bold"
              >
                {t('debug.copyFullJson')}
              </button>
            )}
          </div>
          {!importData ? (
            <div className="text-zinc-600 italic py-2">{t('debug.noFileImported')}</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="text-zinc-500">{t('debug.name')}: <span className="text-zinc-300">{importData.parsed?.name || t('common.unknown')}</span></div>
                <div className="text-zinc-500">{t('debug.keys')}: <span className="text-zinc-300">{importData.parsed?.keys}</span></div>
              </div>
              <pre className="text-zinc-400 bg-black/60 p-2 rounded max-h-[300px] overflow-auto border border-zinc-800 leading-relaxed">
                {JSON.stringify(importData.raw, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* Live Data Section */}
        <section className="border border-zinc-800 rounded-md bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-2">
            <h3 className="text-cyan-500 font-bold uppercase tracking-wider">🔌 {t('debug.liveDeviceStatus')}</h3>
            {liveData && (
              <button 
                onClick={() => handleCopy(liveData)}
                className="px-2 py-0.5 bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 rounded hover:bg-cyan-500/20 transition-all font-bold"
              >
                {t('debug.copyLiveData')}
              </button>
            )}
          </div>
          {!liveData ? (
            <div className="text-zinc-600 italic py-2 animate-pulse">{t('debug.waitingForDevice')}</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-cyan-500 font-bold">{t('debug.layoutBitmask')}:</div>
                <div className="text-white bg-black/60 p-2 rounded border border-zinc-800">{liveData.layoutOptions}</div>
                <div className="text-[8px] text-zinc-600 break-all px-1">{liveData.layoutOptions?.toString(2).padStart(32, '0')}</div>
              </div>
              
              <div>
                <div className="text-cyan-500 font-bold mb-1">{t('debug.decodedOptions')}:</div>
                <pre className="text-cyan-400/80 bg-black/60 p-2 rounded border border-zinc-800 max-h-40 overflow-auto">
                  {JSON.stringify(liveData.decodedOptions, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-cyan-500 font-bold mb-1">{t('debug.layoutLabels')}:</div>
                <pre className="text-zinc-500 bg-black/60 p-2 rounded border border-zinc-800 max-h-40 overflow-auto">
                  {JSON.stringify(liveData.vialLabels || [], null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
