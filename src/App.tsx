import React from 'react';
import { LayoutGrid, Settings, CircuitBoard, Save, Download, Keyboard, X, FolderOpen, FileUp, FileDown, Trash2, Undo2, Redo2, Move, Wrench, SlidersHorizontal, SquarePen, Sun, Moon, Languages, Cpu, ChevronDown, Plus, MousePointer2, Sparkles, Loader2, Check, ScrollText, WandSparkles, Workflow, Hash, Lightbulb, ImageDown, Hammer, Braces, Home, Menu, PanelRight } from 'lucide-react';
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
import { RgbMatrixPanel } from '@/components/RgbMatrixPanel';
import { AdvancedPanelKind } from '@/components/advanced-panel-types';
import { MacroPanel } from '@/components/MacroPanel';
import { ComboPanel } from '@/components/ComboPanel';
import { TapDancePanel } from '@/components/TapDancePanel';
import { UnlockModal } from '@/components/UnlockModal';
import { ZmkUnlockModal } from '@/components/ZmkUnlockModal';
import { ProjectHome } from '@/components/ProjectHome';
import { NewProjectSetup } from '@/components/NewProjectSetup';
import { useKeyboardStore } from '@/lib/store';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateSmidrProjectJson, downloadJson, downloadBlob, generateViaJson, generateKleJson } from '@/lib/export';
import { generateQmkZip } from '@/lib/qmk';
import { generateRmkZip } from '@/lib/rmk';
import { generateVialZip } from '@/lib/vial';
import { generateZmkZip } from '@/lib/zmk';
import {
  DEFAULT_KICAD_EXPORT_OPTIONS,
  generateKiCadZip,
  getKiCadFootprintPreviewTemplate,
  getKiCadExportWarnings,
  getKiCadLedPreviewInfo,
  KICAD_DIODE_FOOTPRINTS,
  KICAD_SWITCH_FOOTPRINTS,
  KiCadExportOptions,
} from '@/lib/kicad';
import { FirmwareExportTarget, formatExportValidationIssues, validateFirmwareExport } from '@/lib/export-validation';
import { isQmkSourceExportSupported, isZmkSourceExportSupported } from '@/lib/mcu-presets';
import { qmkStringToAction } from '@/lib/protocols/via-action-converter';
import { UniversalAction } from '@/types/actions';
import { SmidrProject, PhysicalKey } from '@/types/keyboard';
import {
  deleteProject,
  deleteProjectDraft,
  getProjectDraft,
  listProjects,
  saveProject,
  saveProjectDraft,
} from '@/lib/storage';
import { fromSmidrProjectFile } from '@/lib/project-format';
import { PRESET_LAYOUTS } from '@/lib/presets';
import { parseKeyboardDefinition } from '@/lib/parser';
import { isMatrixPositionWithinConfiguredPins, isMatrixSwitchKey, resolveDirectPin } from '@/lib/matrix-utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RightPanelKind = 'settings' | 'properties' | 'matrixPainter' | 'options' | 'keymap' | 'rgbMatrix' | AdvancedPanelKind;
type ProjectWorkspace = 'hardware' | 'firmware';

const findMatchingParenInText = (value: string, start: number) => {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const collectKiCadForms = (value: string, formName: string) => {
  const forms: string[] = [];
  let index = 0;
  while (index < value.length) {
    const start = value.indexOf(`(${formName}`, index);
    if (start === -1) break;
    const end = findMatchingParenInText(value, start);
    if (end === -1) break;
    forms.push(value.slice(start, end + 1));
    index = end + 1;
  }
  return forms;
};

const parseKiCadPoint = (block: string, name: string) => {
  const match = block.match(new RegExp(`\\(${name}\\s+([-+]?\\d*\\.?\\d+)\\s+([-+]?\\d*\\.?\\d+)(?:\\s+([-+]?\\d*\\.?\\d+))?`));
  if (!match) return null;
  return {
    x: Number.parseFloat(match[1]),
    y: Number.parseFloat(match[2]),
    r: match[3] === undefined ? 0 : Number.parseFloat(match[3]),
  };
};

const parseKiCadSize = (block: string, name: string) => {
  const match = block.match(new RegExp(`\\(${name}\\s+([-+]?\\d*\\.?\\d+)(?:\\s+([-+]?\\d*\\.?\\d+))?`));
  if (!match) return null;
  return { w: Number.parseFloat(match[1]), h: Number.parseFloat(match[2] ?? match[1]) };
};

const isSilkLayer = (block: string) => /\(layer\s+"[FB]\.SilkS"\)/.test(block);

const normalizeSvgArcDelta = (angle: number) => {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
};

const getSvgArcFromThreePoints = (
  start: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number }
) => {
  const determinant = 2 * (
    start.x * (mid.y - end.y) +
    mid.x * (end.y - start.y) +
    end.x * (start.y - mid.y)
  );
  if (Math.abs(determinant) < 0.000001) return null;

  const startSq = start.x ** 2 + start.y ** 2;
  const midSq = mid.x ** 2 + mid.y ** 2;
  const endSq = end.x ** 2 + end.y ** 2;
  const center = {
    x: (
      startSq * (mid.y - end.y) +
      midSq * (end.y - start.y) +
      endSq * (start.y - mid.y)
    ) / determinant,
    y: (
      startSq * (end.x - mid.x) +
      midSq * (start.x - end.x) +
      endSq * (mid.x - start.x)
    ) / determinant,
  };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const positiveDelta = normalizeSvgArcDelta(endAngle - startAngle);
  const midDelta = normalizeSvgArcDelta(midAngle - startAngle);
  const sweepFlag = midDelta <= positiveDelta ? 1 : 0;
  const arcDelta = sweepFlag === 1 ? positiveDelta : Math.PI * 2 - positiveDelta;
  return {
    radius,
    largeArcFlag: arcDelta > Math.PI ? 1 : 0,
    sweepFlag,
  };
};

