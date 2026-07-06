'use client';

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle, Text, Path as KonvaPath } from 'react-konva';
import { getLocalMatrixPosition, getMatrixFromPins, getFirmwareMatrixPosition } from '@/lib/matrix-utils';
import { useKeyboardStore, RuntimeKey } from '@/lib/store';
import { PhysicalKey } from '@/types/keyboard';
import { UniversalAction } from '@/types/actions';
import { getSortPoint, sortKeys } from '@/lib/sorting';
import { keysIntersect } from '@/lib/collision';
import { useTranslation } from '@/hooks/useTranslation';
import { LayoutGrid, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { KeyComponent } from './canvas/KeyComponent';
import { GridComponent } from './canvas/GridComponent';
import { UNIT, num, round, roundCoord, roundRot, getVisualCenter, getKeyVertices, getKeyLabel, isLayoutMode, PADDING_X, PADDING_Y, clampZoom, ZOOM_STEP } from '@/lib/canvas-utils';

const ROTATE_ICON_PATH = "M3 2v6h6 M3 13a9 9 0 1 0 3-7.7L3 8";

const getRotatedWorldPoint = (k: PhysicalKey, x: number, y: number) => {
  const theta = (num(k.r) * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const dx = x - num(k.rx);
  const dy = y - num(k.ry);
  return {
    x: num(k.rx) + dx * cos - dy * sin,
    y: num(k.ry) + dx * sin + dy * cos
  };
};

export const KeyboardCanvas = ({ readonlyGeometry = false }: { readonlyGeometry?: boolean }) => {
  const { 
    keys, previewKeys, settings, editorSettings, selectedKeyIds, focusedKeyId, selectionAnchorId,
    transform, editorMode, currentLayer, appMode, remoteKeymap,
    matrixPaintMode, painter, mirrorCopyAxisMode,
    setSelectedKeyIds, toggleKeySelection, setFocusedKeyId, setSelectionAnchorId,
    batchUpdateKeys, removeKey, undo, redo, setTransform, paintKey,
    setPreviewKeys, commitPreviewKeys, copyKeys, pasteKeys,
    isProjectOpen, setIsHardwareModalOpen, resetProject,
    setCanvasDimensions,
    connectedDevice, currentProjectId,
    zmkLocked, isKeymapSyncing,
    setKeycode, updateDeviceKeycode,
    setMirrorCopyAxisMode, mirrorCopySelectedKeys
  } = useKeyboardStore();
  
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const stageRef = useRef<any>(null);
  const [selBox, setSelBox] = useState<{ start: { x: number, y: number }, end: { x: number, y: number }, isRealDrag: boolean } | null>(null);
  const [paintHintPos, setPaintHintPos] = useState<{ x: number; y: number } | null>(null);
  const [mirrorAxisPreviewX, setMirrorAxisPreviewX] = useState<number | null>(null);
  const [hoveredSortKeyId, setHoveredSortKeyId] = useState<string | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.style.cursor = mirrorCopyAxisMode || (appMode === 'design' && editorMode === 'matrix' && matrixPaintMode) ? 'crosshair' : 'default';
    }
  }, [appMode, editorMode, matrixPaintMode, mirrorCopyAxisMode]);
  const transformRef = useRef(transform);
  const touchGestureRef = useRef<{
    mode: 'pan' | 'pinch' | 'select';
    startCenter: { x: number; y: number };
    startWorld: { x: number; y: number };
    endWorld?: { x: number; y: number };
    startDistance?: number;
    startScale?: number;
    startTransform: typeof transform;
    hasMoved: boolean;
  } | null>(null);
  const keyDragRef = useRef<{
    draggedId: string;
    selectedIds: string[];
    startPointer: { x: number; y: number };
    initialKeys: RuntimeKey[];
  } | null>(null);

  const displayKeys = previewKeys || keys;
  const visKeys = useMemo(() => (displayKeys.filter(k => !k.group || (settings.activeOptions[k.group] ?? 0) === k.option)) as RuntimeKey[], [displayKeys, settings.activeOptions]);
  const sortDebugInfo = useMemo(() => {
    if (!editorSettings.debugMode) return new Map<string, { index: number; x: number; y: number }>();
    return new Map(sortKeys(visKeys, editorSettings.sortThresholdY).map((key, index) => {
      const point = getSortPoint(key);
      return [key.id, { index, x: point.x, y: point.y }];
    }));
  }, [editorSettings.debugMode, editorSettings.sortThresholdY, visKeys]);
  const hoveredSortKey = useMemo(() => (
    hoveredSortKeyId ? visKeys.find(key => key.id === hoveredSortKeyId) : undefined
  ), [hoveredSortKeyId, visKeys]);
  const hoveredSortInfo = hoveredSortKeyId ? sortDebugInfo.get(hoveredSortKeyId) : undefined;

  const focusedKey = useMemo(() => visKeys.find(k => k.id === focusedKeyId), [visKeys, focusedKeyId]);

  const isMatrixPaintEvent = useCallback((e: any) => {
    if (readonlyGeometry || appMode !== 'design') return false;
    if (editorMode !== 'matrix' || !matrixPaintMode) return false;
    const evt = e.evt;
    return !(evt?.ctrlKey || evt?.metaKey || evt?.shiftKey || evt?.altKey);
  }, [appMode, editorMode, matrixPaintMode, readonlyGeometry]);

  const handleMatrixPaintClick = useCallback((e: any, key: RuntimeKey) => {
    if (!isMatrixPaintEvent(e)) return false;
    e.cancelBubble = true;
    paintKey(key.id);
    setSelectedKeyIds([key.id]);
    setFocusedKeyId(key.id);
    setSelectionAnchorId(key.id);
    return true;
  }, [isMatrixPaintEvent, paintKey, setFocusedKeyId, setSelectedKeyIds, setSelectionAnchorId]);

  const updatePaintHintPosition = useCallback((e: any) => {
    if (readonlyGeometry || appMode !== 'design' || editorMode !== 'matrix' || !matrixPaintMode) return;
    const stage = e.target?.getStage?.();
    const pointer = stage?.getPointerPosition?.();
    if (!pointer) return;
    setPaintHintPos({ x: pointer.x, y: pointer.y });
  }, [appMode, editorMode, matrixPaintMode, readonlyGeometry]);

  useEffect(() => {
    if (readonlyGeometry || appMode !== 'design' || editorMode !== 'matrix' || !matrixPaintMode) {
      setPaintHintPos(null);
    }
  }, [appMode, editorMode, matrixPaintMode, readonlyGeometry]);

  useEffect(() => {
    if (!mirrorCopyAxisMode || readonlyGeometry || appMode !== 'design' || editorMode !== 'layout' || selectedKeyIds.length < 2) {
      setMirrorAxisPreviewX(null);
      if (mirrorCopyAxisMode) setMirrorCopyAxisMode(false);
    }
  }, [appMode, editorMode, mirrorCopyAxisMode, readonlyGeometry, selectedKeyIds.length, setMirrorCopyAxisMode]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => { 
    setIsClient(true);
    const updateSize = () => {
      const container = containerRef.current;
      let nextDimensions: { width: number, height: number };

      if (container) {
        nextDimensions = { width: container.clientWidth, height: container.clientHeight };
      } else {
        nextDimensions = { width: window.innerWidth, height: window.innerHeight };
      }

      const prevDimensions = dimensionsRef.current;
      if (
        prevDimensions.width > 0 &&
        prevDimensions.height > 0 &&
        nextDimensions.width > 0 &&
        nextDimensions.height > 0 &&
        prevDimensions.width !== nextDimensions.width
      ) {
        const currentTransform = useKeyboardStore.getState().transform;
        setTransform({
          ...currentTransform,
          x: currentTransform.x + (nextDimensions.width - prevDimensions.width) / 2,
          y: currentTransform.y
        });
      }

      dimensionsRef.current = nextDimensions;
      setDimensions(nextDimensions);
      setCanvasDimensions(nextDimensions);
    };
    updateSize();

    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateSize);
    };
  }, [setCanvasDimensions, setTransform]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        if (mirrorCopyAxisMode) {
          e.preventDefault();
          setMirrorCopyAxisMode(false);
          return;
        }
        setSelectedKeyIds([]);
        setFocusedKeyId(null);
        setSelectionAnchorId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedKeyIds.length > 0) {
          if (editorMode === 'keymap' || appMode === 'remap') {
            e.preventDefault();
            const targetAction: UniversalAction = { action: 'none' };
            selectedKeyIds.forEach(id => {
              const selectedKey = keys.find(k => k.id === id);
              if (!selectedKey) return;
              if (appMode === 'remap') {
                const selectedFirmwarePosition = getFirmwareMatrixPosition(settings, selectedKey, keys);
                if (selectedKey.zmkPosition !== undefined) {
                  updateDeviceKeycode(currentLayer, selectedKey.zmkPosition, -1, targetAction);
                } else if (selectedFirmwarePosition) {
                  updateDeviceKeycode(currentLayer, selectedFirmwarePosition.row, selectedFirmwarePosition.col, targetAction);
                }
              } else {
                setKeycode(id, currentLayer, targetAction);
              }
            });
          } else if (!readonlyGeometry) {
            e.preventDefault();
            selectedKeyIds.forEach(id => removeKey(id));
            setSelectedKeyIds([]);
            setFocusedKeyId(null);
          }
        }
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const allIds = visKeys.map(k => k.id);
        setSelectedKeyIds(allIds);
        if (allIds.length > 0 && !focusedKeyId) {
          setFocusedKeyId(allIds[0]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (!readonlyGeometry && appMode !== 'remap') {
          e.preventDefault();
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (!readonlyGeometry && appMode !== 'remap') {
          e.preventDefault();
          redo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        copyKeys();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteKeys();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedKeyIds.length > 0 && !readonlyGeometry) {
          e.preventDefault();
          const snap = editorSettings.gridSnap;
          let dx = 0, dy = 0;
          if (e.key === 'ArrowUp') dy = -snap;
          if (e.key === 'ArrowDown') dy = snap;
          if (e.key === 'ArrowLeft') dx = -snap;
          if (e.key === 'ArrowRight') dx = snap;

          batchUpdateKeys(selectedKeyIds, (k) => ({
            x: roundCoord(num(k.x) + dx),
            y: roundCoord(num(k.y) + dy),
            ...(editorSettings.syncOrigin ? {
              rx: roundCoord(num(k.rx) + dx),
              ry: roundCoord(num(k.ry) + dy)
            } : {})
          }), true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [setSelectedKeyIds, setFocusedKeyId, setSelectionAnchorId, selectedKeyIds, removeKey, visKeys, focusedKeyId, undo, redo, copyKeys, pasteKeys, editorSettings.gridSnap, editorSettings.syncOrigin, batchUpdateKeys, readonlyGeometry, appMode, mirrorCopyAxisMode, setMirrorCopyAxisMode]);

  const lastCenteredRef = useRef<{ deviceId: string | null, projectId: string | null, width: number }>({ deviceId: null, projectId: null, width: 0 });

  useEffect(() => {
    const state = useKeyboardStore.getState();
    const currentKeys = state.keys;
    const container = containerRef.current;

    // Create unique identifiers for the current context
    const currentDeviceId = connectedDevice ? `${connectedDevice.vid}-${connectedDevice.pid}` : null;
    const currentProjId = currentProjectId;

    // Only attempt centering if we have an active context AND the layout geometry has been loaded
    if ((currentDeviceId || currentProjId) && currentKeys.length > 0) {
      const currentWidth = container?.clientWidth || dimensions.width;
      const needsCenterForDevice = currentDeviceId && currentDeviceId !== lastCenteredRef.current.deviceId;
      const needsCenterForProject = currentProjId && currentProjId !== lastCenteredRef.current.projectId;
      const needsCenterForWidth = currentWidth > 0 && currentWidth !== lastCenteredRef.current.width;

      if (needsCenterForDevice || needsCenterForProject || needsCenterForWidth) {
        if (container) {
          // Read synchronous dimensions from the DOM element.
          // Since the canvas is now a full-screen absolute overlay, we mathematically offset
          // the visual center to account for UI panels floating on top (e.g., KeycodePanel).
          const w = currentWidth;
          const h = container.clientHeight;

          if (w > 0 && h > 0) {
            const activeVisKeys = currentKeys.filter(k => !k.group || (state.settings.activeOptions[k.group] ?? 0) === k.option);
            
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            activeVisKeys.forEach(k => {
              const vertices = getKeyVertices(k);
              vertices.forEach(v => {
                if (v.x < minX) minX = v.x;
                if (v.x > maxX) maxX = v.x;
                if (v.y < minY) minY = v.y;
                if (v.y > maxY) maxY = v.y;
              });
            });

            if (activeVisKeys.length > 0) {
              const keyboardWidth = maxX - minX;
              const keyboardCenterX = minX + keyboardWidth / 2;

              // Center horizontally, but fix vertically to exactly the same initial coordinate (resetY = 0)
              const resetX = w / 2 - PADDING_X - keyboardCenterX;
              const resetY = 0;

              state.setTransform({ scale: 1, x: resetX, y: resetY });
            }

            // Mark this specific context as successfully centered so it doesn't run on every edit
            lastCenteredRef.current = { deviceId: currentDeviceId, projectId: currentProjId, width: w };
          }
        }
      }
    } else if (!currentDeviceId && !currentProjId) {
      // Reset memory when disconnected so it can fire again upon next connection
      lastCenteredRef.current = { deviceId: null, projectId: null, width: 0 };
    }
  }, [connectedDevice, currentProjectId, dimensions.width, keys.length]);

  const collidingIds = useMemo(() => {
    if (editorMode !== 'layout' || readonlyGeometry) return [];
    const ids = new Set<string>();
    for (let i = 0; i < visKeys.length; i++) {
      for (let j = i + 1; j < visKeys.length; j++) {
        if (keysIntersect(visKeys[i], visKeys[j])) {
          ids.add(visKeys[i].id);
          ids.add(visKeys[j].id);
        }
      }
    }
    return Array.from(ids);
  }, [visKeys, editorMode, readonlyGeometry]);

  const invalidMatrixIds = useMemo(() => {
    if (editorMode !== 'matrix' || readonlyGeometry) return [];
    const matrix = getMatrixFromPins(settings.pins, settings.features.split) || settings.matrix;
    const rowCount = matrix.rows;
    const colCount = matrix.cols;
    return visKeys
      .filter(key => {
        const local = getLocalMatrixPosition(settings, key, visKeys);
        return !!local && (local.row >= rowCount || local.col >= colCount);
      })
      .map(key => key.id);
  }, [visKeys, editorMode, readonlyGeometry, settings.features.split, settings.matrix, settings.pins]);

  const warningKeyIds = useMemo(
    () => Array.from(new Set([...collidingIds, ...invalidMatrixIds])),
    [collidingIds, invalidMatrixIds]
  );

  // Zoom handling
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = clampZoom(oldScale + (e.evt.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP));
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    setTransform({ scale: newScale, x: newPos.x - PADDING_X, y: newPos.y - PADDING_Y });
  };

  const getMirrorAxisFromEvent = useCallback((e: any) => {
    const stage = e.target?.getStage?.() || stageRef.current;
    const pointer = stage?.getPointerPosition?.();
    if (!pointer) return null;
    const axisX = ((pointer.x - stage.x()) / stage.scaleX()) / UNIT;
    return e.evt?.altKey
      ? roundCoord(axisX)
      : roundCoord(Math.round(axisX / editorSettings.gridSnap) * editorSettings.gridSnap);
  }, [editorSettings.gridSnap]);

  const updateMirrorAxisPreview = useCallback((e: any) => {
    if (!mirrorCopyAxisMode) return;
    const axisX = getMirrorAxisFromEvent(e);
    if (axisX === null) return;
    setMirrorAxisPreviewX(axisX);
  }, [getMirrorAxisFromEvent, mirrorCopyAxisMode]);

  const handleMirrorAxisClick = useCallback((e: any) => {
    if (!mirrorCopyAxisMode) return false;
    if (e.evt?.button !== undefined && e.evt.button !== 0) return true;
    e.evt?.preventDefault?.();
    e.cancelBubble = true;
    const axisX = getMirrorAxisFromEvent(e);
    if (axisX === null) return true;
    mirrorCopySelectedKeys(axisX);
    setMirrorAxisPreviewX(null);
    return true;
  }, [getMirrorAxisFromEvent, mirrorCopyAxisMode, mirrorCopySelectedKeys]);

  const handleStageMouseDown = (e: any) => {
    if (handleMirrorAxisClick(e)) return;

    if (e.evt.button === 1) { // Middle click for pan
      const initialPos = { x: transform.x, y: transform.y };
      const startX = e.evt.clientX, startY = e.evt.clientY;
      const onMouseMove = (me: MouseEvent) => {
        setTransform({ ...transform, x: initialPos.x + (me.clientX - startX), y: initialPos.y + (me.clientY - startY) });
      };
      const onMouseUp = () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
      window.addEventListener('mousemove', onMouseMove); window.addEventListener('mouseup', onMouseUp);
      return;
    }

    if (e.target === e.target.getStage()) {
      const pos = e.target.getRelativePointerPosition();
      // Just record start position, don't clear selection yet
      setSelBox({ start: pos, end: pos, isRealDrag: false });
    }
  };

  const handleStageMouseMove = (e: any) => {
    updateMirrorAxisPreview(e);
    updatePaintHintPosition(e);
    if (!selBox) return;
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    
    const dx = pos.x - selBox.start.x;
    const dy = pos.y - selBox.start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (!selBox.isRealDrag && distance > 3) {
      // Drag started! If no modifiers, clear selection now
      const isM = e.evt.ctrlKey || e.evt.metaKey;
      const isS = e.evt.shiftKey;
      if (!isM && !isS) {
        setSelectedKeyIds([]);
      }
      setSelBox({ ...selBox, end: pos, isRealDrag: true });
    } else if (selBox.isRealDrag) {
      setSelBox({ ...selBox, end: pos });
    }
  };

  const handleStageMouseUp = (e: any) => {
    if (selBox) {
      if (selBox.isRealDrag) {
        const isM = e.evt.ctrlKey || e.evt.metaKey;
        const isS = e.evt.shiftKey;
        const bX1 = Math.min(selBox.start.x, selBox.end.x);
        const bY1 = Math.min(selBox.start.y, selBox.end.y);
        const bX2 = Math.max(selBox.start.x, selBox.end.x);
        const bY2 = Math.max(selBox.start.y, selBox.end.y);

        const newIds = visKeys.filter(k => {
          const vertices = getKeyVertices(k);
          return vertices.every(v => v.x >= bX1 && v.x <= bX2 && v.y >= bY1 && v.y <= bY2);
        }).map(k => k.id);

        if (isM || isS) {
          const merged = [...new Set([...selectedKeyIds, ...newIds])];
          setSelectedKeyIds(merged);
          // Keep current focus if it exists
          if (newIds.length > 0 && !focusedKeyId) {
            setFocusedKeyId(newIds[0]);
          }
        } else {
          setSelectedKeyIds(newIds);
          // Keep current focus if it exists
          if (newIds.length > 0 && !focusedKeyId) {
            setFocusedKeyId(newIds[0]);
          }
        }
      } else {
        // Simple click on background
        const isM = e.evt.ctrlKey || e.evt.metaKey;
        const isS = e.evt.shiftKey;
        if (!isM && !isS) {
          setSelectedKeyIds([]);
        }
      }
      setSelBox(null);
    }
  };

  const getTouchPoint = (touch: Touch) => {
    const container = stageRef.current?.container();
    const rect = container?.getBoundingClientRect();
    return {
      x: touch.clientX - (rect?.left ?? 0),
      y: touch.clientY - (rect?.top ?? 0)
    };
  };

  const getTouchCenter = (touches: TouchList) => {
    const a = getTouchPoint(touches[0]);
    if (touches.length < 2) return a;
    const b = getTouchPoint(touches[1]);
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const a = getTouchPoint(touches[0]);
    const b = getTouchPoint(touches[1]);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const screenToStagePoint = (point: { x: number; y: number }, sourceTransform = transformRef.current) => ({
    x: (point.x - (sourceTransform.x + PADDING_X)) / sourceTransform.scale,
    y: (point.y - (sourceTransform.y + PADDING_Y)) / sourceTransform.scale
  });

  const applySelectionBox = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const bX1 = Math.min(start.x, end.x);
    const bY1 = Math.min(start.y, end.y);
    const bX2 = Math.max(start.x, end.x);
    const bY2 = Math.max(start.y, end.y);

    const newIds = visKeys.filter(k => {
      const vertices = getKeyVertices(k);
      return vertices.every(v => v.x >= bX1 && v.x <= bX2 && v.y >= bY1 && v.y <= bY2);
    }).map(k => k.id);

    setSelectedKeyIds(newIds);
    if (newIds.length > 0 && !focusedKeyId) {
      setFocusedKeyId(newIds[0]);
    }
  };

  const handleStageTouchStart = (e: any) => {
    const touches = e.evt.touches as TouchList;
    if (!stageRef.current || touches.length === 0) return;

    if (touches.length >= 2) {
      e.evt.preventDefault();
      const center = getTouchCenter(touches);
      touchGestureRef.current = {
        mode: 'pinch',
        startCenter: center,
        startWorld: screenToStagePoint(center),
        startDistance: getTouchDistance(touches),
        startScale: transformRef.current.scale,
        startTransform: transformRef.current,
        hasMoved: false
      };
      setSelBox(null);
      return;
    }

    const point = getTouchPoint(touches[0]);
    const targetIsStage = e.target === e.target.getStage();
    const shouldPan = readonlyGeometry || appMode === 'remap' || editorMode !== 'layout';

    if (shouldPan || targetIsStage) {
      const worldPoint = screenToStagePoint(point);
      touchGestureRef.current = {
        mode: shouldPan ? 'pan' : 'select',
        startCenter: point,
        startWorld: worldPoint,
        endWorld: worldPoint,
        startTransform: transformRef.current,
        hasMoved: false
      };
    }
  };

  const handleStageTouchMove = (e: any) => {
    const gesture = touchGestureRef.current;
    const touches = e.evt.touches as TouchList;
    if (!gesture || touches.length === 0) return;

    if (touches.length >= 2) {
      e.evt.preventDefault();
      const center = getTouchCenter(touches);
      const distance = getTouchDistance(touches);
      if (gesture.mode !== 'pinch') {
        touchGestureRef.current = {
          mode: 'pinch',
          startCenter: center,
          startWorld: screenToStagePoint(center),
          startDistance: distance,
          startScale: transformRef.current.scale,
          startTransform: transformRef.current,
          hasMoved: false
        };
        setSelBox(null);
        return;
      }
      const startDistance = gesture.startDistance || distance || 1;
      const startScale = gesture.startScale || gesture.startTransform.scale;
      const newScale = clampZoom(startScale * (distance / startDistance));
      const newTransform = {
        scale: newScale,
        x: center.x - gesture.startWorld.x * newScale - PADDING_X,
        y: center.y - gesture.startWorld.y * newScale - PADDING_Y
      };
      touchGestureRef.current = {
        ...gesture,
        mode: 'pinch',
        hasMoved: true
      };
      setSelBox(null);
      setTransform(newTransform);
      return;
    }

    if (gesture.mode === 'pan') {
      e.evt.preventDefault();
      const point = getTouchPoint(touches[0]);
      const dx = point.x - gesture.startCenter.x;
      const dy = point.y - gesture.startCenter.y;
      touchGestureRef.current = {
        ...gesture,
        hasMoved: gesture.hasMoved || Math.hypot(dx, dy) > 3
      };
      setTransform({
        ...gesture.startTransform,
        x: gesture.startTransform.x + dx,
        y: gesture.startTransform.y + dy
      });
      return;
    }

    if (gesture.mode === 'select') {
      e.evt.preventDefault();
      const endWorld = screenToStagePoint(getTouchPoint(touches[0]));
      const dx = endWorld.x - gesture.startWorld.x;
      const dy = endWorld.y - gesture.startWorld.y;
      const hasMoved = gesture.hasMoved || Math.hypot(dx, dy) > 3;
      touchGestureRef.current = { ...gesture, endWorld, hasMoved };

      if (hasMoved) {
        if (!gesture.hasMoved) {
          setSelectedKeyIds([]);
        }
        setSelBox({ start: gesture.startWorld, end: endWorld, isRealDrag: true });
      }
    }
  };

  const handleStageTouchEnd = () => {
    const gesture = touchGestureRef.current;
    if (!gesture) return;

    if (gesture.mode === 'select') {
      if (gesture.hasMoved && gesture.endWorld) {
        applySelectionBox(gesture.startWorld, gesture.endWorld);
      } else {
        setSelectedKeyIds([]);
      }
      setSelBox(null);
    }

    touchGestureRef.current = null;
  };

  const handleKeyDragMove = (e: any, id: string) => {
    if (readonlyGeometry) return;
    const stage = e.target.getStage?.();
    const pointer = stage?.getRelativePointerPosition?.();
    const dragState = keyDragRef.current;
    if (!pointer || !dragState || dragState.draggedId !== id) return;

    const draggedInitialKey = dragState.initialKeys.find(k => k.id === id);
    if (!draggedInitialKey) return;
    
    const rawDX = (pointer.x - dragState.startPointer.x) / UNIT;
    const rawDY = (pointer.y - dragState.startPointer.y) / UNIT;
    const snapAnchor = editorSettings.syncOrigin
      ? { x: num(draggedInitialKey.rx), y: num(draggedInitialKey.ry) }
      : getRotatedWorldPoint(draggedInitialKey, num(draggedInitialKey.x), num(draggedInitialKey.y));
    
    const targetAnchorX = snapAnchor.x + rawDX;
    const targetAnchorY = snapAnchor.y + rawDY;
    const snappedAnchorX = e.evt.altKey ? targetAnchorX : Math.round(targetAnchorX / editorSettings.gridSnap) * editorSettings.gridSnap;
    const snappedAnchorY = e.evt.altKey ? targetAnchorY : Math.round(targetAnchorY / editorSettings.gridSnap) * editorSettings.gridSnap;

    const dX = snappedAnchorX - snapAnchor.x;
    const dY = snappedAnchorY - snapAnchor.y;

    const nextNodeX = editorSettings.syncOrigin ? num(draggedInitialKey.rx) + dX : num(draggedInitialKey.rx);
    const nextNodeY = editorSettings.syncOrigin ? num(draggedInitialKey.ry) + dY : num(draggedInitialKey.ry);
    e.target.x(nextNodeX * UNIT);
    e.target.y(nextNodeY * UNIT);

    const updatedKeys = displayKeys.map(k => {
      if (!dragState.selectedIds.includes(k.id)) return k;
      const initialKey = dragState.initialKeys.find(initial => initial.id === k.id);
      if (!initialKey) return k;
      const theta = (num(initialKey.r) * Math.PI) / 180;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const localDX = editorSettings.syncOrigin ? dX : dX * cos + dY * sin;
      const localDY = editorSettings.syncOrigin ? dY : -dX * sin + dY * cos;
      return {
        ...k,
        x: roundCoord(num(initialKey.x) + localDX),
        y: roundCoord(num(initialKey.y) + localDY),
        ...(editorSettings.syncOrigin ? {
          rx: roundCoord(num(initialKey.rx) + dX),
          ry: roundCoord(num(initialKey.ry) + dY)
        } : {})
      };
    });

    setPreviewKeys(updatedKeys);
  };

  const handleRotationStart = (e: any) => {
    if (readonlyGeometry || !focusedKey || !stageRef.current) return;
    e.cancelBubble = true;
    
    const stage = stageRef.current;
    const pivot = { x: num(focusedKey.rx) * UNIT, y: num(focusedKey.ry) * UNIT };
    const startPos = stage.getRelativePointerPosition();
    if (!startPos) return;

    const startMouseAngle = Math.atan2(startPos.y - pivot.y, startPos.x - pivot.x);
    const startKeyAngle = num(focusedKey.r);
    const initialStates = visKeys.filter(k => selectedKeyIds.includes(k.id)).map(k => ({ ...k }));

    const updateRotation = (pos: { x: number; y: number } | null, freeRotate = false) => {
      if (!pos) return;
      const container = stage.container();
      container.style.cursor = 'crosshair';

      const currentMouseAngle = Math.atan2(pos.y - pivot.y, pos.x - pivot.x);
      let deltaAngle = ((currentMouseAngle - startMouseAngle) * 180) / Math.PI;
      
      const nR = freeRotate ? roundRot(startKeyAngle + deltaAngle) : Math.round((startKeyAngle + deltaAngle) / 15) * 15;
      const finalDeltaR = nR - startKeyAngle;

      const updatedKeys = displayKeys.map(k => {
        if (!selectedKeyIds.includes(k.id)) return k;
        const init = initialStates.find(s => s.id === k.id);
        if (!init) return k;

        // 1. Calculate current world position of this key center
        const initR = num(init.r), initX = num(init.x), initY = num(init.y), initRX = num(init.rx), initRY = num(init.ry);
        const theta = (initR * Math.PI) / 180, cos = Math.cos(theta), sin = Math.sin(theta);
        const dx = initX - initRX, dy = initY - initRY;
        const worldX = initRX + dx * cos - dy * sin;
        const worldY = initRY + dx * sin + dy * cos;

        // 2. Target Group Pivot (from focusedKey)
        const groupRX = num(focusedKey.rx), groupRY = num(focusedKey.ry);

        // 3. Vector from group pivot to world position
        const vW = { x: worldX - groupRX, y: worldY - groupRY };
        
        // 4. Rotate this vector by the delta rotation
        const dRad = (finalDeltaR * Math.PI) / 180, dCos = Math.cos(dRad), dSin = Math.sin(dRad);
        const vW_new = {
          x: vW.x * dCos - vW.y * dSin,
          y: vW.x * dSin + vW.y * dCos
        };

        // 5. Calculate new angle and local coordinates based on shared group pivot
        const nR = roundRot(initR + finalDeltaR);
        const nTheta = (nR * Math.PI) / 180, nCos = Math.cos(nTheta), nSin = Math.sin(nTheta);

        // Reverse rotation to find new local (x, y) relative to the shared group pivot
        const dx_new = vW_new.x * nCos + vW_new.y * nSin;
        const dy_new = -vW_new.x * nSin + vW_new.y * nCos;

        return {
          ...k,
          r: nR,
          rx: roundCoord(groupRX),
          ry: roundCoord(groupRY),
          x: roundCoord(groupRX + dx_new),
          y: roundCoord(groupRY + dy_new)
        };
      });
      setPreviewKeys(updatedKeys);
    };

    const onMouseMove = (me: MouseEvent) => {
      updateRotation(stage.getRelativePointerPosition(), me.altKey);
    };

    const onTouchMove = (te: TouchEvent) => {
      te.preventDefault();
      const touch = te.touches[0];
      if (!touch) return;
      const rect = stage.container().getBoundingClientRect();
      const point = {
        x: (touch.clientX - rect.left - stage.x()) / stage.scaleX(),
        y: (touch.clientY - rect.top - stage.y()) / stage.scaleY()
      };
      updateRotation(point, false);
    };

    const onMouseUp = (event: MouseEvent | TouchEvent) => {
      const container = stageRef.current ? stageRef.current.container() : document.body;
      container.style.cursor = 'default';
      if (event instanceof MouseEvent) {
        updateRotation(stage.getRelativePointerPosition(), event.altKey);
      } else {
        const touch = event.changedTouches[0];
        if (touch) {
          const rect = stage.container().getBoundingClientRect();
          updateRotation({
            x: (touch.clientX - rect.left - stage.x()) / stage.scaleX(),
            y: (touch.clientY - rect.top - stage.y()) / stage.scaleY()
          }, false);
        }
      }
      commitPreviewKeys();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
      window.removeEventListener('touchcancel', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);
    window.addEventListener('touchcancel', onMouseUp);
  };

  const handlePivotDragMove = (e: any, k: PhysicalKey) => {
    if (readonlyGeometry) return;
    const nRX = e.target.x() / UNIT;
    const nRY = e.target.y() / UNIT;
    const freeMove = e.evt?.altKey === true;
    const snappedRX = freeMove ? nRX : Math.round(nRX / editorSettings.gridSnap) * editorSettings.gridSnap;
    const snappedRY = freeMove ? nRY : Math.round(nRY / editorSettings.gridSnap) * editorSettings.gridSnap;

    // Force the visual node to snap
    e.target.x(snappedRX * UNIT);
    e.target.y(snappedRY * UNIT);

    const updatedKeys = displayKeys.map(key => {
      if (!selectedKeyIds.includes(key.id)) return key;
      const updates: any = { rx: roundCoord(snappedRX), ry: roundCoord(snappedRY) };
      if (editorSettings.keepPosOnOriginChange) {
        const theta = (num(key.r) * Math.PI) / 180, cos = Math.cos(theta), sin = Math.sin(theta);
        const worldX = num(key.rx) + (num(key.x) - num(key.rx)) * cos - (num(key.y) - num(key.ry)) * sin;
        const worldY = num(key.ry) + (num(key.x) - num(key.rx)) * sin + (num(key.y) - num(key.ry)) * cos;
        const dxW = worldX - snappedRX, dyW = worldY - snappedRY;
        updates.x = roundCoord(snappedRX + dxW * cos + dyW * sin);
        updates.y = roundCoord(snappedRY - dxW * sin + dyW * cos);
      }
      return { ...key, ...updates };
    });
    setPreviewKeys(updatedKeys);
  };

  if (!isClient) return null;

  return (
    <div
      ref={containerRef}
      id="keyboard-canvas-container"
      className="absolute inset-0 overflow-hidden bg-[var(--bg-app)] cursor-default select-none touch-none"
      onMouseLeave={() => setPaintHintPos(null)}
    >
      <Stage
        width={dimensions.width} height={dimensions.height} ref={stageRef}
        x={transform.x + PADDING_X} y={transform.y + PADDING_Y} scaleX={transform.scale} scaleY={transform.scale}
        onWheel={handleWheel} onMouseDown={handleStageMouseDown} onMouseMove={handleStageMouseMove} onMouseUp={handleStageMouseUp}
        onTouchStart={handleStageTouchStart} onTouchMove={handleStageTouchMove} onTouchEnd={handleStageTouchEnd}
      >
        <Layer>
          {isLayoutMode(appMode, editorMode) && (
            <GridComponent 
              width={dimensions.width} height={dimensions.height} gridSnap={editorSettings.gridSnap}
              scale={transform.scale} offsetX={transform.x + PADDING_X} offsetY={transform.y + PADDING_Y} visible={editorSettings.gridVisible}
            />
          )}
        </Layer>

        <Layer>
          {/* Layer 1: Key Body (Below Wiring) */}
          {visKeys.map(key => (
            <KeyComponent
              key={`${key.id}-body`} id={key.id} keyData={key}
              isSelected={selectedKeyIds.includes(key.id)} isFocused={focusedKeyId === key.id} isColliding={warningKeyIds.includes(key.id)}
              editorMode={editorMode} appMode={appMode} label={getKeyLabel(key, editorMode, currentLayer, appMode, remoteKeymap, settings.visualLayout, settings, visKeys)}
              showLabel={false} draggable={!readonlyGeometry && appMode === 'design'}
              onMouseEnter={() => {
                if (editorSettings.debugMode) setHoveredSortKeyId(key.id);
              }}
              onMouseLeave={() => setHoveredSortKeyId(null)}
              onDragStart={(e) => {
                if (readonlyGeometry || appMode !== 'design') return;
                const nextSelectedIds = selectedKeyIds.includes(key.id) ? selectedKeyIds : [key.id];
                const pointer = e.target.getStage?.()?.getRelativePointerPosition?.();
                if (pointer) {
                  keyDragRef.current = {
                    draggedId: key.id,
                    selectedIds: nextSelectedIds,
                    startPointer: pointer,
                    initialKeys: displayKeys.filter(k => nextSelectedIds.includes(k.id)) as RuntimeKey[]
                  };
                }
                setSelectedKeyIds(nextSelectedIds);
              }}
              onDragMove={(e) => {
                if (readonlyGeometry || appMode !== 'design') return;
                handleKeyDragMove(e, key.id);
              }} 
              onDragEnd={(e) => {
                if (readonlyGeometry || appMode !== 'design') return;
                handleKeyDragMove(e, key.id);
                commitPreviewKeys();
                keyDragRef.current = null;
              }}
              onMouseDown={(e) => {
                if (mirrorCopyAxisMode) return;
                if (e.evt && e.evt.button !== 0) return;
                if (isMatrixPaintEvent(e)) {
                  e.cancelBubble = true;
                  return;
                }
                const isM = e.evt.ctrlKey || e.evt.metaKey;
                const isS = e.evt.shiftKey;
                const isA = e.evt.altKey;
                if (isA) {
                  setFocusedKeyId(key.id);
                  setSelectionAnchorId(key.id);
                  return;
                }
                if (isS && (selectionAnchorId || focusedKeyId)) {
                  const anchor = selectionAnchorId || focusedKeyId;
                  const sortedKeys = sortKeys(visKeys, editorSettings.sortThresholdY);
                  const idx1 = sortedKeys.findIndex(k => k.id === anchor);
                  const idx2 = sortedKeys.findIndex(k => k.id === key.id);
                  const start = Math.min(idx1, idx2);
                  const end = Math.max(idx1, idx2);
                  const rangeIds = sortedKeys.slice(start, end + 1).map(k => k.id as string);
                  if (isM) {
                    setSelectedKeyIds([...new Set([...selectedKeyIds, ...rangeIds])]);
                  } else {
                    setSelectedKeyIds(rangeIds);
                  }
                  setFocusedKeyId(key.id);
                } else if (isM) {
                  toggleKeySelection(key.id, true);
                } else {
                  if (!selectedKeyIds.includes(key.id)) {
                    setSelectedKeyIds([key.id]);
                    setFocusedKeyId(key.id);
                    setSelectionAnchorId(key.id);
                  }
                }
              }}
              onMouseMove={(e) => {
                updateMirrorAxisPreview(e);
                updatePaintHintPosition(e);
              }}
              onClick={(e) => {
                if (mirrorCopyAxisMode) return;
                if (handleMatrixPaintClick(e, key)) return;
                const isM = e.evt.ctrlKey || e.evt.metaKey;
                const isS = e.evt.shiftKey;
                const isA = e.evt.altKey;
                if (!isM && !isS && !isA) {
                  setSelectedKeyIds([key.id]);
                  setFocusedKeyId(key.id);
                  setSelectionAnchorId(key.id);
                }
              }}
            />
          ))}

          {/* Layer 2: Matrix Lines (In middle) */}
          {appMode === 'design' && editorMode === 'matrix' && editorSettings.showMatrixLines && !readonlyGeometry && (
            <Group listening={false}>
              {(() => {
                const rowLines: { id: string, points: number[], side: 'left' | 'right' }[] = [];
                const colLines: { id: string, points: number[], side: 'left' | 'right' }[] = [];
                
                const rows: Record<string, { key: PhysicalKey, center: { x: number, y: number }, side: 'left' | 'right' }[]> = {};
                const cols: Record<string, { key: PhysicalKey, center: { x: number, y: number }, side: 'left' | 'right' }[]> = {};
                
                visKeys.forEach(key => {
                  if (key.row === undefined || key.col === undefined) return;
                  const side = settings.features.split && key.matrixSide === 'right' ? 'right' : 'left';
                  
                  const center = getVisualCenter(key);
                  const centerPx = { x: center.x, y: center.y };
                  const rowKey = `${side}-${key.row}`;
                  const colKey = `${side}-${key.col}`;
                  
                  if (!rows[rowKey]) rows[rowKey] = [];
                  rows[rowKey].push({ key, center: centerPx, side });
                  
                  if (!cols[colKey]) cols[colKey] = [];
                  cols[colKey].push({ key, center: centerPx, side });
                });
                
                // Sort by X for row lines
                Object.entries(rows).forEach(([row, keys]) => {
                  keys.sort((a, b) => a.center.x - b.center.x);
                  if (keys.length > 1) {
                    rowLines.push({
                      id: `row-${row}`,
                      points: keys.flatMap(k => [k.center.x, k.center.y]),
                      side: keys[0].side,
                    });
                  }
                });
                
                // Sort by Y for column lines
                Object.entries(cols).forEach(([col, keys]) => {
                  keys.sort((a, b) => a.center.y - b.center.y);
                  if (keys.length > 1) {
                    colLines.push({
                      id: `col-${col}`,
                      points: keys.flatMap(k => [k.center.x, k.center.y]),
                      side: keys[0].side,
                    });
                  }
                });
                
                return (
                  <>
                    {/* Row Lines (Fuchsia Glow) */}
                    {rowLines.map(line => (
                      <Line
                        key={line.id}
                        points={line.points}
                        stroke="#d946ef"
                        strokeWidth={2}
                        opacity={0.4}
                        lineJoin="round"
                        lineCap="round"
                        shadowColor="#d946ef"
                        shadowBlur={10}
                        shadowOpacity={0.4}
                      />
                    ))}
                    {/* Column Lines (Cyan Glow) */}
                    {colLines.map(line => (
                      <Line
                        key={line.id}
                        points={line.points}
                        stroke="#06b6d4"
                        strokeWidth={2}
                        opacity={0.4}
                        lineJoin="round"
                        lineCap="round"
                        shadowColor="#06b6d4"
                        shadowBlur={10}
                        shadowOpacity={0.4}
                      />
                    ))}
                  </>
                );
              })()}
            </Group>
          )}

          {/* Layer 3: Labels (On top) */}
          {visKeys.map(key => {
            const matrixSide = getLocalMatrixPosition(settings, key, visKeys)?.side || key.matrixSide;
            return (
              <KeyComponent
                key={`${key.id}-label`} id={`${key.id}-label`} keyData={key}
                isSelected={selectedKeyIds.includes(key.id)} isFocused={focusedKeyId === key.id} isColliding={warningKeyIds.includes(key.id)}
                editorMode={editorMode} appMode={appMode} label={getKeyLabel(key, editorMode, currentLayer, appMode, remoteKeymap, settings.visualLayout, settings, visKeys)}
                matrixLabelFill={appMode === 'design' && editorMode === 'matrix' && settings.features.split
                  ? matrixSide === 'right' ? '#06b6d4' : '#f59e0b'
                  : undefined}
                showKeycap={false}
                onMouseEnter={() => {
                  if (editorSettings.debugMode) setHoveredSortKeyId(key.id);
                }}
              onMouseLeave={() => setHoveredSortKeyId(null)}
              onMouseDown={(e) => {
                if (mirrorCopyAxisMode) return;
                if (e.evt && e.evt.button !== 0) return;
                if (isMatrixPaintEvent(e)) {
                  e.cancelBubble = true;
                  return;
                }
                const isM = e.evt.ctrlKey || e.evt.metaKey;
                const isS = e.evt.shiftKey;
                const isA = e.evt.altKey;
                if (isA) {
                  setFocusedKeyId(key.id);
                  setSelectionAnchorId(key.id);
                  return;
                }
                if (isS && (selectionAnchorId || focusedKeyId)) {
                  const anchor = selectionAnchorId || focusedKeyId;
                  const sortedKeys = sortKeys(visKeys, editorSettings.sortThresholdY);
                  const idx1 = sortedKeys.findIndex(k => k.id === anchor);
                  const idx2 = sortedKeys.findIndex(k => k.id === key.id);
                  const start = Math.min(idx1, idx2);
                  const end = Math.max(idx1, idx2);
                  const rangeIds = sortedKeys.slice(start, end + 1).map(k => k.id as string);
                  if (isM) {
                    setSelectedKeyIds([...new Set([...selectedKeyIds, ...rangeIds])]);
                  } else {
                    setSelectedKeyIds(rangeIds);
                  }
                  setFocusedKeyId(key.id);
                } else if (isM) {
                  toggleKeySelection(key.id, true);
                } else {
                  if (!selectedKeyIds.includes(key.id)) {
                    setSelectedKeyIds([key.id]);
                    setFocusedKeyId(key.id);
                    setSelectionAnchorId(key.id);
                  }
                }
              }}
              onMouseMove={(e) => {
                updateMirrorAxisPreview(e);
                updatePaintHintPosition(e);
              }}
              onClick={(e) => {
                if (mirrorCopyAxisMode) return;
                if (handleMatrixPaintClick(e, key)) return;
                const isM = e.evt.ctrlKey || e.evt.metaKey;
                const isS = e.evt.shiftKey;
                const isA = e.evt.altKey;
                if (!isM && !isS && !isA) {
                  setSelectedKeyIds([key.id]);
                  setFocusedKeyId(key.id);
                  setSelectionAnchorId(key.id);
                }
              }}
              />
            );
          })}

          {editorSettings.debugMode && hoveredSortKey && hoveredSortInfo && (() => {
            const center = getVisualCenter(hoveredSortKey);
            const tooltipText = `sort #${hoveredSortInfo.index}\nx ${hoveredSortInfo.x.toFixed(3)}\ny ${hoveredSortInfo.y.toFixed(3)}`;
            return (
              <Group x={center.x + 12} y={center.y - 46} listening={false}>
                <Rect
                  width={88}
                  height={42}
                  cornerRadius={4}
                  fill="rgba(9, 9, 11, 0.94)"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  shadowColor="black"
                  shadowBlur={6}
                  shadowOpacity={0.35}
                />
                <Text
                  text={tooltipText}
                  x={6}
                  y={5}
                  width={76}
                  fontSize={10}
                  lineHeight={1.15}
                  fontStyle="bold"
                  fill="#fbbf24"
                  listening={false}
                />
              </Group>
            );
          })()}

          {mirrorCopyAxisMode && mirrorAxisPreviewX !== null && (() => {
            const x = mirrorAxisPreviewX * UNIT;
            const y1 = -(transform.y + PADDING_Y) / transform.scale;
            const y2 = y1 + dimensions.height / transform.scale;
            return (
              <Group listening={false}>
                <Line
                  points={[x, y1, x, y2]}
                  stroke="#f59e0b"
                  strokeWidth={2 / transform.scale}
                  dash={[8 / transform.scale, 6 / transform.scale]}
                  opacity={0.95}
                  shadowColor="#f59e0b"
                  shadowBlur={8}
                  shadowOpacity={0.35}
                />
                <Text
                  text={t('properties.mirrorAxis')}
                  x={x + 8 / transform.scale}
                  y={y1 + 16 / transform.scale}
                  fontSize={11 / transform.scale}
                  fontStyle="bold"
                  fill="#fbbf24"
                  listening={false}
                />
              </Group>
            );
          })()}

          {/* Smiðr Professional Handles */}
          {!readonlyGeometry && editorMode === 'layout' && focusedKey && selectedKeyIds.length > 0 && (
            <>
              {/* Rotation Handle (Rotates with the key) */}
              <Group 
                x={num(focusedKey.rx) * UNIT} 
                y={num(focusedKey.ry) * UNIT} 
                rotation={num(focusedKey.r)}
              >
                <Group 
                  y={-36} 
                  onMouseDown={handleRotationStart} 
                  onTouchStart={handleRotationStart}
                  onMouseEnter={(e: any) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'crosshair';
                  }}
                  onMouseLeave={(e: any) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = 'default';
                  }}
                >
                  <Circle 
                    radius={10} fill="#f59e0b" stroke="#09090b" strokeWidth={1} 
                    shadowColor="black" shadowBlur={4} shadowOpacity={0.4} shadowOffset={{ x: 0, y: 1 }} 
                  />
                  <KonvaPath 
                    data={ROTATE_ICON_PATH} 
                    fillEnabled={false} 
                    stroke="#09090b" 
                    strokeWidth={2} 
                    scale={{ x: 0.45, y: 0.45 }} 
                    offsetX={12} 
                    offsetY={12} 
                  />
                </Group>
              </Group>

              {/* Pivot Point Handle (Stationary) */}
              <Circle
                x={num(focusedKey.rx) * UNIT}
                y={num(focusedKey.ry) * UNIT}
                radius={4} fill="#f59e0b" stroke="#09090b" strokeWidth={1} 
                shadowColor="black" shadowBlur={4} shadowOpacity={0.4} shadowOffset={{ x: 0, y: 1 }}
                draggable
                onMouseEnter={(e: any) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'crosshair';
                }}
                onMouseLeave={(e: any) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'default';
                }}
                onDragStart={(e: any) => {
                  e.cancelBubble = true;
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'crosshair';
                }}
                onDragMove={(e) => handlePivotDragMove(e, focusedKey)}
                onDragEnd={(e: any) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'crosshair';
                  handlePivotDragMove(e, focusedKey);
                  commitPreviewKeys();
                }}
              />
            </>
          )}

        </Layer>

        <Layer>
          {selBox && (
            <Rect
              x={Math.min(selBox.start.x, selBox.end.x)} y={Math.min(selBox.start.y, selBox.end.y)}
              width={Math.abs(selBox.end.x - selBox.start.x)} height={Math.abs(selBox.end.y - selBox.start.y)}
              fill="rgba(245, 158, 11, 0.1)" stroke="#f59e0b" strokeWidth={1}
            />
          )}
        </Layer>
      </Stage>

      {appMode === 'design' && editorMode === 'matrix' && matrixPaintMode && !readonlyGeometry && paintHintPos && (
        <div
          className="absolute z-[120] pointer-events-none rounded-full border border-amber-500/30 bg-[var(--bg-panel)]/90 px-2.5 py-1 shadow-2xl backdrop-blur-md"
          style={{
            left: Math.min(paintHintPos.x + 14, dimensions.width - 132),
            top: Math.max(8, paintHintPos.y - 12)
          }}
        >
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            <span className="text-[var(--text-muted)]">{t('matrix.nextAssignment')}</span>
            <span className="font-mono text-amber-500">R{painter.currentRow}:C{painter.currentCol}</span>
          </div>
        </div>
      )}

      {/* Empty State Overlay (Design Mode) */}
      {!isProjectOpen && appMode === 'design' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500 bg-[var(--bg-app)]/50 backdrop-blur-[2px]">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in zoom-in duration-500">
            <FolderOpen size={40} className="text-amber-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--text-highlight)] mb-3 tracking-tight">
            {t('common.emptyProjectTitle')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-sm leading-relaxed mb-10">
            {t('common.emptyProjectDesc')}
          </p>

        </div>
      )}

      {/* Internal Empty Canvas State (Project Open but no keys) */}
      {isProjectOpen && visKeys.length === 0 && appMode === 'design' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500 pointer-events-none">
          <div className="w-16 h-16 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-6 opacity-50">
            <LayoutGrid size={32} />
          </div>
          <p className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-widest opacity-50">
            Canvas is empty. Add your first key!
          </p>
        </div>
      )}

      {/* Empty State Overlay (Remap Mode with no keys / layout metadata loading or unavailable) */}
      {appMode === 'remap' && visKeys.length === 0 && !zmkLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500 bg-[var(--bg-app)]/90 backdrop-blur-[4px] z-[200]">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in zoom-in duration-500">
            {isKeymapSyncing ? (
              <RefreshCw size={40} className="text-amber-500 animate-spin" />
            ) : (
              <LayoutGrid size={40} className="text-amber-500" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--text-highlight)] mb-3 tracking-tight">
            {isKeymapSyncing ? t('common.layoutMetadataLoadingTitle') : t('common.layoutMetadataUnavailableTitle')}
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed mb-6">
            {isKeymapSyncing ? t('common.layoutMetadataLoadingDesc') : t('common.layoutMetadataUnavailableDesc')}
          </p>
        </div>
      )}

    </div>
  );
};
