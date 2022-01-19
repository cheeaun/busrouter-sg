import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// These locale JSON files will be *INCLUDED* in this bundle instead of an external fetch
import en from '../i18n/en.json';
import ms from '../i18n/ms.json';
import zh from '../i18n/zh.json';
import ta from '../i18n/ta.json';
import ja from '../i18n/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      ms: { translation: ms },
      zh: { translation: zh },
      ta: { translation: ta },
      ja: { translation: ja },
    },
    fallbackLng: 'en',
    debug: /localhost/i.test(location.hostname),
    detection: {
      // localStorage is default
      lookupLocalStorage: 'locale',
      lookupCookie: 'locale',
    },
    interpolation: {
      escapeValue: false, // not needed for React
    },
  })
  .then((t) => {
    document.documentElement.lang = i18n.resolvedLanguage;
    i18n.on('languageChanged', () => {
      document.documentElement.lang = i18n.resolvedLanguage;
      document.querySelectorAll('[data-i18n-key]').forEach((el) => {
        if (el.dataset.i18nAttr) {
          el.setAttribute(el.dataset.i18nAttr, t(el.dataset.i18nKey));
        } else {
          el.innerHTML = t(el.dataset.i18n);
        }
      });
    });
  });

export default i18n;
