'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Password validation check icon component
function CheckIcon({ valid }: { valid: boolean }) {
  if (valid) {
    return (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
    </svg>
  );
}

export function SignupForm() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = pathname.split('/')[1] || 'ko';

  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // 동의 상태
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Real-time password validation
  const passwordChecks = useMemo(() => {
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    return {
      minLength: password.length >= 8,
      maxLength: password.length <= 20,
      hasSpecialChar: specialCharRegex.test(password),
      passwordsMatch: password.length > 0 && confirmPassword.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const isPasswordValid = passwordChecks.minLength && passwordChecks.maxLength && passwordChecks.hasSpecialChar;
  const isFormValid = isPasswordValid && passwordChecks.passwordsMatch;

  const validatePassword = (): boolean => {
    if (!passwordChecks.minLength) {
      setError(t('auth.passwordTooShort'));
      return false;
    }
    if (!passwordChecks.maxLength) {
      setError(t('auth.passwordTooLong'));
      return false;
    }
    if (!passwordChecks.hasSpecialChar) {
      setError(t('auth.passwordNoSpecialChar'));
      return false;
    }
    if (!passwordChecks.passwordsMatch) {
      setError(t('auth.passwordMismatch'));
      return false;
    }
    return true;
  };

  const validateConsent = (): boolean => {
    if (!termsAgreed) {
      setError(t('auth.termsRequired'));
      return false;
    }
    if (!privacyAgreed) {
      setError(t('auth.privacyRequired'));
      return false;
    }
    return true;
  };

  const handleGoogleSignup = async () => {
    if (!validateConsent()) return;

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=/${locale}/chat&marketing=${marketingAgreed}`,
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCodeError('');

    if (!validateConsent()) return;
    if (!validatePassword()) return;

    setLoading(true);

    try {
      // Check if email already registered
      const checkResponse = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const checkResult = await checkResponse.json();

      if (checkResult.success && checkResult.exists) {
        setError(t('auth.emailAlreadyExists'));
        setLoading(false);
        return;
      }

      if (!codeSent) {
        // Send verification code
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

        setCodeSent(true);
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 3000);
        return;
      }

      if (code.length !== 6) {
        setCodeError(t('auth.enterCode'));
        return;
      }

      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, marketingAgreed, code }),
      });

      const signupResult = await signupResponse.json();

      if (!signupResult.success) {
        if (signupResult.error === 'Verification code expired') {
          setCodeError(t('auth.codeExpired'));
        } else if (signupResult.error === 'Invalid verification code') {
          setCodeError(t('auth.invalidCode'));
        } else if (signupResult.error === 'Email already registered') {
          setError(t('auth.emailAlreadyExists'));
        } else {
          setError(signupResult.error);
        }
        return;
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: signupResult.token,
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

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('common.appName')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('common.tagline')}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          {t('auth.signup')}
        </h2>

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

          {codeSent && (
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('auth.checkEmail')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{email}</p>
            </div>
          )}

        {/* 동의 체크박스 */}
        <div className="mb-6 space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('auth.consentTitle')}
          </p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.agreeToTerms')}{' '}
              <span className="text-red-500">{t('auth.requiredConsent')}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={(e) => setPrivacyAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.agreeToPrivacy')}{' '}
              <span className="text-red-500">{t('auth.requiredConsent')}</span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingAgreed}
              onChange={(e) => setMarketingAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.agreeToMarketing')}
            </span>
          </label>
        </div>

        <button
          onClick={handleGoogleSignup}
          disabled={loading}
          className="w-full py-3 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('auth.continueWithGoogle')}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">{t('auth.or')}</span>
          </div>
        </div>

        <form onSubmit={handleEmailSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('auth.emailPlaceholder')}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                password.length > 0
                  ? isPasswordValid
                    ? 'border-green-500 dark:border-green-500'
                    : 'border-orange-400 dark:border-orange-400'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder={t('auth.passwordPlaceholder')}
              required
            />

            {/* Password requirements checklist */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <CheckIcon valid={passwordChecks.minLength && passwordChecks.maxLength} />
                  <span className={passwordChecks.minLength && passwordChecks.maxLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                    {t('auth.passwordLengthRequirement')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <CheckIcon valid={passwordChecks.hasSpecialChar} />
                  <span className={passwordChecks.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}>
                    {t('auth.passwordSpecialCharRequirement')}
                  </span>
                </div>
              </div>
            )}
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
              className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                confirmPassword.length > 0
                  ? passwordChecks.passwordsMatch
                    ? 'border-green-500 dark:border-green-500'
                    : 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              required
            />

            {/* Password match indicator */}
            {confirmPassword.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <CheckIcon valid={passwordChecks.passwordsMatch} />
                <span className={passwordChecks.passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {passwordChecks.passwordsMatch ? t('auth.passwordMatch') : t('auth.passwordMismatch')}
                </span>
              </div>
            )}
          </div>

          {codeSent && (
            <div className="mb-4">
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.enterCode')}
              </label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (codeError) setCodeError('');
                }}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              {codeError && (
                <p className="mt-2 text-xs text-red-500">
                  {codeError}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('auth.signupCodeHelp')}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !isFormValid || (codeSent && code.length !== 6)}
            className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.loading') : codeSent ? t('auth.completeSignup') : t('auth.sendCode')}
          </button>
        </form>

        {codeSent && (
          <button
            onClick={handleResend}
            disabled={resendLoading}
            className="w-full mt-4 py-2 text-blue-500 hover:text-blue-600 text-sm disabled:opacity-50"
          >
            {resendLoading ? t('common.loading') : t('auth.resendCode')}
          </button>
        )}

        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {t('auth.hasAccount')}{' '}
          <Link href={`/${locale}/login`} className="text-blue-500 hover:text-blue-600 font-medium">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
