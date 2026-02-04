'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SettingsCard, SettingsField } from './SettingsCard';
import type { Profile } from '@/types';

interface ProfileSectionProps {
  profile: Profile;
  onUpdate: (updates: Partial<Profile>) => Promise<boolean>;
}

const TIMEZONES = [
  { value: 'Asia/Seoul', label: 'Seoul (UTC+9)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { value: 'America/New_York', label: 'New York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8)' },
  { value: 'Europe/London', label: 'London (UTC+0)' },
  { value: 'Europe/Paris', label: 'Paris (UTC+1)' },
  { value: 'UTC', label: 'UTC' },
];

const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

export function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
  const t = useTranslations();
  const [name, setName] = useState(profile.name || '');
  const [language, setLanguage] = useState(profile.language || 'ko');
  const [timezone, setTimezone] = useState(profile.timezone || 'Asia/Seoul');
  const [marketingAgreed, setMarketingAgreed] = useState(profile.marketing_agreed || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      name,
      language,
      timezone,
      marketing_agreed: marketingAgreed,
    });
    setIsSaving(false);
  };

  const hasChanges =
    name !== (profile.name || '') ||
    language !== (profile.language || 'ko') ||
    timezone !== (profile.timezone || 'Asia/Seoul') ||
    marketingAgreed !== (profile.marketing_agreed || false);

  return (
    <SettingsCard
      title={t('settings.profile')}
      description={t('settings.profileDescription')}
      action={
        hasChanges && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            {isSaving ? t('common.loading') : t('common.save')}
          </button>
        )
      }
    >
      <SettingsField label={t('profile.name')}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('profile.namePlaceholder')}
          className="input"
        />
      </SettingsField>

      <SettingsField label={t('profile.email')}>
        <input
          type="email"
          value={profile.email || ''}
          disabled
          className="input opacity-60 cursor-not-allowed"
        />
      </SettingsField>

      <SettingsField label={t('profile.language')}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="input"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </SettingsField>

      <SettingsField label={t('profile.timezone')}>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="input"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </SettingsField>

      <SettingsField
        label={t('profile.marketingConsent')}
        description={t('profile.marketingDescription')}
        horizontal
      >
        <button
          onClick={() => setMarketingAgreed(!marketingAgreed)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            marketingAgreed ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={marketingAgreed}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              marketingAgreed ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </SettingsField>
    </SettingsCard>
  );
}
