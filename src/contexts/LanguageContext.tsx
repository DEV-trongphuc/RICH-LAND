import React, { createContext, useContext, useCallback, useMemo } from 'react';

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
  const t = useCallback((key: string): string => {
    return viOverrides[key] || key;
  }, []);

  const contextValue = useMemo(() => ({
    language: 'vi' as Language,
    setLanguage: () => {},
    t,
    isTranslationLoading: false
  }), [t]);

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
