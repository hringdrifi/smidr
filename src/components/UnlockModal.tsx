'use client';

import React, { useMemo } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export const UnlockModal = () => {
  const { unlockState, keys, settings } = useKeyboardStore();
  const { progress, status, statusText, unlockKeys } = unlockState;

  // 1. Filter active layout keys for preview mapping
  const visKeys = useMemo(() => {
    const activeOpts = settings?.activeOptions || {};
    return keys.filter(k => !k.group || (activeOpts[k.group] ?? 0) === k.option);
  }, [keys, settings?.activeOptions]);

  // 2. Compute keyboard layout boundaries dynamically for SVG viewBox
  const bounds = useMemo(() => {
    if (visKeys.length === 0) {
      return { minX: 0, minY: 0, width: 15, height: 5 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    visKeys.forEach(k => {
      const x = k.x !== undefined ? Number(k.x) : 0;
      const y = k.y !== undefined ? Number(k.y) : 0;
      const w = k.w !== undefined ? Number(k.w) : 1;
      const h = k.h !== undefined ? Number(k.h) : 1;
      const x2 = k.x2 !== undefined ? Number(k.x2) : x;
      const y2 = k.y2 !== undefined ? Number(k.y2) : y;
      const w2 = k.w2 !== undefined ? Number(k.w2) : w;
      const h2 = k.h !== undefined ? Number(k.h) : h;

      const kMinX = Math.min(x, x2);
      const kMaxX = Math.max(x + w, x2 + w2);
      const kMinY = Math.min(y, y2);
      const kMaxY = Math.max(y + h, y2 + h2);

      if (kMinX < minX) minX = kMinX;
      if (kMaxX > maxX) maxX = kMaxX;
      if (kMinY < minY) minY = kMinY;
      if (kMaxY > maxY) maxY = kMaxY;
    });

    const padding = 0.4;
    return {
      minX: minX - padding,
      minY: minY - padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    };
  }, [visKeys]);

  // Helper: check if a specific key is one of the unlock key combination
  const isUnlockKey = (key: any) => {
    if (!unlockKeys) return false;
    return unlockKeys.some(uk => uk.row === key.row && uk.col === key.col);
  };

  if (!unlockState.showModal) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-xs transition-opacity duration-300">
      <div className="relative w-full max-w-xl p-8 overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/95 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 transform scale-100 flex flex-col items-center">
        {/* Glow effect backdrops */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50">
            {status === 'holding' && <ShieldAlert className="w-5 h-5 text-cyan-400 animate-pulse" />}
            {status === 'success' && <ShieldCheck className="w-5 h-5 text-emerald-400 animate-bounce" />}
            {status === 'failed' && <ShieldAlert className="w-5 h-5 text-red-400" />}
          </div>
          <h3 className="text-lg font-bold text-slate-100 tracking-wide uppercase">
            {status === 'holding' && 'Security Unlock Required'}
            {status === 'success' && 'Device Unlocked!'}
            {status === 'failed' && 'Unlock Failed'}
          </h3>
        </div>

        {/* Descriptions */}
        <div className="text-center text-xs text-slate-400 max-w-lg mb-6 space-y-2 leading-relaxed font-medium">
          <p>
            In order to proceed, the keyboard must be set into unlocked mode.
            You should only perform this operation on computers that you trust.
          </p>
          <p className="text-[10px] text-slate-500">
            To exit this mode, you will need to replug the keyboard or select Security &gt; Lock from the menu.
          </p>
        </div>

        {/* Press instruction */}
        {status === 'holding' && (
          <p className="text-xs text-cyan-400 font-bold tracking-wider uppercase mb-4 animate-pulse">
            Press and hold the following highlighted keys:
          </p>
        )}

        {/* Dynamic Keyboard Minimap Preview */}
        {visKeys.length > 0 && (
          <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 mb-6 flex justify-center items-center shadow-inner overflow-hidden max-h-56">
            <svg
              viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
              className="w-full h-auto max-h-48 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              {visKeys.map(k => {
                const x = k.x !== undefined ? Number(k.x) : 0;
                const y = k.y !== undefined ? Number(k.y) : 0;
                const w = k.w !== undefined ? Number(k.w) : 1;
                const h = k.h !== undefined ? Number(k.h) : 1;
                const x2 = k.x2 !== undefined ? Number(k.x2) : x;
                const y2 = k.y2 !== undefined ? Number(k.y2) : y;
                const w2 = k.w2 !== undefined ? Number(k.w2) : w;
                const h2 = k.h !== undefined ? Number(k.h) : h;

                const unlockActive = isUnlockKey(k);
                const gap = 0.05; // Gap between keys in coordinate units

                const hasSecondary = (k.x2 !== undefined || k.y2 !== undefined || k.w2 !== undefined || k.h2 !== undefined);
                
                const keyProps = {
                  key: k.id,
                  rx: 0.08, // Rounded corners in SVG coordinates
                  ry: 0.08,
                  className: unlockActive
                    ? "fill-cyan-500 stroke-cyan-400 stroke-[0.04px] animate-pulse drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] cursor-default"
                    : "fill-slate-800/40 stroke-slate-700/50 stroke-[0.02px] cursor-default"
                };

                if (hasSecondary) {
                  return (
                    <g key={k.id}>
                      <rect x={x + gap} y={y + gap} width={w - gap * 2} height={h - gap * 2} {...keyProps} />
                      <rect x={x2 + gap} y={y2 + gap} width={w2 - gap * 2} height={h2 - gap * 2} {...keyProps} />
                    </g>
                  );
                }

                return (
                  <rect
                    x={x + gap}
                    y={y + gap}
                    width={w - gap * 2}
                    height={h - gap * 2}
                    {...keyProps}
                  />
                );
              })}
            </svg>
          </div>
        )}

        {/* Progress Bar Container */}
        {status === 'holding' && (
          <div className="w-full flex flex-col gap-2">
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1">
              <span>Progress</span>
              <span className="text-cyan-400">{progress}%</span>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {status === 'success' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider text-center animate-pulse">
            Proceeding...
          </div>
        )}

        {/* Failure Banner */}
        {status === 'failed' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider text-center">
            {statusText || 'Unable to authorize writing.'}
          </div>
        )}
      </div>
    </div>
  );
};
