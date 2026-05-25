import { useEffect } from 'react';
import { useKeyboardStore } from '@/lib/store';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export function GoogleAnalytics() {
  const appMode = useKeyboardStore((s) => s.appMode);
  const editorMode = useKeyboardStore((s) => s.editorMode);

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  // 1. Dynamic Script Injection
  useEffect(() => {
    if (!measurementId) return;

    const scriptId = 'google-analytics-gtag';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };

      window.gtag('js', new Date());
      window.gtag('config', measurementId, {
        send_page_view: false, // Prevent duplicate automatic page view on script initialization
      });
    }
  }, [measurementId]);

  // 2. Track Mode Changes as Virtual Pageviews
  useEffect(() => {
    if (!measurementId || typeof window.gtag !== 'function') return;

    let pagePath = '/';
    let pageTitle = 'Smiðr';

    if (appMode === 'remap') {
      pagePath = '/remap';
      pageTitle = 'Smiðr - Remap Mode';
    } else if (appMode === 'design') {
      pagePath = `/design/${editorMode}`;
      const capitalizedMode = editorMode.charAt(0).toUpperCase() + editorMode.slice(1);
      pageTitle = `Smiðr - Design Mode (${capitalizedMode})`;
    }

    // Send page_view event to Google Analytics
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
    console.log(`[Analytics] Tracked pageview: ${pagePath} - ${pageTitle}`);
  }, [appMode, editorMode, measurementId]);

  return null;
}
