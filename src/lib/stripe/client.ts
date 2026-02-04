import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }
  return stripeClient;
}

// Stripe 에러 핸들링
export function getStripeErrorMessage(error: unknown): string {
  if (error instanceof Stripe.errors.StripeError) {
    switch (error.type) {
      case 'StripeCardError':
        return error.message || '카드 결제에 실패했습니다.';
      case 'StripeInvalidRequestError':
        return '잘못된 요청입니다.';
      case 'StripeAPIError':
        return '결제 시스템에 일시적인 문제가 발생했습니다.';
      case 'StripeConnectionError':
        return '결제 시스템에 연결할 수 없습니다.';
      case 'StripeAuthenticationError':
        return '결제 인증에 실패했습니다.';
      case 'StripeRateLimitError':
        return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      default:
        return error.message || '결제 처리 중 오류가 발생했습니다.';
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 오류가 발생했습니다.';
}

// Webhook 서명 검증
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
