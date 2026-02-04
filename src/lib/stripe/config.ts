import type { SubscriptionTier } from '@/types';

// Stripe Price IDs (환경 변수에서 가져오거나 기본값 사용)
// 실제 프로덕션에서는 Stripe Dashboard에서 생성한 Price ID 사용
export const STRIPE_PRICE_IDS = {
  light: {
    monthly: process.env.STRIPE_PRICE_LIGHT_MONTHLY || 'price_light_monthly',
    yearly: process.env.STRIPE_PRICE_LIGHT_YEARLY || 'price_light_yearly',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || 'price_pro_yearly',
  },
  credits: {
    light: process.env.STRIPE_PRICE_CREDITS_LIGHT || 'price_credits_light',  // $2.99/1000
    pro: process.env.STRIPE_PRICE_CREDITS_PRO || 'price_credits_pro',        // $1.99/1000
  },
} as const;

// Price ID로부터 티어 및 결제 주기 매핑
export function getTierFromPriceId(priceId: string): {
  tier: SubscriptionTier;
  interval: 'monthly' | 'yearly';
} | null {
  for (const [tier, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    if (tier === 'credits') continue;

    const tierPrices = prices as { monthly: string; yearly: string };
    if (priceId === tierPrices.monthly) {
      return { tier: tier as SubscriptionTier, interval: 'monthly' };
    }
    if (priceId === tierPrices.yearly) {
      return { tier: tier as SubscriptionTier, interval: 'yearly' };
    }
  }
  return null;
}

// 티어별 Stripe Price ID 가져오기
export function getPriceId(
  tier: 'light' | 'pro',
  interval: 'monthly' | 'yearly'
): string {
  return STRIPE_PRICE_IDS[tier][interval];
}

// 크레딧 구매용 Price ID 가져오기
export function getCreditPriceId(tier: 'light' | 'pro'): string {
  return STRIPE_PRICE_IDS.credits[tier];
}

// Stripe 설정
export const STRIPE_CONFIG = {
  // 웹훅 처리할 이벤트 목록
  webhookEvents: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
  ],

  // 체크아웃 세션 설정
  checkout: {
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription?success=true`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
  },

  // 고객 포털 설정
  portal: {
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/subscription`,
  },

  // 환불 정책
  refund: {
    fullRefundDays: 7,           // 전액 환불 가능 기간 (일)
    maxUsagePercent: 10,         // 환불 시 최대 사용량 (%)
    yearlyPenaltyPercent: 10,    // 연간 결제 중도 해지 수수료 (%)
  },
} as const;

// 환불 가능 여부 확인
export function canRefund(
  purchaseDate: Date,
  usagePercent: number,
  isYearly: boolean
): {
  eligible: boolean;
  type: 'full' | 'partial' | 'none';
  penaltyPercent?: number;
  reason?: string;
} {
  const daysSincePurchase = Math.floor(
    (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 7일 이내
  if (daysSincePurchase <= STRIPE_CONFIG.refund.fullRefundDays) {
    // 사용량 10% 미만이면 전액 환불
    if (usagePercent < STRIPE_CONFIG.refund.maxUsagePercent) {
      return { eligible: true, type: 'full' };
    }
    // 사용량 초과 시 환불 불가
    return {
      eligible: false,
      type: 'none',
      reason: `Usage exceeded ${STRIPE_CONFIG.refund.maxUsagePercent}%`,
    };
  }

  // 7일 이후
  if (isYearly) {
    // 연간 결제는 잔여 일할 환불 (10% 수수료)
    return {
      eligible: true,
      type: 'partial',
      penaltyPercent: STRIPE_CONFIG.refund.yearlyPenaltyPercent,
    };
  }

  // 월간 결제 7일 이후는 환불 불가
  return {
    eligible: false,
    type: 'none',
    reason: 'Refund period expired',
  };
}

// 가격 정보 (표시용)
export const PRICING_DISPLAY = {
  light: {
    monthly: { amount: 4.99, currency: 'USD' },
    yearly: { amount: 49.99, currency: 'USD', monthlyEquivalent: 4.17 },
    discount: '17%',
    savings: '$9.89/year',
  },
  pro: {
    monthly: { amount: 9.99, currency: 'USD' },
    yearly: { amount: 99.99, currency: 'USD', monthlyEquivalent: 8.33 },
    discount: '17%',
    savings: '$19.89/year',
  },
} as const;
