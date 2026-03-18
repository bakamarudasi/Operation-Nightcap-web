import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ja from './locales/ja.ts';
import en from './locales/en.ts';
import zhCN from './locales/zh-CN.ts';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ja, en, 'zh-CN': zhCN },
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

const updateHtmlLang = (lng: string) => {
  document.documentElement.lang = lng;
};

updateHtmlLang(i18n.language);
i18n.on('languageChanged', updateHtmlLang);

export default i18n;
