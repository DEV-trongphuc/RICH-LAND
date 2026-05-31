import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

type Language = 'vi' | 'en' | 'ja' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isTranslationLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const viOverrides: Record<string, string> = {
  "Hoạt động (Nhật ký)": "Hoạt động"
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('domation_lang') as Language) || 'vi';
  });

  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, Record<string, string>> | null>(null);
  const [isTranslationLoading, setIsTranslationLoading] = useState(false);

  // Lazy-load translations bundle on-demand
  useEffect(() => {
    if (language === 'vi') {
      setIsTranslationLoading(false);
      return;
    }

    if (loadedTranslations) {
      setIsTranslationLoading(false);
      return;
    }

    setIsTranslationLoading(true);
    import('../utils/translations')
      .then((module) => {
        setLoadedTranslations({
          en: module.en,
          ja: module.ja,
          zh: module.zh,
        });
        setIsTranslationLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load translations dynamically:', err);
        setIsTranslationLoading(false);
      });
  }, [language, loadedTranslations]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('domation_lang', lang);
    window.dispatchEvent(new Event('language-change'));
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const storedLang = (localStorage.getItem('domation_lang') as Language) || 'vi';
      if (storedLang !== language) {
        setLanguageState(storedLang);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [language]);

  const t = useCallback((key: string): string => {
    if (language === 'vi') {
      return viOverrides[key] || key;
    }
    if (!loadedTranslations) return key;
    const dict = loadedTranslations[language];
    return (dict && dict[key]) || key;
  }, [language, loadedTranslations]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t,
    isTranslationLoading
  }), [language, setLanguage, t, isTranslationLoading]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
