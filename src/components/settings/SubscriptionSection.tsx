'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { SettingsCard } from './SettingsCard';
import { TIER_LIMITS, type SubscriptionTier } from '@/types';

interface SubscriptionData {
  tier: SubscriptionTier;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

interface SubscriptionSectionProps {
  data: SubscriptionData | null;
  isLoading: boolean;
}

const TIER_BADGES: Record<SubscriptionTier, { bg: string; text: string }> = {
  free: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' },
  light: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
  pro: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
  enterprise: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-700 dark:text-amber-300' },
};

export function SubscriptionSection({ data, isLoading }: SubscriptionSectionProps) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'ko';

  const handleUpgradeClick = () => {
    router.push(`/${currentLocale}/plans`);
  };

  const handleManageClick = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });
      const result = await response.json();
      if (result.success && result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
    }
  };

  if (isLoading) {
    return (
      <SettingsCard title={t('settings.subscription')} description={t('settings.subscriptionDescription')}>
        <div className="space-y-3">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-4 w-36" />
        </div>
      </SettingsCard>
    );
  }

  const tier = data?.tier || 'free';
  const tierConfig = TIER_LIMITS[tier];
  const badge = TIER_BADGES[tier];

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <SettingsCard
      title={t('settings.subscription')}
      description={t('settings.subscriptionDescription')}
      action={
        <div className="flex gap-2">
          {tier !== 'free' && (
            <button
              onClick={handleManageClick}
              className="btn-secondary text-sm px-4 py-2"
            >
              {t('subscription.manage')}
            </button>
          )}
          <button
            onClick={handleUpgradeClick}
            className="btn-primary text-sm px-4 py-2"
          >
            {tier === 'free' ? t('subscription.upgrade') : t('plans.compareFeatures')}
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-[var(--text-secondary)]">{t('subscription.currentPlan')}</span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
          {tierConfig.name}
        </span>
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-4">{tierConfig.description}</p>

      {data?.subscription && tier !== 'free' && (
        <div className="space-y-2 text-sm">
          {data.subscription.currentPeriodEnd && (
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">{t('subscription.nextBilling')}</span>
              <span className="text-[var(--text-primary)]">
                {formatDate(data.subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
          {data.subscription.cancelAtPeriodEnd && (
            <p className="text-amber-600 dark:text-amber-400 text-sm">
              {t('subscription.cancelAtPeriodEnd')}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
          {t('subscription.features')}
        </h4>
        <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {tier === 'free'
              ? `${tierConfig.dailyRequests} requests/day`
              : `${tierConfig.monthlyCredits} credits/month`}
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {tierConfig.maxInputChars.toLocaleString()} chars max input
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {tierConfig.maxContextMessages} context messages
          </li>
          {tierConfig.features.exportConversation && (
            <li className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Export conversations
            </li>
          )}
        </ul>
      </div>
    </SettingsCard>
  );
}
