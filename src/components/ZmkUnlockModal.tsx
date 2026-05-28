'use client';

import React from 'react';
import { useKeyboardStore } from '@/lib/store';
import { Lock, RefreshCw, X } from 'lucide-react';

export const ZmkUnlockModal = () => {
  const { zmkLocked, syncKeymap, setZmkLocked, appMode } = useKeyboardStore();

  if (appMode !== 'remap' || !zmkLocked) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-[2px] transition-opacity duration-300">
      <div className="relative w-full max-w-md p-8 overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/95 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 transform scale-100 flex flex-col items-center">
        {/* Glow effect backdrops */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />

        {/* Close Button */}
        <button
          onClick={() => setZmkLocked(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          title="Dismiss"
        >
          <X size={16} />
        </button>

        {/* Pulsing Lock Icon */}
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-6 shadow-inner animate-pulse">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-100 tracking-wide mb-3 text-center">
          ZMK Studio is Locked
        </h3>

        {/* Description */}
        <div className="text-center text-xs text-slate-400 max-w-sm mb-8 leading-relaxed font-medium space-y-2">
          <p>
            Please physically press the <span className="text-amber-400 font-semibold">&ldquo;Studio Unlock&rdquo;</span> key combination on your physical keyboard to authorize keymap editing.
          </p>
          <p className="text-[10px] text-slate-500">
            Once pressed, click the Sync button below to load and customize your keymaps.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => syncKeymap()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 transition-all text-black text-xs font-bold rounded-xl shadow-lg cursor-pointer"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            Check again & Sync
          </button>
          
          <button
            onClick={() => setZmkLocked(false)}
            className="w-full py-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
          >
            Explore in Layout-only Mode
          </button>
        </div>
      </div>
    </div>
  );
};
