'use client';

import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Line, Circle, Path as KonvaPath } from 'react-konva';
import { useKeyboardStore, RuntimeKey } from '@/lib/store';
import { PhysicalKey } from '@/types/keyboard';
import { sortKeys } from '@/lib/sorting';
import { keysIntersect } from '@/lib/collision';
import { useTranslation } from '@/hooks/useTranslation';
import { LayoutGrid, FolderOpen, Plus, Lock, RefreshCw } from 'lucide-react';
import { KeyComponent } from './canvas/KeyComponent';
import { GridComponent } from './canvas/GridComponent';
import { UNIT, num, round, roundCoord, roundRot, getVisualCenter, getKeyVertices, getKeyLabel, isLayoutMode, PADDING_X, PADDING_Y } from '@/lib/canvas-utils';

const ROTATE_ICON_PATH = "M3 2v6h6 M3 13a9 9 0 1 0 3-7.7L3 8";

export const KeyboardCanvas = ({ readonlyGeometry = false }: { readonlyGeometry?: boolean }) => {
  const { 
    keys, previewKeys, settings, editorSettings, selectedKeyIds, focusedKeyId, selectionAnchorId,
    transform, editorMode, currentLayer, appMode, remoteKeymap,
    setSelectedKeyIds, toggleKeySelection, setFocusedKeyId, setSelectionAnchorId,
    batchUpdateKeys, removeKey, undo, redo, setTransform, paintKey,
    setPreviewKeys, commitPreviewKeys, copyKeys, pasteKeys,
    isProjectOpen, setIsHardwareModalOpen, resetProject,
    setCanvasDimensions,
    connectedDevice, currentProjectId,
    zmkLocked, syncKeymap
  } = useKeyboardStore();
  
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 800 });
  const stageRef = useRef<any>(null);
  const [selBox, setSelBox] = useState<{ start: { x: number, y: number }, end: { x: number, y: number }, isRealDrag: boolean } | null>(null);

  const displayKeys = previewKeys || keys;
  const visKeys = useMemo(() => (displayKeys.filter(k => !k.group || (settings.activeOptions[k.group] ?? 0) === k.option)) as RuntimeKey[], [displayKeys, settings.activeOptions]);

  const focusedKey = useMemo(() => visKeys.find(k => k.id === focusedKeyId), [visKeys, focusedKeyId]);

  useEffect(() => { 
    setIsClient(true);
    const updateSize = () => {
      const container = containerRef.current;
      if (container) {
        setDimensions({ width: container.clientWidth, height: container.clientHeight });
        setCanvasDimensions({ width: container.clientWidth, height: container.clientHeight });
      } else {
        const w = window.innerWidth;
        const h = window.innerHeight;
        setDimensions({ width: w, height: h });
        setCanvasDimensions({ width: w, height: h });
      }
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

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Escape') {
        setSelectedKeyIds([]);
        setFocusedKeyId(null);
        setSelectionAnchorId(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedKeyIds.length > 0 && !readonlyGeometry) {
          e.preventDefault();
          selectedKeyIds.forEach(id => removeKey(id));
          setSelectedKeyIds([]);
          setFocusedKeyId(null);
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
            rx: roundCoord(num(k.rx) + dx),
            ry: roundCoord(num(k.ry) + dy)
          }), true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [setSelectedKeyIds, setFocusedKeyId, setSelectionAnchorId, selectedKeyIds, removeKey, visKeys, focusedKeyId, undo, redo, copyKeys, pasteKeys, editorSettings.gridSnap, batchUpdateKeys, readonlyGeometry]);

  const lastCenteredRef = useRef<{ deviceId: string | null, projectId: string | null }>({ deviceId: null, projectId: null });

  useEffect(() => {
    const state = useKeyboardStore.getState();
    const currentKeys = state.keys;
    const container = containerRef.current;

    // Create unique identifiers for the current context
    const currentDeviceId = connectedDevice ? `${connectedDevice.vid}-${connectedDevice.pid}` : null;
    const currentProjId = currentProjectId;

    // Only attempt centering if we have an active context AND the layout geometry has been loaded
    if ((currentDeviceId || currentProjId) && currentKeys.length > 0) {
      const needsCenterForDevice = currentDeviceId && currentDeviceId !== lastCenteredRef.current.deviceId;
      const needsCenterForProject = currentProjId && currentProjId !== lastCenteredRef.current.projectId;

      if (needsCenterForDevice || needsCenterForProject) {
        if (container) {
          // Read synchronous dimensions from the DOM element.
          // Since the canvas is now a full-screen absolute overlay, we mathematically offset
          // the visual center to account for UI panels floating on top (e.g., KeycodePanel).
          const w = container.clientWidth;
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
              const keyboardHeight = maxY - minY;
              const keyboardCenterX = minX + keyboardWidth / 2;
              const keyboardCenterY = minY + keyboardHeight / 2;

              // Center horizontally, but fix vertically to exactly the same initial coordinate (resetY = 0)
              const resetX = w / 2 - PADDING_X - keyboardCenterX;
              const resetY = 0;

              state.setTransform({ scale: 1, x: resetX, y: resetY });
            }

            // Mark this specific context as successfully centered so it doesn't run on every edit
            lastCenteredRef.current = { deviceId: currentDeviceId, projectId: currentProjId };
          }
        }
      }
    } else if (!currentDeviceId && !currentProjId) {
      // Reset memory when disconnected so it can fire again upon next connection
      lastCenteredRef.current = { deviceId: null, projectId: null };
    }
  }, [connectedDevice, currentProjectId, keys.length]);

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

  // Zoom handling
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = Math.min(Math.max(oldScale + (e.evt.deltaY > 0 ? -0.1 : 0.1), 0.2), 5);
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    setTransform({ scale: newScale, x: newPos.x - PADDING_X, y: newPos.y - PADDING_Y });
  };

  const handleStageMouseDown = (e: any) => {
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

  const handleKeyDragMove = (e: any, id: string) => {
    if (readonlyGeometry) return;
    const pos = e.target.position(); // This is the PIVOT point
    const currentKey = visKeys.find(k => k.id === id);
    if (!currentKey) return;
    
    // Convert current node's pivot back to key units
    const nRX = pos.x / UNIT;
    const nRY = pos.y / UNIT;
    
    // Snap the pivot
    const snappedRX = e.evt.altKey ? nRX : Math.round(nRX / editorSettings.gridSnap) * editorSettings.gridSnap;
    const snappedRY = e.evt.altKey ? nRY : Math.round(nRY / editorSettings.gridSnap) * editorSettings.gridSnap;

    // Force visual snap
    e.target.x(snappedRX * UNIT);
    e.target.y(snappedRY * UNIT);

    const dRX = snappedRX - num(currentKey.rx);
    const dRY = snappedRY - num(currentKey.ry);

    if (dRX === 0 && dRY === 0) return;

    const updatedKeys = displayKeys.map(k => {
      if (!selectedKeyIds.includes(k.id)) return k;
      return {
        ...k,
        x: roundCoord(num(k.x) + dRX),
        y: roundCoord(num(k.y) + dRY),
        rx: roundCoord(num(k.rx) + dRX),
        ry: roundCoord(num(k.ry) + dRY)
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

    const onMouseMove = (me: MouseEvent) => {
      const container = stage.container();
      container.style.cursor = 'crosshair';
      const pos = stage.getRelativePointerPosition();

      const currentMouseAngle = Math.atan2(pos.y - pivot.y, pos.x - pivot.x);
      let deltaAngle = ((currentMouseAngle - startMouseAngle) * 180) / Math.PI;
      
      const nR = me.altKey ? roundRot(startKeyAngle + deltaAngle) : Math.round((startKeyAngle + deltaAngle) / 15) * 15;
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

    const onMouseUp = () => {
      const container = stageRef.current ? stageRef.current.container() : document.body;
      container.style.cursor = 'default';
      commitPreviewKeys();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handlePivotDragMove = (e: any, k: PhysicalKey) => {
    if (readonlyGeometry) return;
    const nRX = e.target.x() / UNIT;
    const nRY = e.target.y() / UNIT;
    const snappedRX = e.evt.altKey ? nRX : Math.round(nRX / editorSettings.gridSnap) * editorSettings.gridSnap;
    const snappedRY = e.evt.altKey ? nRY : Math.round(nRY / editorSettings.gridSnap) * editorSettings.gridSnap;

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
    <div ref={containerRef} id="keyboard-canvas-container" className="absolute inset-0 overflow-hidden bg-[var(--bg-app)] cursor-default select-none touch-none">
      <Stage
        width={dimensions.width} height={dimensions.height} ref={stageRef}
        x={transform.x + PADDING_X} y={transform.y + PADDING_Y} scaleX={transform.scale} scaleY={transform.scale}
        onWheel={handleWheel} onMouseDown={handleStageMouseDown} onMouseMove={handleStageMouseMove} onMouseUp={handleStageMouseUp}
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
              isSelected={selectedKeyIds.includes(key.id)} isFocused={focusedKeyId === key.id} isColliding={collidingIds.includes(key.id)}
              editorMode={editorMode} appMode={appMode} label={getKeyLabel(key, editorMode, currentLayer, appMode, remoteKeymap)}
              showLabel={false} draggable={!readonlyGeometry && appMode === 'design'}
              onDragStart={() => {
                if (readonlyGeometry || appMode !== 'design') return;
                setSelectedKeyIds(selectedKeyIds.includes(key.id) ? selectedKeyIds : [key.id]);
              }}
              onDragMove={(e) => {
                if (readonlyGeometry || appMode !== 'design') return;
                handleKeyDragMove(e, key.id);
              }} 
              onDragEnd={() => {
                if (readonlyGeometry || appMode !== 'design') return;
                commitPreviewKeys();
              }}
              onMouseDown={(e) => {
                if (e.evt && e.evt.button !== 0) return;
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
              onClick={(e) => {
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
          {editorMode === 'matrix' && editorSettings.showMatrixLines && !readonlyGeometry && (
            <Group listening={false}>
              {(() => {
                const rowLines: { id: string, points: number[] }[] = [];
                const colLines: { id: string, points: number[] }[] = [];
                
                const rows: Record<number, { key: PhysicalKey, center: { x: number, y: number } }[]> = {};
                const cols: Record<number, { key: PhysicalKey, center: { x: number, y: number } }[]> = {};
                
                visKeys.forEach(key => {
                  if (key.row === undefined || key.col === undefined) return;
                  
                  const center = getVisualCenter(key);
                  const centerPx = { x: center.x, y: center.y };
                  
                  if (!rows[key.row]) rows[key.row] = [];
                  rows[key.row].push({ key, center: centerPx });
                  
                  if (!cols[key.col]) cols[key.col] = [];
                  cols[key.col].push({ key, center: centerPx });
                });
                
                // Sort by X for row lines
                Object.entries(rows).forEach(([row, keys]) => {
                  keys.sort((a, b) => a.center.x - b.center.x);
                  if (keys.length > 1) {
                    rowLines.push({
                      id: `row-${row}`,
                      points: keys.flatMap(k => [k.center.x, k.center.y])
                    });
                  }
                });
                
                // Sort by Y for column lines
                Object.entries(cols).forEach(([col, keys]) => {
                  keys.sort((a, b) => a.center.y - b.center.y);
                  if (keys.length > 1) {
                    colLines.push({
                      id: `col-${col}`,
                      points: keys.flatMap(k => [k.center.x, k.center.y])
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
          {visKeys.map(key => (
            <KeyComponent
              key={`${key.id}-label`} id={`${key.id}-label`} keyData={key}
              isSelected={selectedKeyIds.includes(key.id)} isFocused={focusedKeyId === key.id} isColliding={collidingIds.includes(key.id)}
              editorMode={editorMode} appMode={appMode} label={getKeyLabel(key, editorMode, currentLayer, appMode, remoteKeymap)}
              showKeycap={false}
              onMouseDown={(e) => {
                if (e.evt && e.evt.button !== 0) return;
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
              onClick={(e) => {
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
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'crosshair';
                }}
                onDragMove={(e) => handlePivotDragMove(e, focusedKey)}
                onDragEnd={(e: any) => {
                  const container = e.target.getStage()?.container();
                  if (container) container.style.cursor = 'crosshair';
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

      {/* Empty State Overlay (Remap Mode with no keys / layout metadata unavailable) */}
      {appMode === 'remap' && visKeys.length === 0 && !zmkLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500 bg-[var(--bg-app)]/90 backdrop-blur-[4px] z-[200]">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in zoom-in duration-500">
            <LayoutGrid size={40} className="text-amber-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--text-highlight)] mb-3 tracking-tight">
            Layout Metadata Unavailable
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed mb-6">
            The physical layout and key positions could not be retrieved from the device.
          </p>
          {connectedDevice?.protocolType === 'zmk' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold max-w-sm leading-relaxed animate-pulse">
              If your device is locked, please physically press the &ldquo;Studio Unlock&rdquo; key combination on your keyboard to unlock it, then reconnect.
            </div>
          )}
        </div>
      )}

      {/* ZMK Locked State Overlay */}
      {appMode === 'remap' && zmkLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-500 bg-[var(--bg-app)]/90 backdrop-blur-[4px] z-[201]">
          <div className="w-20 h-20 rounded-3xl bg-[var(--bg-panel)] border border-[var(--border-main)] flex items-center justify-center text-[var(--text-dim)] mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-in zoom-in duration-500">
            <Lock size={40} className="text-amber-500 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-bold text-[var(--text-highlight)] mb-3 tracking-tight">
            ZMK Studio is locked
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md leading-relaxed mb-8">
            Press the physical &ldquo;Studio Unlock&rdquo; key combination on your keyboard to unlock it, then click below to retry synchronization.
          </p>

          <button
            onClick={() => syncKeymap()}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-black font-semibold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <RefreshCw size={16} />
            Retry Sync
          </button>
        </div>
      )}
    </div>
  );
};
