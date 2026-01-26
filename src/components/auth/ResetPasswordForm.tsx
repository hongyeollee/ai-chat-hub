'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = pathname.split('/')[1] || 'ko';

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validatePassword = (): boolean => {
    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return false;
    }
    if (password.length > 20) {
      setError(t('auth.passwordTooLong'));
      return false;
    }
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    if (!specialCharRegex.test(password)) {
      setError(t('auth.passwordNoSpecialChar'));
      return false;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validatePassword()) return;

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      });

      const result = await response.json();

      if (!result.success) {
        if (result.details) {
          const errorKey = result.details[0];
          if (errorKey === 'password_too_short') {
            setError(t('auth.passwordTooShort'));
          } else if (errorKey === 'password_too_long') {
            setError(t('auth.passwordTooLong'));
          } else if (errorKey === 'password_no_special_char') {
            setError(t('auth.passwordNoSpecialChar'));
          } else {
            setError(result.error);
          }
        } else {
          setError(result.error);
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/login`);
      }, 2000);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Invalid or expired reset link.
          </p>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('auth.setNewPassword')}
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center">
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-sm">
              {t('auth.passwordResetSuccess')}
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.newPassword')}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('auth.passwordPlaceholder')}
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                8-20자, 특수문자 1개 이상 포함
              </p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('auth.confirmPasswordPlaceholder')}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.loading') : t('auth.setNewPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
