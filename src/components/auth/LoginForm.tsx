'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  detectInAppBrowser,
  openInExternalBrowser,
  getInAppBrowserMessage,
  copyUrlToClipboard,
} from '@/lib/utils/inAppBrowser';

type LoginMode = 'password' | 'otp';

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'ko';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inAppBrowserInfo, setInAppBrowserInfo] = useState<{
    isInAppBrowser: boolean;
    browserName: string | null;
  }>({ isInAppBrowser: false, browserName: null });
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [copied, setCopied] = useState(false);

  // 인앱 브라우저 감지
  useEffect(() => {
    const info = detectInAppBrowser();
    setInAppBrowserInfo(info);
  }, []);

  const handleGoogleLogin = async () => {
    // 인앱 브라우저인 경우 외부 브라우저로 열기 시도
    if (inAppBrowserInfo.isInAppBrowser) {
      const opened = openInExternalBrowser();
      if (!opened) {
        // 외부 브라우저 열기 실패 시 안내 메시지 표시
        setShowInAppWarning(true);
        return;
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/${locale}/chat`,
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyUrlToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const inAppMessage = getInAppBrowserMessage(inAppBrowserInfo.browserName, locale);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error === 'Please use Google login for this account') {
          setError(t('auth.useGoogleLogin'));
        } else if (result.error === 'No password set. Please use one-time code login.') {
          setError(t('auth.noPasswordSet'));
        } else if (result.error === 'Invalid email or password') {
          setError(t('auth.invalidCredentials'));
        } else {
          setError(result.error);
        }
        return;
      }

      // Set session with token
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: result.token,
        type: 'magiclink',
      });

      if (verifyError) {
        setError(t('auth.verificationFailed'));
        return;
      }

      router.push(`/${locale}/chat`);
      router.refresh();
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if email exists
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResult.success) {
        setError(checkResult.error);
        return;
      }

      if (!checkResult.exists) {
        router.push(`/${locale}/signup?email=${encodeURIComponent(email)}`);
        return;
      }

      // Send OTP code
      const response = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(`/${locale}/verify?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gradient mb-2">
          {t('common.appName')}
        </h1>
        <p className="text-[var(--text-secondary)]">
          {t('common.tagline')}
        </p>
      </div>

      <div className="glass-card rounded-2xl p-8">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
          {t('auth.login')}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* 인앱 브라우저 경고 */}
        {showInAppWarning && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">
                  {inAppMessage.title}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
                  {inAppMessage.description}
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mb-3">
                  {inAppMessage.instruction}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm transition-colors"
                  >
                    {copied ? '✓ 복사됨!' : '📋 URL 복사'}
                  </button>
                  <button
                    onClick={() => setShowInAppWarning(false)}
                    className="px-3 py-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg text-sm transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full btn-secondary flex items-center justify-center gap-3 py-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('auth.continueWithGoogle')}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-[var(--surface)] text-[var(--text-muted)]">{t('auth.or')}</span>
          </div>
        </div>

        {loginMode === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('auth.password')}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
            </div>

            <div className="text-right">
              <Link
                href={`/${locale}/forgot-password`}
                className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.loginWithPassword')
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('common.loading')}
                </span>
              ) : (
                t('auth.sendCode')
              )}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setLoginMode(loginMode === 'password' ? 'otp' : 'password')}
          className="w-full mt-4 py-2 text-[var(--primary)] hover:text-[var(--primary-light)] text-sm transition-colors"
        >
          {loginMode === 'password' ? t('auth.loginWithOtp') : t('auth.loginWithPassword')}
        </button>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          {t('auth.noAccount')}{' '}
          <Link href={`/${locale}/signup`} className="text-[var(--primary)] hover:text-[var(--primary-light)] font-medium transition-colors">
            {t('auth.signup')}
          </Link>
        </p>
      </div>
    </div>
  );
}