const renderKiCadFootprintPreview = (
  rawFootprint: string,
  seed: string,
  originX: number,
  originY: number,
  rotation: number,
  scale: number,
  flipBack = false
) => {
  const silkItems: React.ReactNode[] = [];
  const smdPadItems: React.ReactNode[] = [];
  const thruHoleItems: React.ReactNode[] = [];
  const npthItems: React.ReactNode[] = [];
  const toSvgX = (x: number) => x * scale;
  const toSvgY = (y: number) => (flipBack ? -y : y) * scale;
  const toSvgLength = (value: number) => Math.abs(value * scale);
  const toSvgAngle = (angle: number) => (flipBack ? 180 - angle : angle);

  collectKiCadForms(rawFootprint, 'pad').forEach((block, index) => {
    const head = block.match(/^\(pad\s+"[^"]*"\s+([^\s]+)\s+([^\s]+)/);
    const at = parseKiCadPoint(block, 'at') ?? { x: 0, y: 0, r: 0 };
    const size = parseKiCadSize(block, 'size') ?? { w: 1, h: 1 };
    const drill = parseKiCadSize(block, 'drill');
    const type = head?.[1] ?? '';
    const shape = head?.[2] ?? '';
    const isHole = type.includes('thru_hole');
    const isNp = type.includes('np_thru_hole');
    const fill = isNp ? 'rgba(15, 23, 42, 0.92)' : isHole ? 'rgba(251, 191, 36, 0.52)' : 'rgba(56, 189, 248, 0.58)';
    const stroke = isNp ? 'rgba(226, 232, 240, 0.8)' : isHole ? 'rgb(251, 191, 36)' : 'rgb(56, 189, 248)';
    const padWidth = toSvgLength(size.w);
    const padHeight = toSvgLength(size.h);
    const rx = shape.includes('roundrect') || shape.includes('circle') || shape.includes('oval') ? Math.min(padWidth, padHeight) * 0.22 : 0;
    const padItems = isNp ? npthItems : isHole ? thruHoleItems : smdPadItems;
    padItems.push(
      <g key={`${seed}-pad-${index}`} transform={`translate(${toSvgX(at.x)} ${toSvgY(at.y)}) rotate(${toSvgAngle(at.r)})`}>
        {shape.includes('circle') && Math.abs(size.w - size.h) < 0.01 ? (
          <circle cx="0" cy="0" r={padWidth / 2} fill={fill} stroke={stroke} strokeWidth="1.2" />
        ) : (
          <rect
            x={-padWidth / 2}
            y={-padHeight / 2}
            width={padWidth}
            height={padHeight}
            rx={rx}
            fill={fill}
            stroke={stroke}
            strokeWidth="1.2"
          />
        )}
        {drill && (
          <ellipse
            cx="0"
            cy="0"
            rx={toSvgLength(drill.w) / 2}
            ry={toSvgLength(drill.h) / 2}
            fill="rgba(3, 7, 18, 0.95)"
            stroke="rgba(226, 232, 240, 0.32)"
            strokeWidth="0.8"
          />
        )}
      </g>
    );
  });

  collectKiCadForms(rawFootprint, 'fp_line').filter(isSilkLayer).forEach((block, index) => {
    const start = parseKiCadPoint(block, 'start');
    const end = parseKiCadPoint(block, 'end');
    if (!start || !end) return;
    silkItems.push(
      <line
        key={`${seed}-line-${index}`}
        x1={toSvgX(start.x)}
        y1={toSvgY(start.y)}
        x2={toSvgX(end.x)}
        y2={toSvgY(end.y)}
        stroke="rgba(226, 232, 240, 0.85)"
        strokeWidth="1"
      />
    );
  });

  collectKiCadForms(rawFootprint, 'fp_rect').filter(isSilkLayer).forEach((block, index) => {
    const start = parseKiCadPoint(block, 'start');
    const end = parseKiCadPoint(block, 'end');
    if (!start || !end) return;
    const x1 = toSvgX(start.x);
    const x2 = toSvgX(end.x);
    const y1 = toSvgY(start.y);
    const y2 = toSvgY(end.y);
    silkItems.push(
      <rect
        key={`${seed}-rect-${index}`}
        x={Math.min(x1, x2)}
        y={Math.min(y1, y2)}
        width={Math.abs(x2 - x1)}
        height={Math.abs(y2 - y1)}
        fill="none"
        stroke="rgba(226, 232, 240, 0.85)"
        strokeWidth="1"
      />
    );
  });

  collectKiCadForms(rawFootprint, 'fp_arc').filter(isSilkLayer).forEach((block, index) => {
    const start = parseKiCadPoint(block, 'start');
    const mid = parseKiCadPoint(block, 'mid');
    const end = parseKiCadPoint(block, 'end');
    if (!start || !mid || !end) return;
    const svgStart = { x: toSvgX(start.x), y: toSvgY(start.y) };
    const svgMid = { x: toSvgX(mid.x), y: toSvgY(mid.y) };
    const svgEnd = { x: toSvgX(end.x), y: toSvgY(end.y) };
    const arc = getSvgArcFromThreePoints(svgStart, svgMid, svgEnd);
    if (!arc) {
      silkItems.push(
        <line
          key={`${seed}-arc-${index}`}
          x1={svgStart.x}
          y1={svgStart.y}
          x2={svgEnd.x}
          y2={svgEnd.y}
          stroke="rgba(226, 232, 240, 0.85)"
          strokeWidth="1"
        />
      );
      return;
    }
    silkItems.push(
      <path
        key={`${seed}-arc-${index}`}
        d={`M ${svgStart.x} ${svgStart.y} A ${arc.radius} ${arc.radius} 0 ${arc.largeArcFlag} ${arc.sweepFlag} ${svgEnd.x} ${svgEnd.y}`}
        fill="none"
        stroke="rgba(226, 232, 240, 0.85)"
        strokeWidth="1"
      />
    );
  });

  collectKiCadForms(rawFootprint, 'fp_circle').filter(isSilkLayer).forEach((block, index) => {
    const center = parseKiCadPoint(block, 'center');
    const end = parseKiCadPoint(block, 'end');
    if (!center || !end) return;
    const radius = Math.hypot(toSvgX(end.x) - toSvgX(center.x), toSvgY(end.y) - toSvgY(center.y));
    silkItems.push(
      <circle
        key={`${seed}-circle-${index}`}
        cx={toSvgX(center.x)}
        cy={toSvgY(center.y)}
        r={radius}
        fill="none"
        stroke="rgba(226, 232, 240, 0.85)"
        strokeWidth="1"
      />
    );
  });

  return (
    <g transform={`translate(${originX} ${originY}) rotate(${rotation})`}>
      {silkItems}
      {smdPadItems}
      {thruHoleItems}
      {npthItems}
    </g>
  );
};

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
  const [isPinSettingsDialogOpen, setIsPinSettingsDialogOpen] = React.useState(false);
  const [isKiCadDialogOpen, setIsKiCadDialogOpen] = React.useState(false);
  const [isZmkExportDialogOpen, setIsZmkExportDialogOpen] = React.useState(false);
  const [kicadExportOptions, setKiCadExportOptions] = React.useState<KiCadExportOptions>(DEFAULT_KICAD_EXPORT_OPTIONS);
  const [isLangMenuOpen, setIsLangMenuOpen] = React.useState(false);
  const [isEditorModeMenuOpen, setIsEditorModeMenuOpen] = React.useState(false);
  const [savedProjects, setSavedProjects] = React.useState<any[]>([]);
  const [activeRightPanel, setActiveRightPanel] = React.useState<RightPanelKind>('settings');
  const [projectWorkspace, setProjectWorkspace] = React.useState<ProjectWorkspace>(
    editorMode === 'keymap' || editorMode === 'rgbMatrix' ? 'firmware' : 'hardware'
  );
  const [isHomeVisible, setIsHomeVisible] = React.useState(!storeState.isDemoMode);
  const [isLeftNavOpen, setIsLeftNavOpen] = React.useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = React.useState(false);
  const [newProjectPreset, setNewProjectPreset] = React.useState('Blank Layout');

  const [lastSavedHistoryLength, setLastSavedHistoryLength] = React.useState(0);
  const [currentSavedUpdatedAt, setCurrentSavedUpdatedAt] = React.useState<number | null>(null);
  const [restoredDraftDirty, setRestoredDraftDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const isDirty = restoredDraftDirty || pastStates.length !== lastSavedHistoryLength;
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
  const isKiCadDirectPin = settings.matrix.wiring === 'direct';
  const diodePreviewScale = 5;
  const diodeOffsetX = kicadExportOptions.diodeOffsetX ?? DEFAULT_KICAD_EXPORT_OPTIONS.diodeOffsetX;
  const diodeOffsetY = kicadExportOptions.diodeOffsetY ?? DEFAULT_KICAD_EXPORT_OPTIONS.diodeOffsetY;
  const diodeRotation = kicadExportOptions.diodeRotation ?? DEFAULT_KICAD_EXPORT_OPTIONS.diodeRotation;
  const diodePreviewX = 90 + diodeOffsetX * diodePreviewScale;
  const diodePreviewY = 90 + diodeOffsetY * diodePreviewScale;
  const switchPreviewTemplate = getKiCadFootprintPreviewTemplate(kicadExportOptions.switchFootprint);
  const diodePreviewTemplate = getKiCadFootprintPreviewTemplate(kicadExportOptions.diodeFootprint);
  const switchPreviewChoice = KICAD_SWITCH_FOOTPRINTS.find(option => option.footprint === kicadExportOptions.switchFootprint);
  const diodePreviewChoice = KICAD_DIODE_FOOTPRINTS.find(option => option.footprint === kicadExportOptions.diodeFootprint);
  const switchPreviewBack = switchPreviewChoice?.mountType === 'smd';
  const diodePreviewBack = diodePreviewChoice?.mountType === 'smd';
  const diodePreviewRotation = (diodePreviewBack ? 180 : 0) + diodeRotation;
  const ledPreview = getKiCadLedPreviewInfo(kicadExportOptions.switchFootprint);
  const ledPreviewX = 90 + ledPreview.offset.x * diodePreviewScale;
  const ledPreviewY = 90 + ledPreview.offset.y * diodePreviewScale;
  const updateKiCadNumberOption = (key: 'diodeOffsetX' | 'diodeOffsetY' | 'diodeRotation', value: string) => {
    const parsed = Number.parseFloat(value);
    setKiCadExportOptions(options => ({ ...options, [key]: Number.isFinite(parsed) ? parsed : 0 }));
  };

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
    if (isDirty && !confirm(t('common.discardConfirm'))) return;
    storeState.setAppMode('design');
    storeState.resetProject(false);
    storeState.setIsHardwareModalOpen(true);
    setIsHomeVisible(false);
    setProjectWorkspace('hardware');
    setNewProjectPreset('Blank Layout');
    setLastSavedHistoryLength(0);
    setCurrentSavedUpdatedAt(null);
    setRestoredDraftDirty(false);
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
    const id = currentProjectId || crypto.randomUUID();
    const project: SmidrProject = {
      id,
      updatedAt: Date.now(),
      ...settings,
      keys
    };
    try {
      if (!storeState.isDemoMode) {
        const savedProject = saveProject(project);
        deleteProjectDraft(savedProject.id);
        setCurrentSavedUpdatedAt(savedProject.updatedAt);
        setRestoredDraftDirty(false);
        if (!currentProjectId) loadProject(savedProject, true);
        refreshProjectList();
      }
      setSaveError(false);
      setLastSavedHistoryLength(pastStates.length);
      setShowSavedFeedback(true);
      setTimeout(() => setShowSavedFeedback(false), 1600);
    } catch (error) {
      console.error('Failed to save project', error);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    if (
      !storeState.isProjectOpen
      || storeState.isHardwareModalOpen
      || storeState.isDemoMode
      || !currentProjectId
      || currentSavedUpdatedAt === null
      || !isDirty
    ) return;
    const timer = window.setTimeout(() => {
      try {
        saveProjectDraft({ id: currentProjectId, updatedAt: Date.now(), ...settings, keys }, currentSavedUpdatedAt);
      } catch (error) {
        console.error('Failed to save project recovery draft', error);
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    settings,
    keys,
    currentProjectId,
    currentSavedUpdatedAt,
    isDirty,
    storeState.isProjectOpen,
    storeState.isHardwareModalOpen,
    storeState.isDemoMode,
  ]);

  React.useEffect(() => {
    if (
      !storeState.isProjectOpen
      || storeState.isDemoMode
      || !currentProjectId
      || currentSavedUpdatedAt === null
      || !isDirty
    ) return;
    const saveDraftBeforeUnload = () => {
      try {
        saveProjectDraft({ id: currentProjectId, updatedAt: Date.now(), ...settings, keys }, currentSavedUpdatedAt);
      } catch (error) {
        console.error('Failed to save project recovery draft before unload', error);
      }
    };
    window.addEventListener('beforeunload', saveDraftBeforeUnload);
    return () => window.removeEventListener('beforeunload', saveDraftBeforeUnload);
  }, [
    settings,
    keys,
    currentProjectId,
    currentSavedUpdatedAt,
    isDirty,
    storeState.isProjectOpen,
    storeState.isDemoMode,
  ]);

  const handleLoadProject = (project: SmidrProject) => {
    if (currentProjectId === project.id && isDirty) {
      setIsHomeVisible(false);
      setProjectWorkspace('hardware');
      setIsProjectMenuOpen(false);
      return;
    }
    if (currentProjectId !== project.id && isDirty && !confirm(t('common.discardConfirm'))) return;
    let projectToLoad = project;
    let restoredDraft = false;
    const draft = getProjectDraft(project.id);
    if (draft && draft.baseUpdatedAt === project.updatedAt) {
      if (confirm(t('workspace.restoreDraftPrompt'))) {
        projectToLoad = draft.project;
        restoredDraft = true;
      } else {
        deleteProjectDraft(project.id);
      }
    } else if (draft) {
      deleteProjectDraft(project.id);
    }
    storeState.setAppMode('design');
    loadProject(projectToLoad);
    setCurrentSavedUpdatedAt(project.updatedAt);
    setRestoredDraftDirty(restoredDraft);
    setIsHomeVisible(false);
    setProjectWorkspace('hardware');
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

  const enterWorkspace = (workspace: ProjectWorkspace | 'remap') => {
    setIsHomeVisible(false);
    setIsLeftNavOpen(false);
    if (workspace === 'remap') {
      storeState.setAppMode('remap');
      return;
    }
    storeState.setAppMode('design');
    if (!storeState.isProjectOpen) {
      setIsHomeVisible(true);
      return;
    }
    setProjectWorkspace(workspace);
    if (workspace === 'hardware' && (editorMode === 'keymap' || editorMode === 'rgbMatrix')) {
      setEditorMode('layout');
      setActiveRightPanel('properties');
    }
    if (workspace === 'firmware' && editorMode !== 'keymap' && editorMode !== 'rgbMatrix') {
      setEditorMode('keymap');
      setActiveRightPanel('keymap');
    }
  };

  const navigateDesign = (mode: typeof editorMode, panel: RightPanelKind) => {
    setEditorMode(mode);
    setActiveRightPanel(panel);
    setIsLeftNavOpen(false);
    setIsInspectorOpen(true);
  };

  const cancelNewProject = () => {
    storeState.resetProject(false);
    storeState.setIsHardwareModalOpen(false);
    setIsHomeVisible(true);
  };

  const confirmNewProject = () => {
    const preset = PRESET_LAYOUTS[newProjectPreset as keyof typeof PRESET_LAYOUTS];
    const parsed = newProjectPreset === 'Blank Layout' ? null : parseKeyboardDefinition(preset);
    const project: SmidrProject = {
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
      ...settings,
      name: settings.name.trim() || parsed?.name || newProjectPreset || 'New Project',
      layoutOptions: parsed?.layoutOptions || {},
      activeOptions: parsed?.activeOptions || {},
      matrix: parsed?.matrix || settings.matrix,
      keys: (parsed?.keys || []).map(key => ({ ...key, id: crypto.randomUUID(), keymap: {} })),
    };
    const savedProject = storeState.isDemoMode ? project : saveProject(project);
    loadProject(savedProject, true);
    setCurrentSavedUpdatedAt(savedProject.updatedAt);
    setRestoredDraftDirty(false);
    refreshProjectList();
    storeState.setIsHardwareModalOpen(false);
    setActiveRightPanel('options');
    setEditorMode('layout');
  };

  const handleExportCanvasImage = () => {
    const filename = `${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_canvas.png`;
    window.dispatchEvent(new CustomEvent('smidr:export-canvas-image', { detail: { filename } }));
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

  const handleOpenZmkExportDialog = () => {
    if (!isZmkSourceExportSupported(settings.hardware)) return;
    setIsExportMenuOpen(false);
    setIsZmkExportDialogOpen(true);
  };

  const handleExportZmkZip = async (studio: boolean) => {
    if (!isZmkSourceExportSupported(settings.hardware)) return;
    if (!confirmFirmwareExportValidation('zmk')) return;
    const zipBlob = await generateZmkZip({ settings, keys }, { studio });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_zmk.zip`, zipBlob);
    }
    setIsZmkExportDialogOpen(false);
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleExportRmkZip = async () => {
    if (!confirmFirmwareExportValidation('rmk')) return;
    const zipBlob = await generateRmkZip({ settings, keys });
    if (zipBlob) {
      downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_rmk.zip`, zipBlob);
    }
    setIsProjectMenuOpen(false);
    setIsExportMenuOpen(false);
  };

  const handleOpenKiCadDialog = () => {
    setIsExportMenuOpen(false);
    setIsKiCadDialogOpen(true);
  };

  const handleExportKiCadZip = async () => {
    if (keys.length === 0) {
      alert(t('kicad.noKeys'));
      return;
    }

    const warnings = getKiCadExportWarnings({ settings, keys });
    if (warnings.length > 0) {
      const message = warnings.map(warning => t(`kicad.warnings.${warning}`)).join('\n');
      if (!confirm(`${message}\n\n${t('common.continueExport')}`)) return;
    }

    const zipBlob = await generateKiCadZip({ settings, keys }, kicadExportOptions);
    downloadBlob(`${settings.name.replace(/\s+/g, '_').toLowerCase() || 'keyboard'}_kicad.zip`, zipBlob);
    setIsProjectMenuOpen(false);
    setIsKiCadDialogOpen(false);
  };

  const qmkSourceUnsupported = !isQmkSourceExportSupported(settings.hardware);
  const zmkSourceUnsupported = !isZmkSourceExportSupported(settings.hardware);
  const designBottomTrayHeight = storeState.isProjectOpen
    ? editorMode === 'keymap' ? 400 : 0
    : 0;
  const designCanvasBottom = `${designBottomTrayHeight}px`;
  const designRightInspectorWidth = storeState.isProjectOpen ? 360 : 0;
  const designCanvasRight = `${designRightInspectorWidth}px`;
  const designCanvasInsetShadow = [
    designRightInspectorWidth > 0 ? 'inset -18px 0 28px -24px rgba(0,0,0,0.95)' : '',
    designBottomTrayHeight > 0 ? 'inset 0 -18px 32px -26px rgba(0,0,0,0.95)' : '',
  ].filter(Boolean).join(', ');
  const rightPanelTabs: Array<
    | { type: 'tab'; id: RightPanelKind; title: string; icon: React.ComponentType<{ size?: number; className?: string }> }
    | { type: 'separator'; id: string }
  > = [
    ...(editorMode === 'layout'
      ? [{ type: 'tab' as const, id: 'properties' as RightPanelKind, title: t('properties.title'), icon: SquarePen }]
      : []),
    ...(editorMode === 'matrix'
      ? [{ type: 'tab' as const, id: 'matrixPainter' as RightPanelKind, title: t('matrix.keyWiring'), icon: MousePointer2 }]
      : []),
    ...(editorMode === 'keymap'
      ? [{ type: 'tab' as const, id: 'keymap' as RightPanelKind, title: t('keycodeConfig.title') || 'Keymap Config', icon: Wrench }]
      : []),
    ...(editorMode === 'rgbMatrix'
      ? [{ type: 'tab' as const, id: 'rgbMatrix' as RightPanelKind, title: t('rgbMatrix.title'), icon: Lightbulb }]
      : []),
    ...(editorMode === 'keymap'
      ? [
          { type: 'tab' as const, id: 'macros' as RightPanelKind, title: macroPanelMeta.macros.title, icon: macroPanelMeta.macros.icon },
          { type: 'tab' as const, id: 'combos' as RightPanelKind, title: macroPanelMeta.combos.title, icon: macroPanelMeta.combos.icon },
          { type: 'tab' as const, id: 'tapDance' as RightPanelKind, title: macroPanelMeta.tapDance.title, icon: macroPanelMeta.tapDance.icon },
        ]
      : []),
    { type: 'separator', id: 'global-settings' },
    { type: 'tab', id: 'options', title: t('sidebar.layoutOptions'), icon: SlidersHorizontal },
    { type: 'tab', id: 'settings', title: t('hardware.title') || t('header.setupTooltip'), icon: Settings },
  ];
  const activeRightPanelTab = rightPanelTabs.find(
    (item): item is Extract<(typeof rightPanelTabs)[number], { type: 'tab' }> => item.type === 'tab' && item.id === activeRightPanel
  );
  const defaultRightPanelForEditor = (mode: typeof editorMode): RightPanelKind => {
    if (mode === 'layout') return 'properties';
    if (mode === 'matrix') return 'matrixPainter';
    if (mode === 'rgbMatrix') return 'rgbMatrix';
    return 'keymap';
  };

  React.useEffect(() => {
    const isUnavailablePanel =
      (activeRightPanel === 'keymap' && editorMode !== 'keymap') ||
      ((activeRightPanel === 'macros' || activeRightPanel === 'combos' || activeRightPanel === 'tapDance') && editorMode !== 'keymap') ||
      (activeRightPanel === 'matrixPainter' && editorMode !== 'matrix') ||
      (activeRightPanel === 'rgbMatrix' && editorMode !== 'rgbMatrix') ||
      (activeRightPanel === 'properties' && editorMode !== 'layout');

    if (isUnavailablePanel) {
      setActiveRightPanel(defaultRightPanelForEditor(editorMode));
    }
  }, [activeRightPanel, editorMode]);

  React.useEffect(() => {
    if (editorMode !== 'layout') return;
    setActiveRightPanel(storeState.selectedKeyIds.length > 0 ? 'properties' : 'options');
  }, [editorMode, storeState.selectedKeyIds.length]);

  const assignableKeys = keys.filter(key => !key.decal);
  const matrixSwitchKeys = keys.filter(isMatrixSwitchKey);
  const wiringComplete = matrixSwitchKeys.length > 0 && matrixSwitchKeys.every(key =>
    settings.matrix.wiring === 'direct'
      ? !!resolveDirectPin(settings, key, keys)
      : key.row !== undefined
        && key.col !== undefined
        && isMatrixPositionWithinConfiguredPins(settings, key, keys)
  );
  const pinsComplete = settings.matrix.wiring === 'direct'
    ? (settings.pins.direct?.length || 0) > 0 && (!settings.features.split || (settings.pins.splitDirect?.length || 0) > 0)
    : settings.pins.rows.some(Boolean)
      && settings.pins.cols.some(Boolean)
      && (!settings.features.split
        || (!!settings.pins.splitRows?.some(Boolean) && !!settings.pins.splitCols?.some(Boolean)));
  const workflowItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    active: boolean;
    complete: boolean | undefined;
    action: () => void;
  }> = projectWorkspace === 'hardware'
    ? [
        { id: 'setup', label: t('workspace.setup'), icon: Settings, active: activeRightPanel === 'settings', complete: !!settings.name && !!(settings.hardware.mcu || settings.hardware.board), action: () => { setActiveRightPanel('settings'); setIsInspectorOpen(true); } },
        { id: 'layout', label: t('workspace.layout'), icon: Move, active: editorMode === 'layout' && (activeRightPanel === 'properties' || activeRightPanel === 'options'), complete: assignableKeys.length > 0, action: () => navigateDesign('layout', storeState.selectedKeyIds.length > 0 ? 'properties' : 'options') },
        { id: 'pins', label: t('workspace.pins'), icon: Hash, active: isPinSettingsDialogOpen, complete: pinsComplete, action: () => {
          setIsLeftNavOpen(false);
          setIsPinSettingsDialogOpen(true);
        } },
        { id: 'wiring', label: t('workspace.wiring'), icon: CircuitBoard, active: editorMode === 'matrix' && activeRightPanel === 'matrixPainter', complete: wiringComplete, action: () => navigateDesign('matrix', 'matrixPainter') },
        { id: 'pcb', label: t('workspace.pcb'), icon: LayoutGrid, active: isKiCadDialogOpen, complete: undefined, action: () => setIsKiCadDialogOpen(true) },
      ]
    : [
        { id: 'setup', label: t('workspace.setup'), icon: Settings, active: activeRightPanel === 'settings', complete: settings.vendorProductId !== 0, action: () => { setActiveRightPanel('settings'); setIsInspectorOpen(true); } },
        { id: 'keymap', label: t('workspace.keymap'), icon: Keyboard, active: editorMode === 'keymap' && activeRightPanel === 'keymap', complete: assignableKeys.some(key => !!key.keymap && Object.keys(key.keymap).length > 0), action: () => navigateDesign('keymap', 'keymap') },
        { id: 'lighting', label: t('workspace.lighting'), icon: Lightbulb, active: editorMode === 'rgbMatrix', complete: settings.features.rgbMatrix ? assignableKeys.some(key => key.ledIndex !== undefined) : undefined, action: () => navigateDesign('rgbMatrix', 'rgbMatrix') },
        { id: 'macros', label: t('macros.macros'), icon: ScrollText, active: activeRightPanel === 'macros', complete: settings.macros?.some(macro => macro.length > 0) || undefined, action: () => navigateDesign('keymap', 'macros') },
        { id: 'combos', label: t('macros.combos'), icon: Workflow, active: activeRightPanel === 'combos', complete: !!settings.combos?.length || undefined, action: () => navigateDesign('keymap', 'combos') },
        { id: 'tapDance', label: t('keycodeConfig.tapDance'), icon: WandSparkles, active: activeRightPanel === 'tapDance', complete: !!settings.tapDances?.length || undefined, action: () => navigateDesign('keymap', 'tapDance') },
        { id: 'build', label: t('workspace.build'), icon: Download, active: isExportMenuOpen, complete: assignableKeys.length > 0 && wiringComplete, action: () => setIsExportMenuOpen(true) },
      ];

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
      const json = fromSmidrProjectFile(JSON.parse(text));
      if (!json.keys || !json.name) {
        alert(t('common.invalidFile'));
      } else {
        const savedProject = storeState.isDemoMode ? json : saveProject(json);
        loadProject(savedProject);
        setCurrentSavedUpdatedAt(savedProject.updatedAt);
        setRestoredDraftDirty(false);
        setIsHomeVisible(false);
        setProjectWorkspace('hardware');
        refreshProjectList();
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
      const json = fromSmidrProjectFile(JSON.parse(text));
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
          <button type="button" onClick={() => { setIsHomeVisible(true); storeState.setAppMode('design'); }} className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-[var(--bg-hover)]" title="Home">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <img src={`${import.meta.env.BASE_URL}icon.png`} alt="Smiðr Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-lg font-black tracking-tighter text-[var(--text-highlight)]">Smiðr</h1>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-px h-4 bg-[var(--border-main)]" />
            <span className="hidden xl:block text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-[0.3em] whitespace-nowrap translate-y-[1px]">Custom Keyboard Forge</span>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="h-4 w-px bg-[var(--border-main)]" />

            <div className="flex h-10 items-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)] p-1">
              <button
                onClick={() => enterWorkspace('hardware')}
                className={cn(
                  "flex h-full items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all",
                  storeState.appMode === 'design' && projectWorkspace === 'hardware' && !isHomeVisible
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title={t('workspace.hardware')}
              >
                <Hammer size={16} />
                <span className="hidden sm:block">{t('workspace.hardware')}</span>
              </button>
              <button
                onClick={() => enterWorkspace('firmware')}
                className={cn(
                  "flex h-full items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all",
                  storeState.appMode === 'design' && projectWorkspace === 'firmware' && !isHomeVisible
                    ? "bg-amber-500 text-zinc-950 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title={t('workspace.firmware')}
              >
                <Braces size={16} />
                <span className="hidden sm:block">{t('workspace.firmware')}</span>
              </button>
              <button
                onClick={() => enterWorkspace('remap')}
                className={cn(
                  "flex h-full items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition-all",
                  storeState.appMode === 'remap' && !isHomeVisible ? "bg-amber-500 text-zinc-950 shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                )}
                title={t('modes.remap')}
              >
                <Keyboard size={16} />
                <span className="hidden sm:block">{t('modes.remap')}</span>
              </button>
            </div>
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

      <div className={cn("min-h-12 shrink-0 items-center justify-between gap-3 overflow-visible border-b border-[var(--border-main)] bg-[var(--bg-app)]/80 px-3 py-2 md:px-4", isHomeVisible ? "hidden" : "flex")}>
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
                "flex h-10 min-w-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all group shrink-0 relative overflow-hidden disabled:pointer-events-none",
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
              <span className="hidden xl:inline">
                {saveError
                  ? t('workspace.saveFailed')
                  : isSaving
                    ? t('workspace.saving')
                    : isDirty
                      ? t('workspace.unsaved')
                      : t('workspace.saved')}
              </span>
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
                        onClick={handleExportCanvasImage}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                      >
                        <ImageDown size={14} className="text-amber-500" />
                        <span>{t('header.exportCanvasImage')}</span>
                      </button>

                      <button
                        onClick={handleOpenKiCadDialog}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                      >
                        <CircuitBoard size={14} className="text-amber-500" />
                        <span>{t('header.exportKiCadZip')}</span>
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

                      <button
                        onClick={handleExportRmkZip}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--bg-hover)] text-[var(--text-main)] hover:text-[var(--text-highlight)] text-[10px] font-bold uppercase tracking-wider transition-all text-left"
                      >
                        <Download size={14} className="text-amber-500" />
                        <span>{t('header.exportRmkZip')}</span>
                      </button>

                      {(() => {
                        return (
                          <button
                            onClick={handleOpenZmkExportDialog}
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
        {isHomeVisible ? (
          <ProjectHome
            projects={savedProjects}
            onCreate={handleNewProject}
            onImport={handleImportProject}
            onConnect={() => enterWorkspace('remap')}
            onOpen={handleLoadProject}
            onDelete={handleDeleteProject}
            labels={{
              eyebrow: t('workspace.homeEyebrow'),
              title: t('workspace.homeTitle'),
              description: t('workspace.homeDescription'),
              create: t('workspace.createProject'),
              createDescription: t('workspace.createProjectDescription'),
              import: t('workspace.importProject'),
              importDescription: t('workspace.importProjectDescription'),
              connect: t('workspace.connectKeyboard'),
              connectDescription: t('workspace.connectKeyboardDescription'),
              recent: t('workspace.recentProjects'),
              empty: t('workspace.noRecentProjects'),
              keys: t('workspace.keys'),
            }}
          />
        ) : storeState.appMode === 'design' ? (
          <main className="flex-1 relative overflow-hidden flex flex-col bg-[var(--bg-app)]">
            {storeState.isProjectOpen && (
              <>
                {isLeftNavOpen && <button type="button" aria-label="Close navigation" className="absolute inset-0 z-[175] bg-black/40 lg:hidden" onClick={() => setIsLeftNavOpen(false)} />}
                <button type="button" onClick={() => setIsLeftNavOpen(true)} className="absolute left-3 top-3 z-[170] flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--text-main)] shadow-lg lg:hidden" aria-label={t('workspace.navigation')}><Menu size={19} /></button>
                <aside className={cn(
                  "absolute inset-y-0 left-0 z-[180] flex w-[216px] flex-col border-r border-[var(--border-main)] bg-[var(--bg-panel)] transition-transform lg:translate-x-0",
                  isLeftNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
                )}>
                  <div className="border-b border-[var(--border-main)] px-4 py-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-500">{projectWorkspace === 'hardware' ? t('workspace.hardware') : t('workspace.firmware')}</span>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-highlight)]">{settings.name || t('header.projectName')}</p>
                  </div>
                  <nav className="flex-1 space-y-1 overflow-y-auto p-3 custom-scrollbar" aria-label={t('workspace.navigation')}>
                    {workflowItems.map(({ id, label, icon: Icon, active, complete, action }, index) => (
                      <button key={id} type="button" onClick={action} aria-current={active ? 'page' : undefined} className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                        active ? "bg-amber-500 text-zinc-950" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
                      )}>
                        <span className={cn("flex h-6 w-6 items-center justify-center rounded-md text-xs", active ? "bg-black/10" : "bg-[var(--bg-app)]")}>{index + 1}</span>
                        <Icon size={17} />
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className={cn(
                          "flex h-3 w-3 shrink-0 items-center justify-center rounded-full",
                          active && "bg-white/90 shadow-sm"
                        )}>
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            complete === true ? "bg-emerald-500" : complete === false ? "bg-amber-500" : "bg-[var(--text-dim)]/40"
                          )} />
                        </span>
                      </button>
                    ))}
                  </nav>
                  <button type="button" onClick={() => setIsHomeVisible(true)} className="m-3 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"><Home size={17} />{t('workspace.recentProjects')}</button>
                </aside>

                <button type="button" onClick={() => setIsInspectorOpen(true)} className="absolute right-3 top-3 z-[170] flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] text-[var(--text-main)] shadow-lg xl:hidden" aria-label={t('workspace.inspector')}><PanelRight size={19} /></button>
              </>
            )}
            {/* Canvas area stops above the bottom tray so centering and empty states use the visible workspace. */}
            <div
              className="workspace-canvas absolute inset-x-0 top-0 z-0 transition-all"
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
                  className={cn("workspace-inspector absolute top-0 right-0 z-[190] w-[360px] max-w-[88vw] bg-[var(--bg-panel)] border-l border-[var(--border-main)] overflow-visible flex transition-transform duration-200 xl:translate-x-0", isInspectorOpen ? "translate-x-0 shadow-2xl" : "max-xl:translate-x-full")}
                  style={{ bottom: 0 }}
                >
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
                    {activeRightPanel === 'settings' && (
                      <HardwareSettingsPanel scope={projectWorkspace} />
                    )}
                    {activeRightPanel === 'properties' && editorMode === 'layout' && <PropertyPanel />}
                    {activeRightPanel === 'matrixPainter' && editorMode === 'matrix' && (
                      <div className="h-full">
                        <MatrixPainter />
                      </div>
                    )}
                    {activeRightPanel === 'options' && <LayoutOptionsPanel />}
                    {activeRightPanel === 'keymap' && editorMode === 'keymap' && <KeycodeConfigPanel />}
                    {activeRightPanel === 'rgbMatrix' && editorMode === 'rgbMatrix' && <RgbMatrixPanel />}
                    {activeRightPanel === 'macros' && <MacroPanel scope="project" />}
                    {activeRightPanel === 'combos' && <ComboPanel scope="project" />}
                    {activeRightPanel === 'tapDance' && <TapDancePanel scope="project" />}
                    </div>
                  </div>
                </aside>

                  {/* Left Side Floating Widgets */}
                  <div className="workspace-tools absolute top-4 left-4 z-[100] flex flex-col gap-4">
                    <EditorTools floating />
                  </div>
                </>
                )}

              {/* Bottom Tray */}
              {storeState.isProjectOpen && editorMode === 'keymap' && (
                <div 
                  className={cn(
                    "workspace-bottom-tray absolute bottom-0 left-0 bg-[var(--bg-panel)] border-t border-[var(--border-main)] z-[150] flex flex-col overflow-hidden transition-all h-[400px]"
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

      {isPinSettingsDialogOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsPinSettingsDialogOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-settings-dialog-title"
            className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 p-4">
              <div className="flex items-center gap-3">
                <Hash size={18} className="text-amber-500" />
                <div>
                  <h2 id="pin-settings-dialog-title" className="text-sm font-bold text-[var(--text-highlight)]">{t('workspace.pins')}</h2>
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t('hardware.pinAssignHint')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinSettingsDialogOpen(false)}
                className="rounded p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-highlight)] active:scale-90"
                aria-label={t('common.cancel')}
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(92vh-73px)] min-h-0 max-h-[760px]">
              <MatrixPinInspectorPanel variant="dialog" />
            </div>
          </div>
        </div>
      )}

      {isKiCadDialogOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsKiCadDialogOpen(false)} />
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 p-4">
              <div className="flex items-center gap-3">
                <CircuitBoard size={18} className="text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-highlight)]">{t('kicad.title')}</h2>
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t('kicad.desc')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsKiCadDialogOpen(false)}
                className="rounded p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-highlight)] active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 custom-scrollbar">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(360px,1fr)]">
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t('kicad.switchFootprint')}
                    </span>
                    <select
                      value={kicadExportOptions.switchFootprint}
                      onChange={(e) => setKiCadExportOptions(options => ({ ...options, switchFootprint: e.target.value }))}
                      className="h-10 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 text-xs font-bold text-[var(--text-main)] outline-none focus:border-amber-500"
                    >
                      {KICAD_SWITCH_FOOTPRINTS.map(option => (
                        <option key={option.id} value={option.footprint}>
                          {option.label} - {option.footprint}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!isKiCadDirectPin && (
                    <>
                      <label className="block space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          {t('kicad.diodeFootprint')}
                        </span>
                        <select
                          value={kicadExportOptions.diodeFootprint}
                          onChange={(e) => setKiCadExportOptions(options => ({ ...options, diodeFootprint: e.target.value }))}
                          className="h-10 w-full rounded border border-[var(--border-main)] bg-[var(--bg-app)] px-3 text-xs font-bold text-[var(--text-main)] outline-none focus:border-amber-500"
                        >
                          {KICAD_DIODE_FOOTPRINTS.map(option => (
                            <option key={option.id} value={option.footprint}>
                              {option.label} - {option.footprint}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'diodeOffsetX' as const, label: t('kicad.diodeOffsetX'), suffix: 'mm' },
                        { key: 'diodeOffsetY' as const, label: t('kicad.diodeOffsetY'), suffix: 'mm' },
                        { key: 'diodeRotation' as const, label: t('kicad.diodeRotation'), suffix: 'deg' },
                      ].map(field => (
                        <label key={field.key} className="block space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {field.label}
                          </span>
                          <div className="flex h-10 items-center rounded border border-[var(--border-main)] bg-[var(--bg-app)] focus-within:border-amber-500">
                            <input
                              type="number"
                              step={field.key === 'diodeRotation' ? 15 : 0.1}
                              value={kicadExportOptions[field.key] ?? DEFAULT_KICAD_EXPORT_OPTIONS[field.key]}
                              onChange={(e) => updateKiCadNumberOption(field.key, e.target.value)}
                              className="min-w-0 flex-1 bg-transparent px-3 text-xs font-bold text-[var(--text-main)] outline-none"
                            />
                            <span className="shrink-0 px-2 text-[10px] font-bold uppercase text-[var(--text-dim)]">{field.suffix}</span>
                          </div>
                        </label>
                      ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex min-h-[360px] flex-col rounded border border-[var(--border-main)] bg-[var(--bg-app)] p-4">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('kicad.placementPreview')}
                  </div>
                  <svg viewBox="0 0 180 180" className="min-h-[320px] w-full flex-1 lg:min-h-[440px]">
                    <rect x="42" y="42" width="96" height="96" rx="4" fill="rgba(245, 158, 11, 0.06)" stroke="rgba(245, 158, 11, 0.65)" strokeWidth="2" />
                    <line x1="90" y1="34" x2="90" y2="146" stroke="rgba(148, 163, 184, 0.28)" strokeWidth="1" />
                    <line x1="34" y1="90" x2="146" y2="90" stroke="rgba(148, 163, 184, 0.28)" strokeWidth="1" />
                    <circle cx="90" cy="90" r="3" fill="rgb(245, 158, 11)" />
                    {renderKiCadFootprintPreview(switchPreviewTemplate, 'switch', 90, 90, switchPreviewBack ? 180 : 0, diodePreviewScale, switchPreviewBack)}
                    {!isKiCadDirectPin && renderKiCadFootprintPreview(diodePreviewTemplate, 'diode', diodePreviewX, diodePreviewY, diodePreviewRotation, diodePreviewScale, diodePreviewBack)}
                    {settings.features.rgbMatrix && renderKiCadFootprintPreview(
                      ledPreview.rgbTemplate,
                      'rgb-led',
                      ledPreviewX,
                      ledPreviewY,
                      180,
                      diodePreviewScale,
                      ledPreview.rgbBack
                    )}
                    {settings.features.backlight && renderKiCadFootprintPreview(
                      ledPreview.backlightTemplate,
                      'backlight-led',
                      ledPreviewX,
                      ledPreviewY,
                      ledPreview.backlightBack ? 180 : 0,
                      diodePreviewScale,
                      ledPreview.backlightBack
                    )}
                  </svg>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-[var(--border-main)] bg-[var(--bg-app)]/50 p-4">
              <button
                onClick={() => setIsKiCadDialogOpen(false)}
                className="rounded-md border border-[var(--border-main)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleExportKiCadZip}
                className="rounded-md bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:bg-amber-400 active:scale-95"
              >
                {t('kicad.export')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isZmkExportDialogOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsZmkExportDialogOpen(false)} />
          <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-[var(--border-main)] bg-[var(--bg-panel)] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-main)] bg-[var(--bg-app)]/50 p-4">
              <div className="flex items-center gap-3">
                <Cpu size={18} className="text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-highlight)]">{t('zmkExport.title')}</h2>
                  <p className="text-xs font-medium text-[var(--text-muted)]">{t('zmkExport.desc')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsZmkExportDialogOpen(false)}
                className="rounded p-2 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-highlight)] active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <button
                onClick={() => handleExportZmkZip(false)}
                className="group rounded-lg border border-[var(--border-main)] bg-[var(--bg-app)] p-4 text-left transition-all hover:border-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                <Download size={20} className="mb-3 text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-main)]" />
                <div className="text-xs font-bold text-[var(--text-highlight)]">{t('zmkExport.standard')}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{t('zmkExport.standardDesc')}</p>
              </button>

              <button
                onClick={() => handleExportZmkZip(true)}
                className="group rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-left transition-all hover:border-amber-400 hover:bg-amber-500/10"
              >
                <Sparkles size={20} className="mb-3 text-amber-500" />
                <div className="text-xs font-bold text-[var(--text-highlight)]">{t('zmkExport.studio')}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{t('zmkExport.studioDesc')}</p>
              </button>
            </div>

            <div className="border-t border-[var(--border-main)] bg-[var(--bg-app)]/50 px-4 py-3 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {t('zmkExport.unlockNote')}
            </div>
          </div>
        </div>
      )}

      {/* Hardware Setup Modal */}
      {storeState.isHardwareModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-all" onClick={cancelNewProject} />
          <div className="relative bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-main)] shrink-0 bg-[var(--bg-app)]/50">
              <div className="flex items-center gap-3">
                <Settings size={18} className="text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-highlight)]">{t('workspace.createProject')}</h2>
                  <p className="text-xs text-[var(--text-muted)] font-medium">{t('workspace.createProjectDescription')}</p>
                </div>
              </div>
              <button 
                onClick={cancelNewProject}
                className="p-2 hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-highlight)] rounded transition-all active:scale-90"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-panel)]">
              <NewProjectSetup preset={newProjectPreset} onPresetChange={setNewProjectPreset} />
            </div>
            
            <div className="p-4 border-t border-[var(--border-main)] bg-[var(--bg-app)]/50 flex justify-end shrink-0 gap-3">
              <button 
                onClick={confirmNewProject}
                className="min-h-11 px-6 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md text-sm font-bold transition-all shadow-lg shadow-amber-500/10 active:scale-95"
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
