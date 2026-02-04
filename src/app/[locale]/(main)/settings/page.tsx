'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { SubscriptionSection } from '@/components/settings/SubscriptionSection';
import { UsageSection } from '@/components/settings/UsageSection';
import { AISettingsSection } from '@/components/settings/AISettingsSection';
import type { Profile, SubscriptionTier } from '@/types';

interface SubscriptionData {
  tier: SubscriptionTier;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

interface UsageData {
  usageType: 'daily' | 'credits';
  tier: string;
  daily?: {
    requestsUsed: number;
    requestsRemaining: number;
    requestsMax: number;
    charsUsed: number;
    charsMax: number;
  };
  credits?: {
    available: number;
    total: number;
    used: number;
    base: number;
    rollover: number;
    purchased: number;
  };
}

export default function SettingsPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const currentLocale = pathname.split('/')[1] || 'ko';

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, subscriptionRes, creditsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/subscription'),
        fetch('/api/credits'),
      ]);

      const profileData = await profileRes.json();
      if (profileData.success) {
        setProfile(profileData.data);
      }

      const subscriptionData = await subscriptionRes.json();
      if (subscriptionData.success) {
        setSubscription(subscriptionData.data);
      }

      const creditsData = await creditsRes.json();
      if (creditsData.success) {
        setUsage(creditsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch settings data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleProfileUpdate = async (updates: Partial<Profile>): Promise<boolean> => {
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      if (result.success) {
        setProfile(result.data);
        setToast({ type: 'success', message: t('settings.saved') });
        return true;
      } else {
        setToast({ type: 'error', message: t('settings.saveError') });
        return false;
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setToast({ type: 'error', message: t('settings.saveError') });
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 bg-[var(--background)]">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="skeleton h-8 w-32 mb-6" />
          <div className="card p-6 space-y-4">
            <div className="skeleton h-6 w-24" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
        <div className="text-center">
          <p className="text-[var(--text-secondary)]">{t('common.error')}</p>
          <button
            onClick={() => router.push(`/${currentLocale}/login`)}
            className="btn-primary mt-4"
          >
            {t('auth.login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 bg-[var(--background)]">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('settings.title')}
        </h1>

        <ProfileSection profile={profile} onUpdate={handleProfileUpdate} />
        <SubscriptionSection data={subscription} isLoading={false} />
        <UsageSection data={usage} isLoading={false} />
        <AISettingsSection profile={profile} onUpdate={handleProfileUpdate} />
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg animate-fade-in ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
