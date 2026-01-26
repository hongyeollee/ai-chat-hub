import { USAGE_LIMITS } from '@/types';

export function getKoreanDate(): string {
  // Get current date in Korea timezone (UTC+9)
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.toISOString().split('T')[0];
}

export function canMakeRequest(
  requestCount: number,
  charCount: number
): { allowed: boolean; reason?: string } {
  if (requestCount >= USAGE_LIMITS.MAX_REQUESTS_PER_DAY) {
    return {
      allowed: false,
      reason: 'daily_request_limit',
    };
  }

  if (charCount >= USAGE_LIMITS.MAX_CHARS_PER_DAY) {
    return {
      allowed: false,
      reason: 'daily_char_limit',
    };
  }

  return { allowed: true };
}

export function getRemainingUsage(requestCount: number, charCount: number) {
  return {
    remainingRequests: Math.max(0, USAGE_LIMITS.MAX_REQUESTS_PER_DAY - requestCount),
    remainingChars: Math.max(0, USAGE_LIMITS.MAX_CHARS_PER_DAY - charCount),
    maxRequests: USAGE_LIMITS.MAX_REQUESTS_PER_DAY,
    maxChars: USAGE_LIMITS.MAX_CHARS_PER_DAY,
  };
}
