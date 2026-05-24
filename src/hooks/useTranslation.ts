import { useKeyboardStore } from '@/lib/store';
import { TRANSLATIONS, Language } from '@/lib/i18n';

export const useTranslation = () => {
  const language = useKeyboardStore(s => s.language);
  
  const t = (path: string) => {
    const keys = path.split('.');
    let result: any = TRANSLATIONS[language];
    
    for (const key of keys) {
      if (result[key] === undefined) {
        // Fallback to English if key missing
        let fallback: any = TRANSLATIONS['en'];
        for (const fkey of keys) {
            if (fallback[fkey] === undefined) return path;
            fallback = fallback[fkey];
        }
        return fallback;
      }
      result = result[key];
    }
    
    return result;
  };

  return { t, language, setLanguage: useKeyboardStore(s => s.setLanguage) };
};
