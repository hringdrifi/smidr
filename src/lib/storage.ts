import { SmidrProject } from '@/types/keyboard';
import { Language } from './i18n';
import { DEFAULT_VISUAL_LAYOUT, normalizeVisualLayout, VisualLayoutId } from './visual-layouts';


const STORAGE_KEY = 'smidr_projects';
const THEME_STORAGE_KEY = 'smidr_theme';
const APP_MODE_STORAGE_KEY = 'smidr_app_mode';
const EDITOR_MODE_STORAGE_KEY = 'smidr_editor_mode';
const VISUAL_LAYOUT_STORAGE_KEY = 'smidr_visual_layout';

export type StoredTheme = 'dark' | 'light';
export type StoredAppMode = 'design' | 'remap';
export type StoredEditorMode = 'layout' | 'matrix' | 'hardware' | 'keymap' | 'rgbMatrix';

export const getStoredTheme = (): StoredTheme | null => {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  if (value === 'dark' || value === 'light') return value;
  return null;
};

export const setStoredTheme = (theme: StoredTheme): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
};

export const getStoredAppMode = (): StoredAppMode => {
  if (typeof window === 'undefined') return 'remap';
  const value = localStorage.getItem(APP_MODE_STORAGE_KEY);
  if (value === 'design' || value === 'remap') return value;
  return 'remap';
};

export const setStoredAppMode = (mode: StoredAppMode): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(APP_MODE_STORAGE_KEY, mode);
};

export const getStoredEditorMode = (): StoredEditorMode => {
  if (typeof window === 'undefined') return 'layout';
  const value = localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
  if (value === 'layout' || value === 'matrix' || value === 'hardware' || value === 'keymap' || value === 'rgbMatrix') return value;
  return 'layout';
};

export const setStoredEditorMode = (mode: StoredEditorMode): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EDITOR_MODE_STORAGE_KEY, mode);
};

export const getStoredVisualLayout = (): VisualLayoutId => {
  if (typeof window === 'undefined') return DEFAULT_VISUAL_LAYOUT;
  return normalizeVisualLayout(localStorage.getItem(VISUAL_LAYOUT_STORAGE_KEY));
};

export const setStoredVisualLayout = (layout: VisualLayoutId): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VISUAL_LAYOUT_STORAGE_KEY, normalizeVisualLayout(layout));
};

export const listProjects = (): SmidrProject[] => {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse projects from localStorage', e);
    return [];
  }
};

export const saveProject = (project: SmidrProject) => {
  const projects = listProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  if (index >= 0) {
    projects[index] = { ...project, updatedAt: Date.now() };
  } else {
    projects.push({ ...project, updatedAt: Date.now() });
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const deleteProject = (id: string) => {
  const projects = listProjects().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getProject = (id: string): SmidrProject | undefined => {
  return listProjects().find(p => p.id === id);
};

const LANGUAGE_STORAGE_KEY = 'smidr_language';

export const getBrowserLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  const navLang = navigator.language || (navigator as any).userLanguage || '';
  const primaryLang = navLang.split('-')[0].toLowerCase();
  const supported: Language[] = ['en', 'zh', 'ko', 'ja', 'es', 'de'];
  if (supported.includes(primaryLang as Language)) {
    return primaryLang as Language;
  }
  return 'en';
};

export const getStoredLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en';
  const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (value === 'en' || value === 'zh' || value === 'ko' || value === 'ja' || value === 'es' || value === 'de') {
    return value as Language;
  }
  return getBrowserLanguage();
};

export const setStoredLanguage = (lang: Language): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
};

const LAYOUT_UNIT_STORAGE_KEY = 'smidr_layout_unit';

export const getStoredLayoutUnit = (): 'u' | 'mm' => {
  if (typeof window === 'undefined') return 'u';
  const value = localStorage.getItem(LAYOUT_UNIT_STORAGE_KEY);
  if (value === 'u' || value === 'mm') return value;
  return 'u';
};

export const setStoredLayoutUnit = (unit: 'u' | 'mm'): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAYOUT_UNIT_STORAGE_KEY, unit);
};
