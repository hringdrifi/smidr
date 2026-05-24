export const THEME_COLORS = {
  dark: {
    bgKey: '#27272a',     // zinc-800
    bgKeyTop: '#3f3f46',  // zinc-700
    accent: '#f59e0b',    // amber-500
    border: '#52525b',    // zinc-600
    text: '#ffffff',
    grid: 'rgba(255, 255, 255, 0.15)'
  },
  light: {
    bgKey: '#e4e4e7',     // zinc-200
    bgKeyTop: '#f4f4f5',  // zinc-100
    accent: '#f59e0b',    // amber-500
    border: '#d4d4d8',    // zinc-300
    text: '#18181b',      // zinc-900
    grid: 'rgba(0, 0, 0, 0.1)'
  }
} as const;

export type ThemeType = 'dark' | 'light';
