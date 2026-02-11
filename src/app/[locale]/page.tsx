'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Hero, Features, ModelShowcase, Pricing, CTA } from '@/components/landing';

export default function LandingPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const handleStart = () => {
    localStorage.setItem('hasVisitedLanding', 'true');
  };

  const toggleLocale = () => {
    const newLocale = locale === 'ko' ? 'en' : 'ko';
    router.push(`/${newLocale}`);
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <Image src="/logo.png" alt="Nexuan" width={32} height={32} />
            <span className="text-xl font-bold text-gradient">{t('common.appName')}</span>
          </Link>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={toggleLocale}
              className="text-sm px-2 py-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              {locale === 'ko' ? 'EN' : '한'}
            </button>
            <Link
              href={`/${locale}/login`}
              onClick={handleStart}
              className="btn-ghost text-sm"
            >
              {t('auth.login')}
            </Link>
            <Link
              href={`/${locale}/signup`}
              onClick={handleStart}
              className="btn-primary text-sm px-4 py-2"
            >
              {t('auth.signup')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-16">
        <Hero />
        <Features />
        <ModelShowcase />
        <Pricing />
        <CTA />
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            © 2026 {t('common.appName')}. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {t('landing.footer.terms')}
            </a>
            <a href="#" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {t('landing.footer.privacy')}
            </a>
            <a href="mailto:zeler1005@gmail.com" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              {t('landing.footer.contact')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
