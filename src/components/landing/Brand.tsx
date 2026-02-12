'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

export function Brand() {
  const t = useTranslations('landing.brand');

  return (
    <section className="py-24 px-4 bg-[var(--surface)]">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="Nexuan Logo"
            width={80}
            height={80}
            className="drop-shadow-md"
          />
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
          <span className="text-[var(--text-primary)]">{t('title')}</span>
          <br />
          <span className="text-gradient">{t('titleHighlight')}</span>
        </h2>

        <p className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
          {t('description')}
        </p>
      </div>
    </section>
  );
}
