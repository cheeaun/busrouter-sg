import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

// These locale JSON files will be *INCLUDED* in this bundle instead of an external fetch
import en from '../i18n/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    debug: /localhost/i.test(location.hostname),
    detection: {
      // localStorage is default
      lookupLocalStorage: 'locale',
    },
    interpolation: {
      escapeValue: false, // not needed for React
    },
  })
  .then(() => {
    i18n.on('languageChanged', () => {
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
