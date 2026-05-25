'use client';

import { useKeyboardStore } from "@/lib/store";
import { useEffect } from "react";
import { GoogleAnalytics } from "./GoogleAnalytics";

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useKeyboardStore((s) => s.editorSettings.theme);

  useEffect(() => {
    console.log('[System] Debug Mode is', useKeyboardStore.getState().editorSettings.debugMode ? 'ENABLED' : 'DISABLED');
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  return (
    <div className={theme}>
      <GoogleAnalytics />
      {children}
    </div>
  );
}

