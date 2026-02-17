/**
 * 인앱 브라우저 감지 및 외부 브라우저 열기 유틸리티
 * Google OAuth는 WebView(인앱 브라우저)에서 차단됨 (disallowed_useragent 오류)
 */

interface InAppBrowserInfo {
  isInAppBrowser: boolean;
  browserName: string | null;
  platform: 'android' | 'ios' | 'unknown';
}

/**
 * 인앱 브라우저인지 감지
 */
export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { isInAppBrowser: false, browserName: null, platform: 'unknown' };
  }

  const ua = navigator.userAgent || navigator.vendor || '';

  // 플랫폼 감지
  const isAndroid = /android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const platform = isAndroid ? 'android' : isIOS ? 'ios' : 'unknown';

  // 인앱 브라우저 패턴 (주요 앱들)
  const inAppBrowserPatterns: { pattern: RegExp; name: string }[] = [
    { pattern: /KAKAOTALK/i, name: '카카오톡' },
    { pattern: /NAVER\(inapp/i, name: '네이버' },
    { pattern: /FBAN|FBAV/i, name: 'Facebook' },
    { pattern: /Instagram/i, name: 'Instagram' },
    { pattern: /Line\//i, name: 'LINE' },
    { pattern: /Twitter/i, name: 'Twitter' },
    { pattern: /MicroMessenger/i, name: 'WeChat' },
    { pattern: /DaumApps/i, name: '다음' },
    { pattern: /BAND\//i, name: 'BAND' },
    // 일반 WebView 패턴
    { pattern: /\bwv\b/i, name: 'WebView' },
    { pattern: /WebView/i, name: 'WebView' },
  ];

  for (const { pattern, name } of inAppBrowserPatterns) {
    if (pattern.test(ua)) {
      return { isInAppBrowser: true, browserName: name, platform };
    }
  }

  // 추가 감지: standalone 모드가 아닌데 Safari/Chrome이 아닌 경우
  // iOS Safari 또는 Chrome에서는 Safari 또는 CriOS가 포함됨
  if (isIOS && !/Safari/i.test(ua) && !/CriOS/i.test(ua)) {
    return { isInAppBrowser: true, browserName: 'InApp Browser', platform };
  }

  return { isInAppBrowser: false, browserName: null, platform };
}

/**
 * 외부 브라우저로 현재 URL 열기 시도
 * @returns 성공 여부 (false면 안내 메시지 필요)
 */
export function openInExternalBrowser(url?: string): boolean {
  const targetUrl = url || window.location.href;
  const { platform, browserName } = detectInAppBrowser();

  // Android: Intent URL 사용
  if (platform === 'android') {
    try {
      // Chrome으로 열기 시도
      const intentUrl = `intent://${targetUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = intentUrl;
      return true;
    } catch {
      // Intent 실패 시 일반 열기 시도
      try {
        window.open(targetUrl, '_system');
        return true;
      } catch {
        return false;
      }
    }
  }

  // iOS: Safari로 열기 시도 (제한적)
  if (platform === 'ios') {
    try {
      // iOS에서는 자동 열기가 제한적이므로 새 창 시도
      const newWindow = window.open(targetUrl, '_blank');
      if (newWindow) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * 인앱 브라우저 안내 메시지 생성
 */
export function getInAppBrowserMessage(browserName: string | null, locale: string = 'ko'): {
  title: string;
  description: string;
  instruction: string;
} {
  const appName = browserName || '현재 앱';

  if (locale === 'ko') {
    return {
      title: '외부 브라우저에서 열어주세요',
      description: `${appName}의 내장 브라우저에서는 Google 로그인이 제한됩니다.`,
      instruction: '우측 상단 메뉴(⋮ 또는 ⋯)에서 "Safari로 열기" 또는 "Chrome으로 열기"를 선택해주세요.',
    };
  }

  return {
    title: 'Please open in external browser',
    description: `Google login is restricted in ${appName}'s built-in browser.`,
    instruction: 'Please tap the menu (⋮ or ⋯) and select "Open in Safari" or "Open in Chrome".',
  };
}

/**
 * URL을 클립보드에 복사
 */
export async function copyUrlToClipboard(url?: string): Promise<boolean> {
  const targetUrl = url || window.location.href;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(targetUrl);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = targetUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      return true;
    } finally {
      document.body.removeChild(textArea);
    }
  } catch {
    return false;
  }
}
