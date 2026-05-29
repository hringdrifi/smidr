import { PhysicalKey } from '../types/keyboard';
import { UniversalAction, Modifier } from '../types/actions';
import { KEYCODES } from './keycodes';
import { actionToQmkString } from './protocols/via-action-converter';

export const UNIT = 48;
export const TOP_INSET = 0.08;
export const PADDING_X = 48 + 1.5 * UNIT;
export const PADDING_Y = 48;

export const num = (v: any): number => {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export const round = (v: number) => Math.round(num(v) * 10000000) / 10000000;
export const roundCoord = (v: number) => Math.round(v * 10000000) / 10000000;
export const roundRot = (v: number) => Math.round(v * 100) / 100;

export const isLayoutMode = (appMode: string, editorMode: string) => 
  appMode === 'design' && editorMode === 'layout';

export const getUnionVertices = (r1: {x1:number,y1:number,x2:number,y2:number}, r2: {x1:number,y1:number,x2:number,y2:number} | null) => {
  const s1 = { x1: round(r1.x1), y1: round(r1.y1), x2: round(r1.x2), y2: round(r1.y2) };
  if (!r2) return [{x:s1.x1,y:s1.y1}, {x:s1.x2,y:s1.y1}, {x:s1.x2,y:s1.y2}, {x:s1.x1,y:s1.y2}];
  const s2 = { x1: round(r2.x1), y1: round(r2.y1), x2: round(r2.x2), y2: round(r2.y2) };
  
  const xs = Array.from(new Set([s1.x1, s1.x2, s2.x1, s2.x2])).sort((a,b)=>a-b);
  const ys = Array.from(new Set([s1.y1, s1.y2, s2.y1, s2.y2])).sort((a,b)=>a-b);
  
  const grid = ys.slice(0,-1).map((y,j) => xs.slice(0,-1).map((x,i) => {
    const cx = (x + xs[i+1])/2, cy = (y + ys[j+1])/2;
    return (cx >= s1.x1 && cx <= s1.x2 && cy >= s1.y1 && cy <= s1.y2) || (cx >= s2.x1 && cx <= s2.x2 && cy >= s2.y1 && cy <= s2.y2);
  }));

  let startX = -1, startY = -1;
  for(let j=0; j<grid.length; j++) { for(let i=0; i<grid[j].length; i++) { if(grid[j][i]) { startX=i; startY=j; break; } } if(startX!==-1) break; }
  if(startX===-1) return [];

  const pts: {x:number,y:number}[] = [];
  let cx=startX, cy=startY, dir=0; // 0:R, 1:D, 2:L, 3:U
  const getC = (x:number,y:number) => (x<0||y<0||x>=xs.length-1||y>=ys.length-1) ? false : grid[y][x];

  for(let i=0; i<500; i++) {
    pts.push({x: xs[cx], y: ys[cy]});
    const c0=getC(cx-1,cy-1), c1=getC(cx,cy-1), c2=getC(cx,cy), c3=getC(cx-1,cy);
    if(dir===0) { if(c1) dir=3; else if(!c2) dir=1; }
    else if(dir===1) { if(c2) dir=0; else if(!c3) dir=2; }
    else if(dir===2) { if(c3) dir=1; else if(!c0) dir=3; }
    else if(dir===3) { if(c0) dir=2; else if(!c1) dir=0; }
    if(dir===0) cx++; else if(dir===1) cy++; else if(dir===2) cx--; else if(dir===3) cy--;
    if(cx===startX && cy===startY) break;
  }
  
  const res: {x:number,y:number}[] = [];
  for(const p of pts) { if(res.length>0 && Math.abs(p.x-res[res.length-1].x)<0.001 && Math.abs(p.y-res[res.length-1].y)<0.001) continue; res.push(p); }
  return res.filter((p,i,arr) => {
    const prev=arr[(i-1+arr.length)%arr.length], next=arr[(i+1)%arr.length];
    return Math.abs((next.y-p.y)*(p.x-prev.x) - (p.y-prev.y)*(next.x-p.x)) > 0.001;
  });
};

export const generatePath = (pts: {x:number,y:number}[], radius: number) => {
  if (pts.length < 3) return "";
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], prev = pts[(i-1+pts.length)%pts.length], next = pts[(i+1)%pts.length];
    const dx1 = p.x - prev.x, dy1 = p.y - prev.y, dx2 = next.x - p.x, dy2 = next.y - p.y;
    const l1 = Math.sqrt(dx1*dx1+dy1*dy1), l2 = Math.sqrt(dx2*dx2+dy2*dy2);
    if (l1 < radius || l2 < radius) { d += (i===0 ? "M " : "L ") + `${p.x},${p.y} `; continue; }
    const r = radius, v1 = {x:dx1/l1, y:dy1/l1}, v2 = {x:dx2/l2, y:dy2/l2};
    const s = {x:p.x-v1.x*r, y:p.y-v1.y*r}, e = {x:p.x+v2.x*r, y:p.y+v2.y*r};
    d += (i===0 ? "M " : "L ") + `${s.x},${s.y} Q ${p.x},${p.y} ${e.x},${e.y} `;
  }
  return d + "Z";
};

