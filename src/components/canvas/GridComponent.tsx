import React from 'react';
import { Shape } from 'react-konva';
import { UNIT } from '../../lib/canvas-utils';
import { useKeyboardStore } from '../../lib/store';
import { THEME_COLORS } from '../../lib/colors';

interface GridComponentProps {
  width: number;
  height: number;
  gridSnap: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  visible: boolean;
}

export const GridComponent: React.FC<GridComponentProps> = ({
  width,
  height,
  gridSnap,
  scale,
  offsetX,
  offsetY,
  visible
}) => {
  const theme = useKeyboardStore(s => s.editorSettings.theme);
  if (!visible) return null;

  // Use a single Shape to draw the entire grid for maximum performance
  return (
    <Shape
      sceneFunc={(context, shape) => {
        const gridSize = UNIT * gridSnap;
        
        // Calculate visible range in world coordinates
        const startX = Math.floor(-offsetX / (gridSize * scale)) * gridSize;
        const endX = startX + (width / scale) + gridSize;
        const startY = Math.floor(-offsetY / (gridSize * scale)) * gridSize;
        const endY = startY + (height / scale) + gridSize;

        context.beginPath();
        context.fillStyle = THEME_COLORS[theme].grid;
        
        for (let x = startX; x < endX; x += gridSize) {
          for (let y = startY; y < endY; y += gridSize) {
            context.moveTo(x, y);
            context.arc(x, y, 0.8, 0, Math.PI * 2);
          }
        }
        context.fill();
      }}
      listening={false}
    />
  );
};
