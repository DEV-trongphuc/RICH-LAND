import React, { createContext, useContext, useState, useEffect } from 'react';
import { en, ja, zh } from '../utils/translations';

type Language = 'vi' | 'en' | 'ja' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('domation_lang') as Language) || 'vi';
  });

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
    if (language === 'vi') return key;
    if (language === 'en') return en[key] || key;
    if (language === 'ja') return ja[key] || key;
    if (language === 'zh') return zh[key] || key;
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
