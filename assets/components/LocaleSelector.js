import { h } from 'preact';
import { useTranslation } from 'react-i18next';

export default function LocaleSelector() {
  const { t, i18n } = useTranslation();
  return (
    <label id="locale-selector">
      🌐{' '}
      <select
        onchange={(e) => {
          const lang = e.target.value;
          i18n.changeLanguage(lang);
        }}
        defaultValue={i18n.resolvedLanguage}
      >
        <option value="en">English</option>
        <option value="zh" lang="zh">
          中文
        </option>
        <option value="ms" lang="ms">
          Bahasa Melayu
        </option>
        <option value="ta" lang="ta">
          தமிழ்
        </option>
      </select>{' '}
      <a
        href="https://github.com/cheeaun/busrouter-sg/discussions/54"
        target="_blank"
      >
        <small>{t('about.helpTranslations')}</small>
      </a>
    </label>
  );
}
