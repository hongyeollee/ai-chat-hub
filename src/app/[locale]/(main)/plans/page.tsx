'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { PlanCard } from '@/components/plans/PlanCard';
import { type SubscriptionTier, isWithdrawalRightCountry } from '@/types';

interface SubscriptionData {
  tier: SubscriptionTier;
  countryCode: string | null;
}

export default function PlansPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null);
  const [showWithdrawalConsent, setShowWithdrawalConsent] = useState(false);
  const [withdrawalConsent, setWithdrawalConsent] = useState(false);
  const [pendingTier, setPendingTier] = useState<SubscriptionTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Enterprise 문의 모달 상태
  const [showEnterpriseModal, setShowEnterpriseModal] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState({
    companyName: '',
    teamSize: '',
    purpose: '',
    additionalInfo: '',
  });
  const [isSubmittingEnterprise, setIsSubmittingEnterprise] = useState(false);
  const [enterpriseSuccess, setEnterpriseSuccess] = useState(false);

  const currentLocale = pathname.split('/')[1] || 'ko';

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/subscription');
      const result = await response.json();
      if (result.success) {
        setSubscription({
          tier: result.data.tier,
          countryCode: result.data.countryCode,
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (!subscription) return;

    // Free 티어로 다운그레이드하는 경우 - Customer Portal로 이동
    if (tier === 'free' && subscription.tier !== 'free') {
      await openCustomerPortal();
      return;
    }

    // 현재 플랜이면 무시
    if (tier === subscription.tier) return;

    // Enterprise는 문의 모달 표시
    if (tier === 'enterprise') {
      setShowEnterpriseModal(true);
      setEnterpriseSuccess(false);
      return;
    }

    // EU/UK 사용자인 경우 철회권 동의 필요
    if (isWithdrawalRightCountry(subscription.countryCode)) {
      setPendingTier(tier);
      setShowWithdrawalConsent(true);
      return;
    }

    // 결제 진행
    await processCheckout(tier, false);
  };

  const processCheckout = async (tier: SubscriptionTier, consent: boolean) => {
    setProcessingTier(tier);
    setError(null);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          interval,
          withdrawalConsent: consent,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        window.location.href = result.data.url;
      } else {
        setError(result.error || 'Failed to create checkout session');
        setProcessingTier(null);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setError('An error occurred. Please try again.');
      setProcessingTier(null);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        window.location.href = result.data.url;
      } else {
        setError(result.error || 'Failed to open customer portal');
      }
    } catch (error) {
      console.error('Portal error:', error);
      setError('An error occurred. Please try again.');
    }
  };

  const handleWithdrawalConsentConfirm = () => {
    if (pendingTier && withdrawalConsent) {
      setShowWithdrawalConsent(false);
      processCheckout(pendingTier, true);
    }
  };

  const handleEnterpriseSubmit = async () => {
    if (!enterpriseForm.companyName || !enterpriseForm.teamSize || !enterpriseForm.purpose) {
      return;
    }

    setIsSubmittingEnterprise(true);
    setError(null);

    try {
      const response = await fetch('/api/contact/enterprise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enterpriseForm),
      });

      const result = await response.json();

      if (result.success) {
        setEnterpriseSuccess(true);
        setEnterpriseForm({
          companyName: '',
          teamSize: '',
          purpose: '',
          additionalInfo: '',
        });
      } else {
        setError(result.error || t('plans.enterpriseInquiry.error'));
      }
    } catch (error) {
      console.error('Enterprise inquiry error:', error);
      setError(t('plans.enterpriseInquiry.error'));
    } finally {
      setIsSubmittingEnterprise(false);
    }
  };

  const closeEnterpriseModal = () => {
    setShowEnterpriseModal(false);
    setEnterpriseSuccess(false);
    setEnterpriseForm({
      companyName: '',
      teamSize: '',
      purpose: '',
      additionalInfo: '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 bg-[var(--background)]">
        <div className="max-w-5xl mx-auto">
          <div className="skeleton h-10 w-48 mx-auto mb-4" />
          <div className="skeleton h-6 w-64 mx-auto mb-8" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-6 space-y-4">
                <div className="skeleton h-6 w-24 mx-auto" />
                <div className="skeleton h-10 w-32 mx-auto" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="skeleton h-4 w-full" />
                  ))}
                </div>
                <div className="skeleton h-12 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const tiers: SubscriptionTier[] = ['free', 'light', 'pro', 'enterprise'];

  return (
    <div className="flex-1 overflow-auto p-6 bg-[var(--background)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            {t('plans.title')}
          </h1>
          <p className="text-[var(--text-secondary)]">{t('plans.subtitle')}</p>
        </div>

        {/* Interval Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                interval === 'monthly'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('plans.monthly')}
            </button>
            <button
              onClick={() => setInterval('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                interval === 'yearly'
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t('plans.yearly')}
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {t('plans.yearlyDiscount')}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 items-stretch">
          {tiers.map((tier) => (
            <PlanCard
              key={tier}
              tier={tier}
              isCurrentPlan={tier === currentTier}
              interval={interval}
              onSelect={handleSelectPlan}
              isLoading={processingTier === tier}
              badge={tier === 'pro' ? 'popular' : undefined}
            />
          ))}
        </div>

        {/* Manage Subscription Link */}
        {currentTier !== 'free' && (
          <div className="text-center">
            <button
              onClick={openCustomerPortal}
              className="text-[var(--primary)] hover:underline text-sm"
            >
              {t('plans.managePlan')}
            </button>
          </div>
        )}

        {/* Withdrawal Consent Modal */}
        {showWithdrawalConsent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl p-6 max-w-md w-full animate-fade-in">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {t('plans.withdrawalConsent')}
              </h3>

              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withdrawalConsent}
                  onChange={(e) => setWithdrawalConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">
                  {t('plans.withdrawalConsent')}
                </span>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWithdrawalConsent(false);
                    setPendingTier(null);
                    setWithdrawalConsent(false);
                  }}
                  className="flex-1 btn-secondary py-2"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleWithdrawalConsentConfirm}
                  disabled={!withdrawalConsent}
                  className="flex-1 btn-primary py-2 disabled:opacity-50"
                >
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enterprise Inquiry Modal */}
        {showEnterpriseModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--surface)] rounded-2xl p-6 max-w-lg w-full animate-fade-in max-h-[90vh] overflow-y-auto">
              {enterpriseSuccess ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    {t('plans.enterpriseInquiry.success')}
                  </h3>
                  <button
                    onClick={closeEnterpriseModal}
                    className="btn-primary mt-4 px-6 py-2"
                  >
                    {t('common.close')}
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    {t('plans.enterpriseInquiry.title')}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] mb-6">
                    {t('plans.enterpriseInquiry.description')}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        {t('plans.enterpriseInquiry.companyName')} *
                      </label>
                      <input
                        type="text"
                        value={enterpriseForm.companyName}
                        onChange={(e) => setEnterpriseForm({ ...enterpriseForm, companyName: e.target.value })}
                        placeholder={t('plans.enterpriseInquiry.companyNamePlaceholder')}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        {t('plans.enterpriseInquiry.teamSize')} *
                      </label>
                      <input
                        type="text"
                        value={enterpriseForm.teamSize}
                        onChange={(e) => setEnterpriseForm({ ...enterpriseForm, teamSize: e.target.value })}
                        placeholder={t('plans.enterpriseInquiry.teamSizePlaceholder')}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        {t('plans.enterpriseInquiry.purpose')} *
                      </label>
                      <textarea
                        value={enterpriseForm.purpose}
                        onChange={(e) => setEnterpriseForm({ ...enterpriseForm, purpose: e.target.value })}
                        placeholder={t('plans.enterpriseInquiry.purposePlaceholder')}
                        rows={3}
                        className="input resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                        {t('plans.enterpriseInquiry.additionalInfo')}
                      </label>
                      <textarea
                        value={enterpriseForm.additionalInfo}
                        onChange={(e) => setEnterpriseForm({ ...enterpriseForm, additionalInfo: e.target.value })}
                        placeholder={t('plans.enterpriseInquiry.additionalInfoPlaceholder')}
                        rows={2}
                        className="input resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={closeEnterpriseModal}
                      className="flex-1 btn-secondary py-2"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleEnterpriseSubmit}
                      disabled={isSubmittingEnterprise || !enterpriseForm.companyName || !enterpriseForm.teamSize || !enterpriseForm.purpose}
                      className="flex-1 btn-primary py-2 disabled:opacity-50"
                    >
                      {isSubmittingEnterprise ? t('plans.enterpriseInquiry.submitting') : t('plans.enterpriseInquiry.submit')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
