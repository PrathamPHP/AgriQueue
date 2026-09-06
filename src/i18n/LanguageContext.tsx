import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LanguageCode } from '@/types';
import { translations } from './translations';
import { storageService } from '@/services/storageService';
import { dataStore } from '@/services/dataStore';

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = storageService.get<string>('languagePref', 'en');
    if (saved === 'hi' || saved === 'kn') {
      return saved as LanguageCode;
    }
    return 'en';
  });

  const setLanguage = useCallback((newLang: LanguageCode) => {
    setLanguageState(newLang);
    storageService.set('languagePref', newLang);

    // Sync with currently logged-in farmer if applicable
    const currentFarmer = dataStore.getCurrentFarmer();
    if (currentFarmer && currentFarmer.languagePref !== newLang) {
      currentFarmer.languagePref = newLang;
      dataStore.notify();
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const langDict = translations[language] || translations.en;
      if (langDict && langDict[key]) {
        return langDict[key];
      }
      const enDict = translations.en;
      if (enDict && enDict[key]) {
        return enDict[key];
      }
      return fallback || key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t, language, setLanguage } = useLanguage();
  return { t, language, setLanguage };
};