export const offsetPolygon = (pts: {x:number, y:number}[], amount: number) => {
  if (pts.length < 3) return pts;
  
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const isCW = area > 0;
  
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    
    const v1 = { x: p.x - prev.x, y: p.y - prev.y };
    const l1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const u1 = { x: v1.x / l1, y: v1.y / l1 };
    
    const v2 = { x: next.x - p.x, y: next.y - p.y };
    const l2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const u2 = { x: v2.x / l2, y: v2.y / l2 };
    
    const n1 = isCW ? { x: -u1.y, y: u1.x } : { x: u1.y, y: -u1.x };
    const n2 = isCW ? { x: -u2.y, y: u2.x } : { x: u2.y, y: -u2.x };
    
    const dot = n1.x * n2.x + n1.y * n2.y;
    if (Math.abs(1 + dot) < 0.001) return p;
    
    return {
      x: p.x + amount * (n1.x + n2.x) / (1 + dot),
      y: p.y + amount * (n1.y + n2.y) / (1 + dot)
    };
  });
};

export const getVisualCenter = (k: PhysicalKey) => {
  const mX = round(Math.min(0, num(k.x2))), mY = round(Math.min(0, num(k.y2)));
  const bW = round(Math.max(num(k.w), num(k.x2) + num(k.w2 || k.w))) - mX;
  const bH = round(Math.max(num(k.h), num(k.y2) + num(k.h2 || k.h))) - mY;
  
  const cx = num(k.x) + mX + bW / 2;
  const cy = num(k.y) + mY + bH / 2;
  
  const rad = (num(k.r) * Math.PI) / 180;
  const px = num(k.rx);
  const py = num(k.ry);
  
  const rcx = (cx - px) * Math.cos(rad) - (cy - py) * Math.sin(rad) + px;
  const rcy = (cx - px) * Math.sin(rad) + (cy - py) * Math.cos(rad) + py;
  
  return { x: rcx * UNIT, y: rcy * UNIT };
};

export const getKeyVertices = (k: PhysicalKey) => {
  const r1 = { x1: 0, y1: 0, x2: num(k.w), y2: num(k.h) };
  const r2 = (k.x2 !== undefined || k.y2 !== undefined || k.w2 !== undefined || k.h2 !== undefined) ? { x1: num(k.x2), y1: num(k.y2), x2: num(k.x2) + num(k.w2 || k.w), y2: num(k.y2) + num(k.h2 || k.h) } : null;
  const rawV = getUnionVertices(r1, r2).map(p => ({ x: p.x * UNIT, y: p.y * UNIT }));
  
  const rad = (num(k.r) * Math.PI) / 180;
  return rawV.map(p => {
    const px = (p.x / UNIT + num(k.x)) - num(k.rx), py = (p.y / UNIT + num(k.y)) - num(k.ry);
    return { x: (px * Math.cos(rad) - py * Math.sin(rad) + num(k.rx)) * UNIT, y: (px * Math.sin(rad) + py * Math.cos(rad) + num(k.ry)) * UNIT };
  });
};

export type LabelNode =
  | { type: 'text'; text: string }
  | { type: 'empty' }
  | { type: 'layer_action'; variant: 'momentary' | 'toggle' | 'to'; layerId: number }
  | { type: 'layer_tap'; layerId: number; tapLabel: LabelNode }
  | { type: 'mod_tap'; modifiers: string[]; tapLabel: LabelNode };

export const labelNodeToText = (node: LabelNode): string => {
  switch (node.type) {
    case 'text': return node.text.replace(/\n/g, ' ');
    case 'empty': return '';
    case 'layer_action': {
      const verb = node.variant === 'momentary' ? 'Hold' : node.variant === 'toggle' ? 'Toggle' : 'Go to';
      return `${verb} L${node.layerId}`;
    }
    case 'layer_tap': return `L${node.layerId} + ${labelNodeToText(node.tapLabel)}`;
    case 'mod_tap': return `${node.modifiers.join('+')} + ${labelNodeToText(node.tapLabel)}`;
  }
};

