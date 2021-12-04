import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useTranslation, Trans } from 'react-i18next';

export default function About() {
  const { t, i18n } = useTranslation();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const intro = localStorage.getItem('busroutersg.about');
      if (intro !== 'true') setHidden(false);
    } catch (e) {}

    const $logo = document.getElementById('logo');
    if ($logo) {
      $logo.onclick = (e) => {
        e.preventDefault();
        setHidden(!hidden);
      };
    }
  }, []);

  return (
    <div id="about" hidden={hidden} onClick={() => setHidden(true)}>
      <section onClick={(e) => e.stopPropagation()}>
        <h2>
          {t('app.name')}
          <br />
          <small>{t('app.shortDescription')}</small>
        </h2>
        <p>{t('app.description')}</p>
        <label id="locale-selector">
          <select
            onchange={(e) => {
              const lang = e.target.value;
              i18n.changeLanguage(lang);
            }}
            defaultValue={i18n.language}
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
          </select>
          <a href="https://crwd.in/busrouter-sg" target="_blank">
            <small>{t('about.helpTranslations')}</small>
          </a>
        </label>
        <hr />
        <p>
          <Trans i18nKey="about.disclaimerCopyright">
            <a
              href="https://github.com/cheeaun/busrouter-sg"
              target="_blank"
              rel="noopener"
            >
              Built
            </a>
            &
            <a href="/visualization/" target="_blank" rel="noopener">
              visualized
            </a>
            by
            <a href="http://twitter.com/cheeaun" target="_blank" rel="noopener">
              @cheeaun
            </a>
            . Data
            <a
              href="http://www.mytransport.sg/"
              target="_blank"
              rel="noopener"
              title="Land Transport Authority"
            >
              &copy; LTA
            </a>
            .
          </Trans>
        </p>
        <p>
          <Trans i18nKey="about.sisterSites">
            Sister sites:
            <a href="https://railrouter.sg/" target="_blank" rel="noopener">
              🚆 RailRouter SG
            </a>{' '}
            <a href="https://taxirouter.sg/" target="_blank" rel="noopener">
              🚖 TaxiRouter SG
            </a>
          </Trans>
        </p>
        <p>
          <a
            class="donation-box"
            href="https://www.buymeacoffee.com/cheeaun"
            target="_blank"
            rel="noopener"
          >
            {t('about.liking')}
            <br />
            {t('about.treatCoffee')}
          </a>
        </p>
        <div class="popover-buttons">
          <button
            class="popover-button"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem('busroutersg.about', 'true');
              } catch (e) {}
            }}
          >
            {t('about.explore')}
          </button>
        </div>
      </section>
    </div>
  );
}
