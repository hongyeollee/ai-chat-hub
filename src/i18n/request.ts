import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';

export const locales = ['ko', 'en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !hasLocale(locales, locale)) {
    locale = 'ko';
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