export const formatActionLabel = (action: UniversalAction | undefined): LabelNode => {
  if (!action) return { type: 'text', text: '▽' };
  switch (action.action) {
    case 'trans':
      return { type: 'text', text: '▽' };
    case 'none':
      return { type: 'empty' };
    case 'tap': {
      const match = KEYCODES.find(kc => kc.code === action.keycode);
      let baseLabel = match?.label || action.keycode;
      if (action.keycode === 'TRNS') {
        baseLabel = '▽';
      } else if (action.keycode === 'NO') {
        baseLabel = '';
      }
      if (action.mods && action.mods.length > 0) {
        const modAbbrev: Record<Modifier, string> = {
          'LCTL': 'CTL', 'RCTL': 'CTL',
          'LSFT': 'SFT', 'RSFT': 'SFT',
          'LALT': 'ALT', 'RALT': 'ALT',
          'LGUI': 'GUI', 'RGUI': 'GUI'
        };
        const abbreviatedMods = action.mods.map(mod => modAbbrev[mod] || mod);
        return { type: 'text', text: `${abbreviatedMods.join('+')}\n${baseLabel}` };
      }
      return { type: 'text', text: baseLabel || '' };
    }
    case 'mo':
      return { type: 'layer_action', variant: 'momentary', layerId: action.layerId };
    case 'tg':
      return { type: 'layer_action', variant: 'toggle', layerId: action.layerId };
    case 'to':
      return { type: 'layer_action', variant: 'to', layerId: action.layerId };
    case 'lt':
      return { type: 'layer_tap', layerId: action.layerId, tapLabel: formatActionLabel(action.tapAction) };
    case 'mt':
      return { type: 'mod_tap', modifiers: action.modifiers, tapLabel: formatActionLabel(action.tapAction) };
    case 'macro':
      return { type: 'text', text: `Macro\n${action.macroId}` };
    case 'lighting': {
      const lightLabels: Record<string, string> = {
        TOGGLE: 'RGB\nToggle', MODE_UP: 'RGB\nMode +', MODE_DOWN: 'RGB\nMode -',
        BRIGHTNESS_UP: 'RGB\nBright +', BRIGHTNESS_DOWN: 'RGB\nBright -',
      };
      return { type: 'text', text: lightLabels[action.command] ?? `RGB\n${action.command}` };
    }
    case 'custom':
      return { type: 'text', text: action.rawCode };
    default:
      return { type: 'empty' };
  }
};

export const getKeyLabel = (
  k: PhysicalKey, 
  mode: string, 
  currentLayer: number, 
  appMode?: string,
  remoteKeymap?: Record<number, UniversalAction[]>
): LabelNode => {
  if (appMode === 'remap') {
    const flatIndex = k.zmkPosition ?? (
      k.row !== undefined && k.col !== undefined ? k.row * 32 + k.col : undefined
    );
    if (flatIndex === undefined) return { type: 'empty' };
    const action = remoteKeymap?.[currentLayer]?.[flatIndex];
    if (!action) return { type: 'text', text: '...' };
    return formatActionLabel(action);
  }

  if (mode === 'matrix') {
    return (k.row !== undefined && k.col !== undefined)
      ? { type: 'text', text: `R${k.row}:C${k.col}` }
      : { type: 'empty' };
  }
  if (mode === 'keymap') {
    const action = k.keymap?.[currentLayer];
    return formatActionLabel(action);
  }
  return { type: 'empty' };
};

export const generateFocusBrackets = (points: { x: number, y: number }[]) => {
  if (points.length === 0) return '';
  let d = '';
  const len = 6;
  const padding = 5; // Deeper offset inward to match SVG version
  
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    const v1x = prev.x - p.x, v1y = prev.y - p.y;
    const v2x = next.x - p.x, v2y = next.y - p.y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (mag1 < 0.1 || mag2 < 0.1) continue;

    const n1x = v1x / mag1, n1y = v1y / mag1;
    const n2x = v2x / mag2, n2y = v2y / mag2;

    // Calculate inward vector (bisector)
    // For clockwise polygons in Y-down screen coords, convex corners have cross < 0
    const cross = n1x * n2y - n1y * n2x;
    const isConvex = cross < 0; 
    const bisectX = (n1x + n2x), bisectY = (n1y + n2y);
    const magB = Math.sqrt(bisectX * bisectX + bisectY * bisectY);
    
    if (magB < 0.1) continue;

    // Shift inward
    const shiftX = (bisectX / magB) * padding * (isConvex ? 1 : -1);
    const shiftY = (bisectY / magB) * padding * (isConvex ? 1 : -1);

    const px = p.x + shiftX;
    const py = p.y + shiftY;

    d += `M${px + n1x * len} ${py + n1y * len} L${px} ${py} L${px + n2x * len} ${py + n2y * len} `;
  }
  return d;
};
