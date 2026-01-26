'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function VerifyCodeForm() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = pathname.split('/')[1] || 'ko';

  const email = searchParams.get('email') || '';
  const marketingAgreed = searchParams.get('marketing') === 'true';
  const isNewUser = searchParams.get('newUser') === 'true';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!email) {
      router.push(`/${locale}/login`);
    }
  }, [email, locale, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const storedPassword = isNewUser ? sessionStorage.getItem('signup_password') : null;

      if (isNewUser && !storedPassword) {
        router.push(`/${locale}/signup?email=${encodeURIComponent(email)}`);
        return;
      }

      const endpoint = isNewUser ? '/api/auth/signup' : '/api/auth/email/verify';
      const payload = isNewUser
        ? { email, password: storedPassword, marketingAgreed, code }
        : { email, code, marketingAgreed };

      // 1. 서버에서 코드 검증 및 토큰 발급
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error === 'Verification code expired') {
          setError(t('auth.codeExpired'));
        } else if (result.error === 'Invalid verification code') {
          setError(t('auth.invalidCode'));
        } else if (result.error === 'Email already registered') {
          setError(t('auth.emailAlreadyExists'));
        } else {
          setError(result.error);
        }
        return;
      }

      // 2. 클라이언트에서 토큰으로 세션 설정
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: result.token,
        type: 'magiclink',
      });

      if (verifyError) {
        console.error('Session verification error:', verifyError);
        setError(t('auth.verificationFailed'));
        return;
      }

      if (isNewUser) {
        sessionStorage.removeItem('signup_password');
      }

      // 3. 세션 설정 완료 - 채팅 페이지로 이동
      router.push(`/${locale}/chat`);
      router.refresh();
    } catch (err) {
      console.error('Verification error:', err);
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      const response = await fetch('/api/auth/email/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
      } else {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 3000);
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('auth.verifyEmail')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('auth.checkEmail')}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
          {email}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {resendSuccess && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm">
            {t('auth.codeSent')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.enterCode')}
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
              placeholder="000000"
              maxLength={6}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.loading') : t('auth.verifyCode')}
          </button>
        </form>

        <button
          onClick={handleResend}
          disabled={resendLoading}
          className="w-full mt-4 py-2 text-blue-500 hover:text-blue-600 text-sm disabled:opacity-50"
        >
          {resendLoading ? t('common.loading') : t('auth.resendCode')}
        </button>
      </div>
    </div>
  );
}
