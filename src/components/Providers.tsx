'use client';

import { useKeyboardStore } from "@/lib/store";
import { useEffect } from "react";
import { GoogleAnalytics } from "./GoogleAnalytics";

type TauriGlobal = {
  core?: {
    invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
};

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useKeyboardStore((s) => s.editorSettings.theme);

  useEffect(() => {
    console.log('[System] Debug Mode is', useKeyboardStore.getState().editorSettings.debugMode ? 'ENABLED' : 'DISABLED');
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);

    const tauri = (window as Window & { __TAURI__?: TauriGlobal }).__TAURI__;
    tauri?.core?.invoke?.('set_window_theme', { dark: theme === 'dark' }).catch((error) => {
      console.warn('[System] Failed to sync native window theme:', error);
    });
  }, [theme]);

  return (
    <div className={theme}>
      <GoogleAnalytics />
      {children}
    </div>
  );
}

