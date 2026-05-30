'use client';

import React, { useMemo } from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Lock, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { generatePath, getKeyVertices, UNIT } from '@/lib/canvas-utils';
import { useTranslation } from '@/hooks/useTranslation';

export const UnlockModal = () => {
  const { unlockState, keys, settings, cancelDeviceUnlock } = useKeyboardStore();
  const { t } = useTranslation();
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
      const vertices = getKeyVertices(k).map(p => ({ x: p.x / UNIT, y: p.y / UNIT }));
      vertices.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
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
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-[2px] transition-opacity duration-300">
      <div className="relative w-full max-w-xl p-8 overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 transform scale-100 flex flex-col items-center">
        {/* Glow effect backdrops */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />

        {status === 'holding' && (
          <button
            type="button"
            onClick={cancelDeviceUnlock}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/60 text-slate-400 transition-colors hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
            aria-label={t('unlock.cancel')}
            title={t('unlock.cancel')}
          >
            <X size={16} />
          </button>
        )}

        {/* Pulsing Status Icon */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-6 shadow-inner animate-pulse">
          {status === 'holding' && <Lock className="w-8 h-8 text-amber-500" />}
          {status === 'success' && <ShieldCheck className="w-8 h-8 text-emerald-400 animate-bounce" />}
          {status === 'failed' && <ShieldAlert className="w-8 h-8 text-red-400" />}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-100 tracking-wide mb-3 text-center">
          {status === 'holding' && t('unlock.securityRequired')}
          {status === 'success' && t('unlock.deviceUnlocked')}
          {status === 'failed' && t('unlock.failed')}
        </h3>

        {/* Descriptions */}
        <div className="text-center text-xs text-slate-400 max-w-lg mb-8 space-y-2 leading-relaxed font-medium">
          <p>
            {t('unlock.desc')}
          </p>
          <p className="text-[10px] text-slate-500">
            {t('unlock.exitDesc')}
          </p>
        </div>

        {/* Press instruction */}
        {status === 'holding' && (
          <p className="text-xs text-amber-400 font-bold tracking-wider uppercase mb-4 animate-pulse">
            {t('unlock.pressKeys')}
          </p>
        )}

        {/* Dynamic Keyboard Minimap Preview */}
        {visKeys.length > 0 && (
          <div className="w-full bg-slate-950/70 border border-amber-500/10 rounded-xl p-4 mb-6 flex justify-center items-center shadow-inner overflow-hidden max-h-56">
            <svg
              viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
              className="w-full h-auto max-h-48 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              {visKeys.map(k => {
                const unlockActive = isUnlockKey(k);
                const vertices = getKeyVertices(k).map(p => ({ x: p.x / UNIT, y: p.y / UNIT }));
                const pathData = generatePath(vertices, 0.08);
                
                const keyProps = {
                  key: k.id,
                  className: unlockActive
                    ? "fill-amber-500 stroke-amber-300 stroke-[0.04px] animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] cursor-default"
                    : "fill-slate-800/40 stroke-slate-700/50 stroke-[0.02px] cursor-default"
                };

                return (
                  <path
                    d={pathData}
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
                className="h-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-slate-500 uppercase px-1">
              <span>{t('unlock.progress')}</span>
              <span className="text-amber-400">{progress}%</span>
            </div>
            <button
              type="button"
              onClick={cancelDeviceUnlock}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-950/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-slate-500 hover:bg-slate-900 hover:text-slate-100"
            >
              <X size={13} />
              {t('unlock.cancelButton')}
            </button>
          </div>
        )}

        {/* Success Banner */}
        {status === 'success' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider text-center animate-pulse">
            {t('unlock.proceeding')}
          </div>
        )}

        {/* Failure Banner */}
        {status === 'failed' && (
          <div className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider text-center">
            {statusText || t('unlock.unable')}
          </div>
        )}
      </div>
    </div>
  );
};
