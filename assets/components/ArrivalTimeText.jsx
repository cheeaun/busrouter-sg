import { h } from 'preact';
import { useTranslation } from 'react-i18next';

export default function ArrivalTimeText({ ms }) {
  const { t } = useTranslation();
  if (ms === null) return;
  const mins = Math.floor(ms / 1000 / 60);
  return mins <= 0
    ? t('glossary.arriving')
    : t('glossary.arrivingMinutes', { count: mins });
}
