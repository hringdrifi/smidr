import React, { useMemo, useEffect, useState } from 'react';
import { Group, Path, Text, Rect, Circle } from 'react-konva';
import { PhysicalKey } from '../../types/keyboard';
import { UNIT, TOP_INSET, num, round, getUnionVertices, generatePath, offsetPolygon, getVisualCenter, generateFocusBrackets, isLayoutMode, LabelNode, labelNodeToText } from '../../lib/canvas-utils';
import { useKeyboardStore } from '../../lib/store';
import { THEME_COLORS } from '../../lib/colors';
import { useTranslation } from '@/hooks/useTranslation';

// Lucide "Layers2" icon SVG paths (viewBox 0 0 24 24)
const LAYERS_P1 = 'm16.02 12 5.48 3.13a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74L7.98 12';
const LAYERS_P2 = 'M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74l8.5-4.87a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74L13 13.74z';
const ICON_DISPLAY_SIZE = 8; // px displayed
const ICON_SCALE = ICON_DISPLAY_SIZE / 24;
const ICON_SW = 1.0 / ICON_SCALE; // strokeWidth in original coordinate space
const KEY_SHAPE_GAP = 2.5;

interface KeyComponentProps {
  id: string;
  keyData: PhysicalKey;
  isSelected: boolean;
  isFocused: boolean;
  isColliding: boolean;
  editorMode: 'layout' | 'matrix' | 'keymap' | 'hardware' | 'rgbMatrix';
  label: LabelNode;
  appMode: 'design' | 'remap';
  showKeycap?: boolean;
  showLabel?: boolean;
  matrixLabelFill?: string;
  draggable?: boolean;
  onDragStart?: (e: any) => void;
  onDragMove?: (e: any) => void;
  onDragEnd?: (e: any) => void;
  onMouseDown?: (e: any) => void;
  onMouseMove?: (e: any) => void;
  onClick?: (e: any) => void;
}

