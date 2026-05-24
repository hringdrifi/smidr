import { SmidrProject } from '@/types/keyboard';
import { Language } from './i18n';


const STORAGE_KEY = 'smidr_projects';
const THEME_STORAGE_KEY = 'smidr_theme';

export type StoredTheme = 'dark' | 'light';

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

