'use client';

import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { Profile } from '@/types';

interface UsageData {
  usageType: 'daily' | 'credits';
  remainingRequests?: number;
  credits?: {
    available: number;
  };
}

export function Header() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const fetchedRef = useRef(false);

  const currentLocale = pathname.split('/')[1] || 'ko';

  const fetchUsageAndProfile = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const [usageRes, profileRes] = await Promise.all([
        fetch('/api/usage/today'),
        fetch('/api/profile'),
      ]);

      const usageResult = await usageRes.json();
      if (usageResult.success) {
        setUsageData(usageResult.data);
      }

      const profileResult = await profileRes.json();
      if (profileResult.success) {
        setProfile(profileResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
      if (session?.user) {
        fetchUsageAndProfile();
      } else {
        setProfile(null);
        setUsageData(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUsageAndProfile]);

  useEffect(() => {
    const handleUsageUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ remainingRequests?: number; remainingCredits?: number }>;
      if (typeof customEvent.detail?.remainingRequests === 'number') {
        setUsageData(prev => prev ? { ...prev, remainingRequests: customEvent.detail.remainingRequests } : null);
      }
      if (typeof customEvent.detail?.remainingCredits === 'number') {
        setUsageData(prev => prev ? {
          ...prev,
          credits: { available: customEvent.detail.remainingCredits! }
        } : null);
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
        <Link
          href={`/${currentLocale}`}
          className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <Image
            src="/logo-header.png"
            alt="Nexuan"
            width={28}
            height={28}
            className="rounded-md"
          />
          {t('common.appName')}
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {isLoggedIn && usageData && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {usageData.usageType === 'daily' ? (
              <>
                {t('usage.remaining')}: {t('usage.requests', { count: usageData.remainingRequests ?? 0 })}
              </>
            ) : (
              <>
                {t('usage.credits')}: {(usageData.credits?.available ?? 0).toLocaleString()}
              </>
            )}
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
          <UserMenu profile={profile} onLogout={handleLogout} />
        )}
      </div>
    </header>
  );
}
