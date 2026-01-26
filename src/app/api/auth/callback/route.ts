import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') ?? '/ko/chat';
  const marketingParam = requestUrl.searchParams.get('marketing');

  console.log('Auth callback:', { code: !!code, token_hash: !!token_hash, type, next });

  const supabase = await createClient();

  // Handle magic link token verification
  if (token_hash && type === 'magiclink') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'magiclink',
    });

    console.log('Magic link verification:', error ? error.message : 'success');

    if (!error) {
      await syncUserProfile(supabase, marketingParam);
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Handle OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    console.log('OAuth code exchange:', error ? error.message : 'success');

    if (!error) {
      await syncUserProfile(supabase, marketingParam);
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  console.log('Auth callback failed, redirecting to login');
  return NextResponse.redirect(new URL('/ko/login', requestUrl.origin));
}

// 유저 프로필 동기화 함수
async function syncUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketingParam: string | null
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const serviceClient = await createServiceClient();

  // 프로필 존재 여부 확인
  const { data: existingProfile } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  const isGoogleAuth = user.app_metadata?.provider === 'google';

  if (!existingProfile) {
    // 프로필이 없으면 생성 (트리거가 실패한 경우)
    console.log('Creating missing profile for user:', user.id);
    const { error: insertError } = await serviceClient
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        phone_confirmed_at: user.phone_confirmed_at,
        auth_created_at: user.created_at,
        auth_updated_at: user.updated_at,
        last_sign_in_at: user.last_sign_in_at,
        auth_provider: user.app_metadata?.provider || 'email',
        auth_method: isGoogleAuth ? 'google' : 'email',
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
        avatar_url: user.user_metadata?.avatar_url || null,
        terms_agreed_at: new Date().toISOString(),
        privacy_agreed_at: new Date().toISOString(),
        marketing_agreed: marketingParam === 'true',
        marketing_agreed_at: marketingParam === 'true' ? new Date().toISOString() : null,
      });

    if (insertError) {
      console.error('Failed to create profile:', insertError);
    }
  } else {
    // 프로필이 있으면 auth 정보 동기화 + 마케팅 동의 업데이트
    const updateData: Record<string, unknown> = {
      email: user.email,
      email_confirmed_at: user.email_confirmed_at,
      auth_updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
      updated_at: new Date().toISOString(),
    };

    // Google OAuth인 경우 auth_method 업데이트
    if (isGoogleAuth) {
      updateData.auth_method = 'google';
    }

    // Google OAuth에서 이름/아바타 가져오기
    if (user.user_metadata?.name || user.user_metadata?.full_name) {
      updateData.name = user.user_metadata?.name || user.user_metadata?.full_name;
    }
    if (user.user_metadata?.avatar_url) {
      updateData.avatar_url = user.user_metadata?.avatar_url;
    }

    // 마케팅 동의 정보 업데이트
    if (marketingParam !== null) {
      updateData.marketing_agreed = marketingParam === 'true';
      updateData.marketing_agreed_at = marketingParam === 'true' ? new Date().toISOString() : null;
    }

    const { error: updateError } = await serviceClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
    }
  }
}