export const KeyComponent: React.FC<KeyComponentProps> = ({
  id,
  keyData,
  isSelected,
  isFocused,
  isColliding,
  editorMode,
  label,
  appMode,
  showKeycap = true,
  showLabel = true,
  matrixLabelFill,
  draggable = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMouseDown,
  onMouseMove,
  onClick
}) => {
  const { x, y, w, h, r, rx, ry, x2, y2, w2, h2, stepped } = keyData;
  const isDebug = useKeyboardStore(s => s.editorSettings.debugMode);
  const matrixPaintMode = useKeyboardStore(s => s.matrixPaintMode);
  const { t } = useTranslation();
  const isEncoder = keyData.kind === 'encoder' || !!keyData.encoderId || keyData.encoderIndex !== undefined;
  
  if (isDebug && (x2 !== undefined || y2 !== undefined || w2 !== undefined || h2 !== undefined)) {
    console.log(`[KeyComponent] Rendering secondary shape for "${keyData.label}":`, { x2, y2, w2, h2 });
  }
  
  const theme = useKeyboardStore(s => s.editorSettings.theme);
  
  const [colors, setColors] = useState(THEME_COLORS[theme]);

  useEffect(() => {
    setColors(THEME_COLORS[theme]);
  }, [isSelected, isFocused, theme]);

  const { pathData, topPathData, rawV_units, rawV, mX, mY, bW, bH } = useMemo(() => {
    const r1 = { x1: 0, y1: 0, x2: num(w), y2: num(h) };
    const r2 = (x2 !== undefined || y2 !== undefined || w2 !== undefined || h2 !== undefined) 
      ? { x1: num(x2), y1: num(y2), x2: num(x2) + num(w2 || w), y2: num(y2) + num(h2 || h) } 
      : null;
    
    const minX = round(Math.min(0, num(x2))), minY = round(Math.min(0, num(y2)));
    const maxW = round(Math.max(num(w), num(x2) + num(w2 || w))) - minX;
    const maxH = round(Math.max(num(h), num(y2) + num(h2 || h))) - minY;

    const rawV_units = getUnionVertices(r1, r2);
    const rawV = offsetPolygon(rawV_units.map(v => ({ 
      x: (v.x - minX) * UNIT, 
      y: (v.y - minY) * UNIT 
    })), KEY_SHAPE_GAP);
    
    let topV;
    const inset = TOP_INSET * UNIT;
    if (!!stepped && r2) {
      const rawPrimaryV = getUnionVertices(r1, null).map(v => ({ 
        x: (v.x - minX) * UNIT, 
        y: (v.y - minY) * UNIT 
      }));
      topV = offsetPolygon(rawPrimaryV, KEY_SHAPE_GAP + inset);
    } else {
      topV = offsetPolygon(rawV, inset);
    }

    return {
      pathData: generatePath(rawV, 4),
      topPathData: generatePath(topV, 4),
      rawV_units,
      rawV,
      mX: minX,
      mY: minY,
      bW: maxW,
      bH: maxH
    };
  }, [w, h, x2, y2, w2, h2, stepped]);

  const fillColor = isColliding ? 'rgba(239, 68, 68, 0.6)' : colors.bgKey;
  const strokeColor = isSelected ? colors.accent : (isColliding ? '#ef4444' : colors.border);
  const strokeWidth = isSelected ? 2 : 1;

  const pivotInLocalX = (num(rx) - (num(x) + mX)) * UNIT;
  const pivotInLocalY = (num(ry) - (num(y) + mY)) * UNIT;

  const layoutMode = isLayoutMode(appMode, editorMode);
  const hoverCursor = (appMode === 'design' && editorMode === 'matrix' && matrixPaintMode)
    ? 'crosshair'
    : (layoutMode ? 'move' : 'pointer');

  // Shared layout values for label rendering
  const centerX = (-num(mX) + num(w) / 2) * UNIT;
  const centerY = (-num(mY) + num(h) / 2) * UNIT;
  const textWidth = num(w) * UNIT;
  const encoderRadius = Math.max(0, Math.min(num(w), num(h)) * UNIT / 2 - KEY_SHAPE_GAP);
  const encoderTopRadius = Math.max(0, encoderRadius - TOP_INSET * UNIT);
  const encoderFocusRadius = Math.max(0, encoderRadius - 4);

  // Pill (tap keycode) shared styles
  const pillFill = theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const pillStroke = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
  const pillTextColor = colors.text;

  // Helper: render Layers icon + layer number centered at a given y position
  const renderLayerBadge = (layerId: number, badgeCenterY: number) => {
    const layerStr = String(layerId);
    const numWidth = layerStr.length * 7;
    const totalBadgeWidth = ICON_DISPLAY_SIZE + 3 + numWidth;
    const iconX = centerX - totalBadgeWidth / 2;
    const iconY = badgeCenterY - ICON_DISPLAY_SIZE / 2;
    const layersFill = colors.accent;
    const layersStroke = '#d97706'; // amber-600

    return (
      <Group listening={false}>
        <Group x={iconX} y={iconY} scaleX={ICON_SCALE} scaleY={ICON_SCALE}>
          <Path data={LAYERS_P1} fill={layersFill} stroke={layersStroke} strokeWidth={ICON_SW} lineCap="round" lineJoin="round" />
          <Path data={LAYERS_P2} fill={layersFill} stroke={layersStroke} strokeWidth={ICON_SW} lineCap="round" lineJoin="round" />
        </Group>
        <Text
          text={layerStr}
          x={iconX + ICON_DISPLAY_SIZE + 3}
          y={badgeCenterY - 5}
          fontSize={10}
          fontStyle="bold"
          fill={colors.text}
          align="left"
        />
      </Group>
    );
  };

  const getLayerActionText = (variant: 'momentary' | 'toggle' | 'to') => {
    if (variant === 'momentary') return t('keycode.layerHold') || 'Hold';
    if (variant === 'toggle') return t('keycode.layerToggle') || 'Toggle';
    return t('keycode.layerGoTo') || 'Go to';
  };

  // Helper: render tap keycode as simple text (no pill frame)
  const renderTapText = (tapLabel: LabelNode, textCenterY: number) => {
    const tapText = labelNodeToText(tapLabel, getLayerActionText);
    const fontSize = 10;
    return (
      <Text
        text={tapText}
        x={centerX}
        y={textCenterY - fontSize / 2}
        width={textWidth}
        offsetX={textWidth / 2}
        fontSize={fontSize}
        fontStyle="bold"
        fill={colors.text}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    );
  };

  // Helper: render hold modifier (e.g. CTL) inside a pill frame
  const renderHoldPill = (holdText: string, pillCenterY: number) => {
    const bottomFontSize = 9;
    const estimatedPillWidth = Math.max(32, holdText.length * 5.5 + 10);
    const rectHeight = 15;

    return (
      <Group
        x={centerX}
        y={pillCenterY}
        listening={false}
      >
        <Rect
          x={-estimatedPillWidth / 2}
          y={-rectHeight / 2}
          width={estimatedPillWidth}
          height={rectHeight}
          fill={pillFill}
          stroke={pillStroke}
          strokeWidth={1}
          cornerRadius={3.5}
        />
        <Text
          text={holdText}
          x={-textWidth / 2}
          y={-bottomFontSize / 2}
          width={textWidth}
          fontSize={bottomFontSize}
          fontStyle="bold"
          fill={pillTextColor}
          align="center"
          verticalAlign="middle"
        />
      </Group>
    );
  };

  // Helper: render hold layer badge inside a pill frame
  const renderLayerTapHoldPill = (layerId: number, pillCenterY: number) => {
    const layerStr = String(layerId);
    const numWidth = layerStr.length * 7;
    const totalBadgeWidth = ICON_DISPLAY_SIZE + 3 + numWidth;
    const estimatedPillWidth = Math.max(32, totalBadgeWidth + 10);
    const rectHeight = 15;

    const iconX = centerX - totalBadgeWidth / 2;
    const iconY = pillCenterY - ICON_DISPLAY_SIZE / 2;
    const layersFill = colors.accent;
    const layersStroke = '#d97706'; // amber-600

    return (
      <Group listening={false}>
        <Rect
          x={centerX - estimatedPillWidth / 2}
          y={pillCenterY - rectHeight / 2}
          width={estimatedPillWidth}
          height={rectHeight}
          fill={pillFill}
          stroke={pillStroke}
          strokeWidth={1}
          cornerRadius={3.5}
        />
        <Group x={iconX} y={iconY} scaleX={ICON_SCALE} scaleY={ICON_SCALE}>
          <Path data={LAYERS_P1} fill={layersFill} stroke={layersStroke} strokeWidth={ICON_SW} lineCap="round" lineJoin="round" />
          <Path data={LAYERS_P2} fill={layersFill} stroke={layersStroke} strokeWidth={ICON_SW} lineCap="round" lineJoin="round" />
        </Group>
        <Text
          text={layerStr}
          x={iconX + ICON_DISPLAY_SIZE + 3}
          y={pillCenterY - 5}
          fontSize={10}
          fontStyle="bold"
          fill={colors.text}
          align="left"
        />
      </Group>
    );
  };

  // Render the label node
  const renderLabel = () => {
    if (!showLabel) return null;

    switch (label.type) {
      case 'empty':
        return null;

      case 'text':
        return (
          <Text
            text={label.text}
            x={centerX}
            y={centerY}
            width={textWidth}
            height={num(h) * UNIT}
            offsetX={textWidth / 2}
            offsetY={(num(h) * UNIT) / 2}
            fontSize={11}
            lineHeight={1.18}
            fontStyle="bold"
            fill={appMode === 'design' && (editorMode === 'matrix' || editorMode === 'rgbMatrix') ? (matrixLabelFill || colors.accent) : colors.text}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        );

      case 'layer_action': {
        const verb = getLayerActionText(label.variant);
        return (
          <Group listening={false}>
            <Text
              text={verb}
              x={centerX}
              y={centerY - 10}
              width={textWidth}
              offsetX={textWidth / 2}
              fontSize={9}
              fontStyle="bold"
              fill={colors.text}
              align="center"
              verticalAlign="middle"
            />
            {renderLayerBadge(label.layerId, centerY + 4)}
          </Group>
        );
      }

      case 'layer_tap':
        return (
          <Group listening={true}>
            {renderLayerTapHoldPill(label.layerId, centerY - 9)}
            {renderTapText(label.tapLabel, centerY + 9)}
          </Group>
        );

      case 'mod_tap': {
        const modText = label.modifiers.map(m => m.replace(/^[LR]/, '')).join('+');
        return (
          <Group listening={true}>
            {renderHoldPill(modText, centerY - 9)}
            {renderTapText(label.tapLabel, centerY + 9)}
          </Group>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Group
      id={id}
      name="key-group"
      x={num(rx) * UNIT}
      y={num(ry) * UNIT}
      rotation={num(r)}
      offsetX={pivotInLocalX}
      offsetY={pivotInLocalY}
      draggable={draggable && showKeycap && layoutMode}
      onDragStart={(e) => {
        if (e.evt && typeof e.evt.button === 'number' && e.evt.button !== 0) {
          e.target.stopDrag();
          return;
        }
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = 'move';
        onDragStart?.(e);
      }}
      onDragMove={onDragMove}
      onDragEnd={(e) => {
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = hoverCursor;
        onDragEnd?.(e);
      }}
      onMouseEnter={(e) => {
        if (!showKeycap) return;
        const container = e.target.getStage()?.container();
        if (container) container.style.cursor = hoverCursor;
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        const container = stage ? stage.container() : document.body;
        container.style.cursor = (appMode === 'design' && editorMode === 'matrix' && matrixPaintMode) ? 'crosshair' : 'default';
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onTap={onClick}
      onClick={onClick}
      listening={showKeycap || showLabel}
    >
      {showKeycap && (
        <>
          {isEncoder ? (
            <>
              <Circle
                x={centerX}
                y={centerY}
                radius={encoderRadius}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                shadowColor="black"
                shadowBlur={isSelected ? 10 : 4}
                shadowOpacity={0.4}
                shadowOffset={{ x: 0, y: 2 }}
              />
              <Circle
                x={centerX}
                y={centerY}
                radius={encoderTopRadius}
                fill={isColliding ? 'rgba(239, 68, 68, 0.4)' : colors.bgKeyTop}
                listening={false}
              />
              {isFocused && layoutMode && (
                <Circle
                  x={centerX}
                  y={centerY}
                  radius={encoderFocusRadius}
                  stroke={colors.accent}
                  strokeWidth={2}
                  listening={false}
                />
              )}
            </>
          ) : (
            <>
              {/* Base Shape */}
              <Path
                data={pathData}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                shadowColor="black"
                shadowBlur={isSelected ? 10 : 4}
                shadowOpacity={0.4}
                shadowOffset={{ x: 0, y: 2 }}
              />
              {/* Top Surface */}
              <Path
                data={topPathData}
                fill={isColliding ? 'rgba(239, 68, 68, 0.4)' : colors.bgKeyTop}
                listening={false}
              />
              {/* Focus Brackets */}
              {isFocused && layoutMode && (
                <Path
                  data={generateFocusBrackets(rawV)}
                  stroke={colors.accent}
                  strokeWidth={2}
                  listening={false}
                />
              )}
            </>
          )}
        </>
      )}
      
      {renderLabel()}
    </Group>
  );
};
