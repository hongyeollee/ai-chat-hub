'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export function CTA() {
  const t = useTranslations('landing.cta');
  const params = useParams();
  const locale = params.locale as string;

  const handleStart = () => {
    localStorage.setItem('hasVisitedLanding', 'true');
  };

  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--primary-from)] to-[var(--primary-to)] p-12 text-center text-white">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-white rounded-full" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white rounded-full" />
          </div>

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('title')}</h2>
            <p className="text-lg opacity-90 mb-8">{t('subtitle')}</p>

            <Link
              href={`/${locale}/signup`}
              onClick={handleStart}
              className="inline-flex items-center gap-2 bg-white text-[var(--primary)] font-semibold px-8 py-4 rounded-xl hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl"
            >
              {t('button')}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>

            <p className="mt-6 text-sm opacity-80">
              {t('login')}{' '}
              <Link
                href={`/${locale}/login`}
                onClick={handleStart}
                className="underline hover:opacity-100"
              >
                {t('loginLink')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
