import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, getStripeErrorMessage } from '@/lib/stripe/client';
import { STRIPE_CONFIG } from '@/lib/stripe/config';

// POST /api/stripe/portal - Create Stripe Customer Portal Session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 프로필에서 Stripe 고객 ID 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { success: false, error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Customer Portal 세션 생성
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: STRIPE_CONFIG.portal.returnUrl,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return NextResponse.json(
      { success: false, error: getStripeErrorMessage(error) },
      { status: 500 }
    );
  }
}
