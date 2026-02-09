'use client';

import { useTranslations } from 'next-intl';

const models = [
  {
    key: 'gpt',
    color: 'from-green-400 to-emerald-600',
    icon: '✦',
  },
  {
    key: 'claude',
    color: 'from-orange-400 to-amber-600',
    icon: '◈',
  },
  {
    key: 'gemini',
    color: 'from-blue-400 to-indigo-600',
    icon: '◇',
  },
  {
    key: 'deepseek',
    color: 'from-cyan-400 to-teal-600',
    icon: '◆',
  },
  {
    key: 'mistral',
    color: 'from-purple-400 to-violet-600',
    icon: '◎',
  },
];

export function ModelShowcase() {
  const t = useTranslations('landing.models');

  return (
    <section className="py-24 px-4 bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {models.map((model) => (
            <div
              key={model.key}
              className="group relative p-6 rounded-2xl bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary-light)] transition-all duration-300 hover:shadow-lg"
            >
              <div
                className={`w-12 h-12 mb-4 rounded-xl bg-gradient-to-br ${model.color} flex items-center justify-center text-white text-xl font-bold`}
              >
                {model.icon}
              </div>
              <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                {t(`${model.key}.name`)}
              </h3>
              <p className="text-sm text-[var(--text-muted)]">
                {t(`${model.key}.description`)}
              </p>
            </div>
          ))}
        </div>

        <p className="text-center mt-8 text-[var(--text-muted)]">{t('andMore')}</p>
      </div>
    </section>
  );
}
