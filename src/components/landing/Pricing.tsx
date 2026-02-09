'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const plans = ['free', 'light', 'pro'] as const;

const planStyles = {
  free: 'border-[var(--border)]',
  light: 'border-blue-200 dark:border-blue-800',
  pro: 'border-purple-300 dark:border-purple-700 ring-2 ring-purple-200 dark:ring-purple-800',
};

export function Pricing() {
  const t = useTranslations('landing.pricing');
  const params = useParams();
  const locale = params.locale as string;

  const handleStart = () => {
    localStorage.setItem('hasVisitedLanding', 'true');
  };

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan}
              className={`relative card p-6 flex flex-col ${planStyles[plan]} ${
                plan === 'pro' ? 'shadow-lg' : ''
              }`}
            >
              {plan === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                    Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-1">
                  {t(`${plan}.name`)}
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  {t(`${plan}.description`)}
                </p>
              </div>

              <div className="text-center mb-6">
                <span className="text-3xl font-bold text-[var(--text-primary)]">
                  {t(`${plan}.price`)}
                </span>
                {plan !== 'free' && (
                  <span className="text-[var(--text-muted)]">/mo</span>
                )}
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {(t.raw(`${plan}.features`) as string[]).map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-[var(--text-secondary)]">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/${locale}/signup`}
                onClick={handleStart}
                className={`w-full py-3 rounded-xl font-medium text-center transition-all ${
                  plan === 'pro'
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {t(`${plan}.name`)}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href={`/${locale}/plans`}
            onClick={handleStart}
            className="text-[var(--primary)] hover:underline"
          >
            {t('viewAll')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
