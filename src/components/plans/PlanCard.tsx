'use client';

import { useTranslations } from 'next-intl';
import { TIER_LIMITS, type SubscriptionTier } from '@/types';

interface PlanCardProps {
  tier: SubscriptionTier;
  isCurrentPlan: boolean;
  interval: 'monthly' | 'yearly';
  onSelect: (tier: SubscriptionTier) => void;
  isLoading?: boolean;
  badge?: 'popular' | 'recommended';
}

const TIER_STYLES: Record<SubscriptionTier, { border: string; badge: string; button: string }> = {
  free: {
    border: 'border-[var(--border)]',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    button: 'btn-secondary',
  },
  light: {
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    button: 'btn-primary',
  },
  pro: {
    border: 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-200 dark:ring-purple-800',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    button: 'btn-primary',
  },
  enterprise: {
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    button: 'btn-secondary',
  },
};

export function PlanCard({
  tier,
  isCurrentPlan,
  interval,
  onSelect,
  isLoading,
  badge,
}: PlanCardProps) {
  const t = useTranslations();
  const config = TIER_LIMITS[tier];
  const styles = TIER_STYLES[tier];

  const price = interval === 'monthly' ? config.price.monthly : config.price.yearly;
  const monthlyEquivalent = interval === 'yearly' ? config.price.yearly / 12 : config.price.monthly;

  const getFeatures = () => {
    const features: string[] = [];

    // Enterprise는 커스텀이므로 기능 목록 없음
    if (tier === 'enterprise') {
      return features;
    }

    if (config.usageType === 'daily') {
      features.push(t('plans.features.dailyRequests', { count: config.dailyRequests || 10 }));
    } else {
      features.push(t('plans.features.monthlyCredits', { count: (config.monthlyCredits || 0).toLocaleString() }));
    }

    features.push(t('plans.features.maxInputChars', { count: config.maxInputChars.toLocaleString() }));
    features.push(t('plans.features.contextMessages', { count: config.maxContextMessages }));

    if (config.allowedModelCategories.includes('low')) {
      features.push(t('plans.features.basicModels'));
    }
    if (config.allowedModelCategories.includes('medium')) {
      features.push(t('plans.features.mediumModels'));
    }
    if (config.allowedModelCategories.includes('high')) {
      features.push(t('plans.features.premiumModels'));
    }

    if (config.features.exportConversation) {
      features.push(t('plans.features.exportConversation'));
    }

    if (config.rolloverLimit && config.rolloverLimit > 0) {
      features.push(t('plans.features.creditRollover'));
    }

    return features;
  };

  return (
    <div
      className={`relative card p-6 flex flex-col h-full ${styles.border} ${
        tier === 'pro' ? 'shadow-lg' : ''
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles.badge}`}>
            {t(`plans.${badge}`)}
          </span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            {t('plans.currentPlan')}
          </span>
        </div>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">{config.name}</h3>
        <p className="text-sm text-[var(--text-muted)] h-10 flex items-center justify-center">
          {t(`plans.tierDescriptions.${tier}`)}
        </p>
      </div>

      <div className="text-center mb-6 h-16 flex flex-col justify-center">
        {tier === 'enterprise' ? (
          <div className="text-2xl font-bold text-[var(--text-primary)]">{t('plans.contactAdmin')}</div>
        ) : price === 0 ? (
          <div className="text-3xl font-bold text-[var(--text-primary)]">{t('plans.free')}</div>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold text-[var(--text-primary)]">
                ${monthlyEquivalent.toFixed(2)}
              </span>
              <span className="text-[var(--text-muted)]">{t('plans.perMonth')}</span>
            </div>
            {interval === 'yearly' && (
              <p className="text-sm text-[var(--text-muted)] mt-1">
                ${price.toFixed(2)}{t('plans.perYear')}
              </p>
            )}
          </>
        )}
      </div>

      <ul className="space-y-3 mb-6 flex-1">
        {getFeatures().map((feature, index) => (
          <li key={index} className="flex items-start gap-2 text-sm">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[var(--text-secondary)]">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        disabled={isCurrentPlan || isLoading}
        className={`w-full py-3 rounded-xl font-medium transition-all ${
          isCurrentPlan
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            : tier === 'enterprise'
            ? styles.button
            : styles.button
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {t('plans.processingPayment')}
          </span>
        ) : isCurrentPlan ? (
          t('plans.currentPlan')
        ) : tier === 'enterprise' ? (
          t('plans.contactAdmin')
        ) : (
          t('plans.selectPlan')
        )}
      </button>
    </div>
  );
}
