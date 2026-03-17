import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ja from './locales/ja.ts';
import en from './locales/en.ts';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ja, en },
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'closures_bar_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
