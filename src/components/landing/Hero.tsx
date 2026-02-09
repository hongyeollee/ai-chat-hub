'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export function Hero() {
  const t = useTranslations('landing.hero');
  const params = useParams();
  const locale = params.locale as string;

  const handleStart = () => {
    localStorage.setItem('hasVisitedLanding', 'true');
  };

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-bg opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--background)]" />

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
          <span className="text-[var(--text-primary)]">{t('title')}</span>
          <br />
          <span className="text-gradient">{t('titleHighlight')}</span>
        </h1>

        <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10">
          {t('subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href={`/${locale}/signup`}
            onClick={handleStart}
            className="btn-primary text-lg px-8 py-4 rounded-xl inline-flex items-center justify-center gap-2"
          >
            {t('cta')}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="#features"
            className="btn-secondary text-lg px-8 py-4 rounded-xl inline-flex items-center justify-center"
          >
            {t('secondaryCta')}
          </a>
        </div>
      </div>
    </section>
  );
}
