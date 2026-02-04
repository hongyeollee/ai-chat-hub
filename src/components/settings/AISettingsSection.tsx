'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SettingsCard, SettingsField } from './SettingsCard';
import { getAllowedModelsForTier, AI_MODEL_INFO, type Profile, type AIModel, type SubscriptionTier } from '@/types';

interface AISettingsSectionProps {
  profile: Profile;
  onUpdate: (updates: Partial<Profile>) => Promise<boolean>;
}

export function AISettingsSection({ profile, onUpdate }: AISettingsSectionProps) {
  const t = useTranslations();
  const [preferredModel, setPreferredModel] = useState<AIModel>(profile.preferred_model || 'gpt-4o-mini');
  const [memoryEnabled, setMemoryEnabled] = useState(profile.memory_enabled ?? true);
  const [customInstructions, setCustomInstructions] = useState(profile.custom_instructions || '');
  const [isSaving, setIsSaving] = useState(false);

  const tier = profile.subscription_tier || 'free';
  const allowedModels = getAllowedModelsForTier(tier);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdate({
      preferred_model: preferredModel,
      memory_enabled: memoryEnabled,
      custom_instructions: customInstructions || null,
    });
    setIsSaving(false);
  };

  const hasChanges =
    preferredModel !== (profile.preferred_model || 'gpt-4o-mini') ||
    memoryEnabled !== (profile.memory_enabled ?? true) ||
    customInstructions !== (profile.custom_instructions || '');

  return (
    <SettingsCard
      title={t('settings.aiSettings')}
      description={t('settings.aiSettingsDescription')}
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
      <SettingsField
        label={t('aiSettings.preferredModel')}
        description={t('aiSettings.preferredModelDescription')}
      >
        <div className="flex flex-wrap gap-2 mt-2">
          {allowedModels.map((model) => {
            const modelInfo = AI_MODEL_INFO[model];
            const isSelected = preferredModel === model;
            return (
              <button
                key={model}
                onClick={() => setPreferredModel(model)}
                className={`model-chip ${isSelected ? 'active' : ''}`}
              >
                <span className="mr-1">{modelInfo.icon}</span>
                {modelInfo.name}
              </button>
            );
          })}
        </div>
      </SettingsField>

      <SettingsField
        label={t('aiSettings.memoryEnabled')}
        description={t('aiSettings.memoryDescription')}
        horizontal
      >
        <button
          onClick={() => setMemoryEnabled(!memoryEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            memoryEnabled ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-600'
          }`}
          role="switch"
          aria-checked={memoryEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              memoryEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </SettingsField>

      <SettingsField
        label={t('aiSettings.customInstructions')}
        description={t('aiSettings.customInstructionsDescription')}
      >
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder={t('aiSettings.customInstructionsPlaceholder')}
          rows={4}
          className="input resize-none"
        />
      </SettingsField>
    </SettingsCard>
  );
}
