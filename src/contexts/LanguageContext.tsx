import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'vi' | 'en' | 'ja' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isTranslationLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

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

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('domation_lang', lang);
    window.dispatchEvent(new Event('language-change'));
  };

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

  const t = (key: string): string => {
    if (language === 'vi' || !loadedTranslations) return key;
    const dict = loadedTranslations[language];
    return (dict && dict[key]) || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isTranslationLoading }}>
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
