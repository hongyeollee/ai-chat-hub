'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';

export function Header() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const fetchedRef = useRef(false);

  const currentLocale = pathname.split('/')[1] || 'ko';

  const fetchUsage = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const response = await fetch('/api/usage/today');
      const result = await response.json();
      if (result.success) {
        setRemainingRequests(result.data.remainingRequests);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // onAuthStateChange fires immediately with current state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        fetchUsage();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUsage]);

  useEffect(() => {
    const handleUsageUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ remainingRequests?: number }>;
      if (typeof customEvent.detail?.remainingRequests === 'number') {
        setRemainingRequests(customEvent.detail.remainingRequests);
      }
    };

    window.addEventListener('usage-update', handleUsageUpdate as EventListener);

    return () => {
      window.removeEventListener('usage-update', handleUsageUpdate as EventListener);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${currentLocale}/login`);
  };

  const toggleLocale = () => {
    const newLocale = currentLocale === 'ko' ? 'en' : 'ko';
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('common.appName')}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {isLoggedIn && remainingRequests !== null && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('usage.remaining')}: {t('usage.requests', { count: remainingRequests })}
          </div>
        )}

        <ThemeToggle />

        <button
          onClick={toggleLocale}
          className="text-sm px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {currentLocale === 'ko' ? 'EN' : '한'}
        </button>

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {t('auth.logout')}
          </button>
        )}
      </div>
    </header>
  );
}
