'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { SettingsCard } from './SettingsCard';

interface UsageData {
  usageType: 'daily' | 'credits';
  tier: string;
  daily?: {
    requestsUsed: number;
    requestsRemaining: number;
    requestsMax: number;
    charsUsed: number;
    charsMax: number;
  };
  credits?: {
    available: number;
    total: number;
    used: number;
    base: number;
    rollover: number;
    purchased: number;
  };
}

interface UsageSectionProps {
  data: UsageData | null;
  isLoading: boolean;
}

// 티어별 크레딧 가격 (USD per 1,000 credits)
const CREDIT_PRICES: Record<string, number> = {
  light: 2.99,
  pro: 1.99,
};

export function UsageSection({ data, isLoading }: UsageSectionProps) {
  const t = useTranslations();
  const router = useRouter();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pricePerUnit = data?.tier ? CREDIT_PRICES[data.tier] || 0 : 0;
  const totalCredits = quantity * 1000;
  const totalPrice = (pricePerUnit * quantity).toFixed(2);

  const handleOpenPurchaseModal = () => {
    setQuantity(1);
    setError(null);
    setShowPurchaseModal(true);
  };

  const handleClosePurchaseModal = () => {
    setShowPurchaseModal(false);
    setError(null);
  };

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setError(null);

    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        window.location.href = result.data.url;
      } else {
        setError(result.error || 'Failed to create checkout session');
        setIsPurchasing(false);
      }
    } catch (err) {
      console.error('Credit purchase error:', err);
      setError('An error occurred. Please try again.');
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <SettingsCard title={t('settings.usage')} description={t('settings.usageDescription')}>
        <div className="space-y-4">
          <div className="skeleton h-8 w-full" />
          <div className="skeleton h-4 w-48" />
        </div>
      </SettingsCard>
    );
  }

  if (!data) {
    return null;
  }

  const isDaily = data.usageType === 'daily';

  return (
    <SettingsCard
      title={t('settings.usage')}
      description={t('settings.usageDescription')}
      action={
        !isDaily && (
          <button
            onClick={handleOpenPurchaseModal}
            className="btn-secondary text-sm px-4 py-2"
          >
            {t('credits.purchase')}
          </button>
        )
      }
    >
      {isDaily && data.daily ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-secondary)]">{t('credits.dailyRemaining')}</span>
              <span className="font-medium text-[var(--text-primary)]">
                {data.daily.requestsRemaining} / {data.daily.requestsMax}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary-from)] to-[var(--primary-to)] transition-all"
                style={{
                  width: `${(data.daily.requestsRemaining / data.daily.requestsMax) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : data.credits ? (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[var(--text-secondary)]">{t('credits.available')}</span>
              <span className="font-medium text-[var(--text-primary)] text-lg">
                {data.credits.available.toLocaleString()}
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--primary-from)] to-[var(--primary-to)] transition-all"
                style={{
                  width: `${Math.min((data.credits.available / data.credits.total) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t('credits.base')}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {data.credits.base.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t('credits.rollover')}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {data.credits.rollover.toLocaleString()}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[var(--text-muted)] mb-1">{t('credits.purchased')}</p>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {data.credits.purchased.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--border)]">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-muted)]">{t('credits.used')}</span>
              <span className="text-[var(--text-secondary)]">
                {data.credits.used.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Credit Purchase Modal */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-[var(--surface)] rounded-2xl p-6 max-w-md w-full animate-fade-in">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {t('credits.purchaseModal.title')}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {t('credits.purchaseModal.description')}
            </p>

            {data?.tier === 'free' ? (
              <div className="text-center py-4">
                <p className="text-[var(--text-secondary)] mb-4">
                  {t('credits.purchaseModal.freeUserNotice')}
                </p>
                <button
                  onClick={() => {
                    handleClosePurchaseModal();
                    router.push('/plans');
                  }}
                  className="btn-primary px-6 py-2"
                >
                  {t('credits.purchaseModal.upgradeFirst')}
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-secondary)]">
                      {t('credits.purchaseModal.pricePerUnit')}
                    </span>
                    <span className="font-medium text-[var(--text-primary)]">
                      ${pricePerUnit.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm text-[var(--text-secondary)] mb-2">
                      {t('credits.purchaseModal.quantity')}
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-lg font-medium disabled:opacity-50 hover:bg-[var(--background)]"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val >= 1 && val <= 10) setQuantity(val);
                        }}
                        min={1}
                        max={10}
                        className="w-20 text-center input"
                      />
                      <button
                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                        disabled={quantity >= 10}
                        className="w-10 h-10 rounded-lg border border-[var(--border)] flex items-center justify-center text-lg font-medium disabled:opacity-50 hover:bg-[var(--background)]"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--border)] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">
                        {t('credits.purchaseModal.totalCredits')}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] text-lg">
                        {totalCredits.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--text-secondary)]">
                        {t('credits.purchaseModal.totalPrice')}
                      </span>
                      <span className="font-bold text-[var(--primary)] text-xl">
                        ${totalPrice}
                      </span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleClosePurchaseModal}
                    className="flex-1 btn-secondary py-2"
                    disabled={isPurchasing}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="flex-1 btn-primary py-2 disabled:opacity-50"
                  >
                    {isPurchasing ? (
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
                        {t('credits.purchaseModal.processing')}
                      </span>
                    ) : (
                      t('credits.purchaseModal.purchaseButton')
                    )}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={handleClosePurchaseModal}
              className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
