import React from 'react';
import { LayoutGrid, Settings, CircuitBoard, Save, Download, Keyboard, X, FolderOpen, FileUp, FileDown, Trash2, Undo2, Redo2, Move, Wrench, SlidersHorizontal, Layers, SquarePen, Sun, Moon, Languages, Cpu, ChevronDown, Plus, MousePointer2, Sparkles, Loader2, Check, Sliders } from 'lucide-react';
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
import { MatrixPropertyPanel } from '@/components/MatrixPropertyPanel';
import { KeycodeConfigPanel } from '@/components/KeycodeConfigPanel';
import { UnlockModal } from '@/components/UnlockModal';
import { ZmkUnlockModal } from '@/components/ZmkUnlockModal';
import { useKeyboardStore } from '@/lib/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSmidrProjectJson, downloadJson, downloadBlob, generateViaJson } from '@/lib/export';
import { generateQmkZip } from '@/lib/qmk';
import { generateVialZip } from '@/lib/vial';
import { generateZmkZip } from '@/lib/zmk';
import { qmkStringToAction } from '@/lib/protocols/via-action-converter';
import { UniversalAction } from '@/types/actions';
import { SmidrProject, PhysicalKey } from '@/types/keyboard';
import { saveProject, listProjects, deleteProject } from '@/lib/storage';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const storeState = useKeyboardStore();
  const { 
    editorMode, setEditorMode, settings, updateSettings, keys,
    currentLayer, setCurrentLayer, currentProjectId, loadProject,
    editorSettings, updateEditorSettings, connectedDevice,
    selectedKeyIds, deleteSelectedKeycodes
  } = storeState;

  // Use zundo temporal store for reactive undo/redo states
  const { undo, redo, pastStates, futureStates } = useStore((useKeyboardStore as any).temporal, (state: any) => state);
  const { t, language, setLanguage } = useTranslation();
  const [isProjectMenuOpen, setIsProjectMenuOpen] = React.useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = React.useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = React.useState(false);
  const [isEditorModeMenuOpen, setIsEditorModeMenuOpen] = React.useState(false);
  const [savedProjects, setSavedProjects] = React.useState<any[]>([]);
  const [isLeftPanelOpen, setIsLeftPanelOpen] = React.useState(false);
  const [isKeycodeConfigOpen, setIsKeycodeConfigOpen] = React.useState(false);

  const [lastSavedHistoryLength, setLastSavedHistoryLength] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = React.useState(false);
  const isDirty = pastStates.length !== lastSavedHistoryLength;
  const [isRestoring, setIsRestoring] = React.useState(false);
  const remapFileInputRef = React.useRef<HTMLInputElement>(null);
  const keyboardFileInputRef = React.useRef<HTMLInputElement>(null);

  const hasDeletableSelection = React.useMemo(() => {
    if (selectedKeyIds.length === 0) return false;
    return keys.some(k => {
      if (!selectedKeyIds.includes(k.id)) return false;
      const action = k.keymap?.[currentLayer];
      return action && action.action !== 'trans';
    });
  }, [selectedKeyIds, keys, currentLayer]);

  const refreshProjectList = () => {
    setSavedProjects(listProjects());
  };

  const handleNewProject = () => {
    if (keys.length > 0 && !confirm(t('common.discardConfirm'))) return;
    storeState.resetProject(true);
    storeState.setIsHardwareModalOpen(true);
    setLastSavedHistoryLength(0);
  };

  React.useEffect(() => {
    refreshProjectList();
  }, []);

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
    saveProject(project);
    loadProject(project, true);
    refreshProjectList();
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

  const handleExportViaZip = async () => {
    const zipBlob = await generateQmkZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_qmk.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportVialZip = async () => {
    const zipBlob = await generateVialZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_vial.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportZmkZip = async () => {
    const zipBlob = await generateZmkZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_zmk.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

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
        alert(t('common.invalidFile') || "Invalid file format.");
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
        alert("No valid keymap mappings found in this file.");
        return;
      }

      setIsRestoring(true);
      
      for (let i = 0; i < writeQueue.length; i++) {
        const item = writeQueue[i];
        await storeState.updateDeviceKeycode(item.layer, item.row, item.col, item.action);
      }
      
      await storeState.syncKeymap();
      alert("Keymap backup restored successfully!");
    } catch (err) {
      console.error("Failed to restore backup:", err);
      alert("Failed to restore backup. Please make sure it is a valid .smidr file.");
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
          <h3 className="text-lg font-bold text-white mb-1">Restoring Keymap...</h3>
          <p className="text-sm text-zinc-400">Please do not unplug the keyboard.</p>
        </div>
      )}
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 bg-[var(--bg-panel)] border-b border-[var(--border-main)] shrink-0">
        <div className="flex items-center gap-3">
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

          {/* Global Actions: Undo/Redo */}
          {storeState.appMode !== 'remap' && (
            <div className="flex items-center bg-[var(--bg-app)]/50 rounded-lg p-0.5 border border-[var(--border-main)]">
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
          )}

          {/* Device Connection Status (Remap Mode Only) */}
          {storeState.appMode === 'remap' && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              <DeviceConnector />
              
              {connectedDevice && (
                <>
                  <div 
                    className="flex items-center gap-2 px-3 h-8 bg-amber-500/5 border border-amber-500/10 rounded-md shrink-0"
                    title={`VID: 0x${connectedDevice.vid.toString(16).toUpperCase().padStart(4, '0')} PID: 0x${connectedDevice.pid.toString(16).toUpperCase().padStart(4, '0')}`}
                  >
                    <Cpu size={14} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-[var(--text-highlight)] uppercase tracking-wider">
                      {connectedDevice.protocolType === 'zmk' ? `ZMK connected: ${settings.name || 'Segl'}` : (connectedDevice.productName || 'Keyboard')}
                    </span>
                  </div>

                  <div className="w-px h-4 bg-[var(--border-main)] shrink-0" />

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Import Backup (.smidr) */}
                    <button 
                      onClick={() => remapFileInputRef.current?.click()}
                      className="flex items-center justify-center w-10 h-8 bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
                      title="Import Backup (.smidr)"
                    >
                      <FileUp size={16} className="group-hover:scale-110 transition-transform" />
                    </button>

                    {/* Export Backup (.smidr) */}
                    <button 
                      onClick={handleExportBackup}
                      className="flex items-center justify-center w-10 h-8 bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
                      title="Export Backup (.smidr)"
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
          )}
          {/* Project Management (Design Mode Only) */}
          {storeState.appMode === 'design' && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleNewProject}
                  className="flex items-center justify-center w-10 h-8 bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] rounded-md transition-all group"
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
                      "h-8 w-10 flex items-center justify-center rounded-md bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all",
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
                  className={cn(
                    "flex items-center justify-center w-10 h-8 rounded-md bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)] transition-all disabled:pointer-events-none group"
                  )}
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
                        : "bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)]",
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
                        : "bg-[var(--bg-app)]/50 border border-[var(--border-main)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text-highlight)]"
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
                            onClick={handleExportViaZip}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                          >
                            <Download size={14} className="text-amber-500" />
                            <span>{t('header.exportViaZip')}</span>
                          </button>
                          <button 
                            onClick={handleExportVialZip}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                          >
                            <Download size={14} className="text-amber-500" />
                            <span>{t('header.exportVialZip')}</span>
                          </button>

                          {(() => {
                            const isAvrMcu = settings.hardware?.mcu === 'atmega32u4';
                            return (
                              <button 
                                onClick={handleExportZmkZip}
                                disabled={isAvrMcu}
                                className={cn(
                                  "w-full flex items-center justify-between px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all text-left",
                                  isAvrMcu 
                                    ? "opacity-40 cursor-not-allowed text-[var(--text-muted)]" 
                                    : "hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] cursor-pointer"
                                )}
                                title={isAvrMcu ? "ZMK does not support AVR microcontrollers (Zephyr RTOS is 32-bit only)" : undefined}
                              >
                                <div className="flex items-center gap-2">
                                  <Download size={14} className={isAvrMcu ? "text-[var(--text-muted)]" : "text-amber-500"} />
                                  <span>{t('header.exportZmkZip')}</span>
                                </div>
                                {isAvrMcu && (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-bold tracking-tighter">
                                    AVR非対応
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
                    className="bg-[var(--bg-app)] border border-[var(--border-main)] px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 w-48 transition-all"
                    placeholder={t('header.projectName')}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">



          {/* Mode Switcher Group */}
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


            {/* Main Mode Switcher */}
            <div className="flex bg-[var(--bg-app)] rounded-md p-0.5 border border-[var(--border-main)] h-8 items-center">
              <button
                onClick={() => storeState.setAppMode('remap')}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 h-full rounded-[4px] text-[10px] font-bold transition-all uppercase tracking-wider",
                  storeState.appMode === 'remap' 
                    ? "bg-amber-500 text-zinc-950 shadow-sm" 
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title="Remap"
              >
                <Keyboard size={14} />
                <span className="hidden lg:block">Remap</span>
              </button>
              <button
                onClick={() => storeState.setAppMode('design')}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-3 h-full rounded-[4px] text-[10px] font-bold transition-all uppercase tracking-wider",
                  storeState.appMode === 'design' 
                    ? "bg-amber-500 text-zinc-950 shadow-sm" 
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title="Design"
              >
                <SquarePen size={14} />
                <span className="hidden lg:block">Design</span>
              </button>
            </div>
          </div>
        </div>
      </header>


      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Main Workspace Area */}
        {storeState.appMode === 'design' ? (
          <main className="flex-1 relative overflow-hidden flex flex-col bg-[var(--bg-app)]">
            {/* Full-screen absolute canvas flowing underneath the UI panels */}
            <div className="absolute inset-0 z-0">
              <KeyboardCanvas />
            </div>

            {storeState.isProjectOpen && (
              <>
                {/* Position ZoomControls dynamically relative to the top of the Bottom Tray */}
                <div 
                  className="absolute inset-x-0 h-0 z-[160] transition-all duration-300"
                  style={{ 
                    bottom: editorMode === 'keymap' ? '400px' : (editorMode === 'layout' || editorMode === 'matrix') ? '288px' : '0px' 
                  }}
                >
                  <ZoomControls />
                </div>
                
                {/* Right Side Floating Widgets (Swapped from Left Side) */}
                <div className="absolute top-4 right-4 z-[100] flex flex-col gap-4 items-end">
                  {/* Floating Vertical Mode Switcher (Pill shape) */}
                  <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
                    {(['layout', 'matrix', 'keymap'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setEditorMode(mode)}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                            editorMode === mode 
                              ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                              : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                          )}
                          title={t(`modes.${mode}`)}
                        >
                          {mode === 'layout' && <Move size={18} />}
                          {mode === 'matrix' && <CircuitBoard size={18} />}
                          {mode === 'keymap' && <Keyboard size={18} />}
                          
                          {/* Floating Label on Hover */}
                          <div className="absolute right-full mr-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm">
                            {t(`modes.${mode}`)}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Configuration Group (Pill shape) */}
                    <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500 delay-75">
                      {/* Hardware Settings Toggle Button */}
                      <button
                        onClick={() => storeState.setIsHardwareModalOpen(true)}
                        className={cn(
                          "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group text-[var(--text-dim)] hover:text-amber-500 hover:bg-[var(--bg-hover)]"
                        )}
                        title={t('header.setupTooltip')}
                      >
                        <Settings size={18} />
                        <div className="absolute right-full mr-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl">
                          {t('common.setup')}
                        </div>
                      </button>

                      <div className="w-6 h-px bg-[var(--border-main)] mx-auto my-0.5" />

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
                    <div 
                      className="absolute top-4 right-20 w-72 z-[130] bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-8 duration-300 transition-all duration-300"
                      style={{
                        bottom: editorMode === 'keymap' ? '416px' : (editorMode === 'layout' || editorMode === 'matrix') ? '304px' : '16px'
                      }}
                    >
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
                  {isKeycodeConfigOpen && editorMode === 'keymap' && (
                    <div 
                      className="absolute top-4 left-20 w-72 z-[130] bg-[var(--bg-panel)]/95 backdrop-blur-xl border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-left-8 duration-300 transition-all duration-300"
                      style={{
                        bottom: editorMode === 'keymap' ? '416px' : (editorMode === 'layout' || editorMode === 'matrix') ? '304px' : '16px'
                      }}
                    >
                      <div className="p-4 border-b border-[var(--border-main)] bg-amber-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench size={16} className="text-amber-500" />
                          <span className="text-xs font-black uppercase tracking-widest text-amber-500">{t('keycodeConfig.title') || 'Keymap Config'}</span>
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

                  {/* Left Side Floating Widgets */}
                  <div className="absolute top-4 left-4 z-[100] flex flex-col gap-4">
                    {editorMode === 'keymap' && (
                      <div className="flex flex-col gap-2 bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-main)] rounded-full p-1.5 shadow-2xl animate-in fade-in slide-in-from-left-4 duration-500">
                        <button 
                          onClick={() => setIsKeycodeConfigOpen(!isKeycodeConfigOpen)}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group",
                            isKeycodeConfigOpen 
                              ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 scale-110 z-10" 
                              : "text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                          )}
                          title={t('keycodeConfig.title') || 'Keymap Config'}
                        >
                          <Wrench size={18} className={cn("transition-transform duration-500", isKeycodeConfigOpen && "rotate-45 scale-110")} />
                          <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                            {t('keycodeConfig.title') || 'Keymap Config'}
                          </div>
                        </button>

                        {hasDeletableSelection && (
                          <>
                            <div className="w-6 h-px bg-[var(--border-main)] mx-auto my-0.5 animate-in fade-in duration-200" />
                            <button 
                              onClick={deleteSelectedKeycodes}
                              className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 relative group text-red-500 hover:text-red-400 hover:bg-red-500/10 active:scale-95 animate-in fade-in zoom-in duration-200"
                              title={t('remap.deleteAssignment') || 'Delete Keymap'}
                            >
                              <Trash2 size={18} className="transition-transform duration-300 group-hover:scale-110" />
                              <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-900/95 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 uppercase tracking-[0.2em] shadow-2xl backdrop-blur-sm z-50">
                                {t('remap.deleteAssignment') || 'Delete Keymap'}
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    
                    <EditorTools floating />
                  </div>
                </>
                )}

              {/* Bottom Tray */}
              {storeState.isProjectOpen && (editorMode === 'keymap' || editorMode === 'layout' || editorMode === 'matrix') && (
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 bg-[var(--bg-panel)] border-t border-[var(--border-main)] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[150] flex flex-col overflow-hidden transition-all",
                    editorMode === 'keymap' ? "h-[400px]" : "h-72"
                  )}
                >
                  {editorMode === 'keymap' ? <KeycodePanel /> : editorMode === 'matrix' ? <MatrixPropertyPanel /> : <PropertyPanel />}
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
          <div className="relative bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-panel)]/50 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-xl text-zinc-950 shadow-lg shadow-amber-500/20">
                  <Settings size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-highlight)]">{t('hardware.title')}</h2>
                  <p className="text-xs text-[var(--text-muted)] font-medium">{t('hardware.desc')}</p>
                </div>
              </div>
              <button 
                onClick={() => storeState.setIsHardwareModalOpen(false)}
                className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-highlight)] rounded-xl transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-app)]/20 p-2">
              <HardwareSettingsPanel />
            </div>
            
            <div className="p-6 border-t border-[var(--border-main)] bg-[var(--bg-panel)]/50 flex justify-end shrink-0 gap-3">
              <button 
                onClick={() => {
                  storeState.setIsProjectOpen(true);
                  storeState.setIsHardwareModalOpen(false);
                }}
                className="px-8 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/10 active:scale-95"
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
      Open Debug Console
    </button>
  );

  const handleCopy = (data: any) => {
    if (!data) return;
    const text = JSON.stringify(data.raw || data, null, 2);
    navigator.clipboard.writeText(text);
    const btn = document.activeElement as HTMLElement;
    if (btn) {
      const original = btn.innerText;
      btn.innerText = 'Copied!';
      setTimeout(() => { btn.innerText = original; }, 2000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-[500px] max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden flex flex-col z-[999] text-[10px] font-mono animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between p-3 bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-zinc-300 uppercase font-bold tracking-widest">VIAL / VIA DEBUG CONSOLE</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setImportData(null); setLiveData(null); }} className="text-zinc-500 hover:text-white transition-colors">Clear All</button>
          <button onClick={() => setIsVisible(false)} className="text-zinc-500 hover:text-white transition-colors">Minimize</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-950/90 custom-scrollbar p-4 space-y-6">
        {/* Import Section */}
        <section className="border border-zinc-800 rounded-md bg-black/20 p-3">
          <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-2">
            <h3 className="text-amber-500 font-bold uppercase tracking-wider">📁 Last Imported JSON</h3>
            {importData && (
              <button 
                onClick={() => handleCopy(importData)}
                className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-all font-bold"
              >
                COPY FULL JSON
              </button>
            )}
          </div>
          {!importData ? (
            <div className="text-zinc-600 italic py-2">No file imported yet this session.</div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div className="text-zinc-500">Name: <span className="text-zinc-300">{importData.parsed?.name || 'Unknown'}</span></div>
                <div className="text-zinc-500">Keys: <span className="text-zinc-300">{importData.parsed?.keys}</span></div>
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
            <h3 className="text-cyan-500 font-bold uppercase tracking-wider">🔌 Live Device Status</h3>
            {liveData && (
              <button 
                onClick={() => handleCopy(liveData)}
                className="px-2 py-0.5 bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 rounded hover:bg-cyan-500/20 transition-all font-bold"
              >
                COPY LIVE DATA
              </button>
            )}
          </div>
          {!liveData ? (
            <div className="text-zinc-600 italic py-2 animate-pulse">Waiting for device communication...</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-cyan-500 font-bold">Layout Bitmask:</div>
                <div className="text-white bg-black/60 p-2 rounded border border-zinc-800">{liveData.layoutOptions}</div>
                <div className="text-[8px] text-zinc-600 break-all px-1">{liveData.layoutOptions?.toString(2).padStart(32, '0')}</div>
              </div>
              
              <div>
                <div className="text-cyan-500 font-bold mb-1">Decoded Options:</div>
                <pre className="text-cyan-400/80 bg-black/60 p-2 rounded border border-zinc-800 max-h-40 overflow-auto">
                  {JSON.stringify(liveData.decodedOptions, null, 2)}
                </pre>
              </div>

              <div>
                <div className="text-cyan-500 font-bold mb-1">Layout Labels:</div>
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
