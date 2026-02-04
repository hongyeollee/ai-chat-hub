import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { constructWebhookEvent, getStripe } from '@/lib/stripe/client';
import { getTierFromPriceId } from '@/lib/stripe/config';
import { TIER_LIMITS } from '@/types';
import type Stripe from 'stripe';

// Supabase Admin Client (webhook에서는 service role 사용)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase admin credentials not configured');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// POST /api/stripe/webhook - Handle Stripe Webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 이벤트 타입별 처리
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(supabase, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(supabase, invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Checkout 완료 처리
async function handleCheckoutComplete(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  session: Stripe.Checkout.Session
) {
  const userId = session.metadata?.supabase_user_id;
  if (!userId) {
    console.error('No user ID in checkout session metadata');
    return;
  }

  const tier = session.metadata?.tier;
  const withdrawalConsent = session.metadata?.withdrawal_consent === 'true';

  // 구독 레코드 생성/업데이트
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      tier: tier || 'light',
      stripe_subscription_id: session.subscription as string,
      stripe_customer_id: session.customer as string,
      status: 'active',
      withdrawal_consent: withdrawalConsent,
      withdrawal_consent_at: withdrawalConsent ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  // 프로필 업데이트
  await supabase
    .from('profiles')
    .update({
      subscription_tier: tier || 'light',
      stripe_customer_id: session.customer as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`Checkout completed for user ${userId}, tier: ${tier}`);
}

// 구독 업데이트 처리
async function handleSubscriptionUpdate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription
) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    // metadata에 없으면 customer로 찾기
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single();

    if (!profile) {
      console.error('No user found for subscription:', subscription.id);
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const tierInfo = priceId ? getTierFromPriceId(priceId) : null;
  const tier = tierInfo?.tier || subscription.metadata?.tier || 'light';

  // 구독 상태 매핑
  let status = 'active';
  switch (subscription.status) {
    case 'active':
      status = 'active';
      break;
    case 'canceled':
      status = 'canceled';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'trialing':
      status = 'trialing';
      break;
    case 'incomplete':
    case 'incomplete_expired':
      status = 'incomplete';
      break;
    default:
      status = subscription.status;
  }

  // 구독 레코드 업데이트
  await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId || (await getUserIdByCustomer(supabase, subscription.customer as string)),
      tier,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  // 프로필 업데이트 (활성 구독인 경우만)
  if (status === 'active' || status === 'trialing') {
    const targetUserId = userId || await getUserIdByCustomer(supabase, subscription.customer as string);
    if (targetUserId) {
      await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);
    }
  }

  console.log(`Subscription updated: ${subscription.id}, status: ${status}, tier: ${tier}`);
}

// 구독 삭제/취소 처리
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  subscription: Stripe.Subscription
) {
  const userId = await getUserIdByCustomer(supabase, subscription.customer as string);
  if (!userId) {
    console.error('No user found for deleted subscription:', subscription.id);
    return;
  }

  // 구독 상태를 canceled로 변경
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      tier: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // 프로필을 Free 티어로 변경
  await supabase
    .from('profiles')
    .update({
      subscription_tier: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  console.log(`Subscription deleted for user ${userId}, reverted to free tier`);
}

// 인보이스 결제 완료 처리
async function handleInvoicePaid(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  invoice: Stripe.Invoice
) {
  const userId = await getUserIdByCustomer(supabase, invoice.customer as string);
  if (!userId) return;

  // 결제 내역 기록
  await supabase.from('payments').insert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    amount: (invoice.amount_paid || 0) / 100,  // cents to dollars
    currency: invoice.currency,
    status: 'succeeded',
    description: invoice.description || 'Subscription payment',
  });

  // 구독 갱신이면 월간 크레딧 지급
  if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_create') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (profile && profile.subscription_tier !== 'free') {
      const tierConfig = TIER_LIMITS[profile.subscription_tier as keyof typeof TIER_LIMITS];
      if (tierConfig.monthlyCredits) {
        await grantMonthlyCredits(supabase, userId, tierConfig.monthlyCredits, tierConfig.rolloverLimit || 0);
      }
    }
  }

  console.log(`Invoice paid for user ${userId}: ${invoice.id}`);
}

// 인보이스 결제 실패 처리
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  invoice: Stripe.Invoice
) {
  const userId = await getUserIdByCustomer(supabase, invoice.customer as string);
  if (!userId) return;

  // 결제 실패 기록
  await supabase.from('payments').insert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency,
    status: 'failed',
    description: 'Payment failed',
  });

  // 구독 상태를 past_due로 변경
  await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`Invoice payment failed for user ${userId}: ${invoice.id}`);
}

// Customer ID로 User ID 찾기
async function getUserIdByCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  return data?.id || null;
}

// 월간 크레딧 지급 (이월 처리 포함)
async function grantMonthlyCredits(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  baseCredits: number,
  rolloverLimit: number
) {
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);
  const currentMonthStr = currentMonth.toISOString().split('T')[0];

  // 이전 달 잔액 확인 (이월 계산)
  const prevMonth = new Date(currentMonth);
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevMonthStr = prevMonth.toISOString().split('T')[0];

  const { data: prevCredits } = await supabase
    .from('monthly_credits')
    .select('*')
    .eq('user_id', userId)
    .eq('month', prevMonthStr)
    .single();

  let rolloverCredits = 0;
  if (prevCredits) {
    const prevRemaining =
      prevCredits.base_credits +
      prevCredits.rollover_credits +
      prevCredits.purchased_credits -
      prevCredits.used_credits;

    // 이월 상한 적용
    rolloverCredits = Math.min(Math.max(prevRemaining, 0), rolloverLimit);
  }

  // 현재 월 크레딧 레코드 생성/업데이트
  await supabase.from('monthly_credits').upsert({
    user_id: userId,
    month: currentMonthStr,
    base_credits: baseCredits,
    rollover_credits: rolloverCredits,
    purchased_credits: 0,
    used_credits: 0,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id,month',
  });

  // 크레딧 거래 로그
  await supabase.from('credit_transactions').insert([
    {
      user_id: userId,
      amount: baseCredits,
      balance_after: baseCredits + rolloverCredits,
      type: 'monthly',
      description: 'Monthly credit grant',
    },
    ...(rolloverCredits > 0 ? [{
      user_id: userId,
      amount: rolloverCredits,
      balance_after: baseCredits + rolloverCredits,
      type: 'rollover' as const,
      description: 'Rollover from previous month',
    }] : []),
  ]);

  console.log(`Granted ${baseCredits} credits + ${rolloverCredits} rollover to user ${userId}`);
}
