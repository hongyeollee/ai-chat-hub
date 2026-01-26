import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, code, marketingAgreed } = await request.json();

    console.log('Verify request:', { email, code: '***', marketingAgreed });

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: 'Email and code are required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get verification record
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .single();

    console.log('Verification record:', verification ? 'found' : 'not found', fetchError?.message);

    if (fetchError || !verification) {
      return NextResponse.json(
        { success: false, error: 'Verification code not found' },
        { status: 400 }
      );
    }

    // Check if code matches
    if (verification.code !== code) {
      console.log('Code mismatch');
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (new Date(verification.expires_at) < new Date()) {
      console.log('Code expired');
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      return NextResponse.json(
        { success: false, error: 'Verification code expired' },
        { status: 400 }
      );
    }

    // Delete used verification code
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email);

    // Check if user exists in Supabase Auth
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existingAuthUser = users?.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingAuthUser) {
      console.log('Existing auth user found:', existingAuthUser.id);
      userId = existingAuthUser.id;

      // profiles 테이블에 레코드가 있는지 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) {
        // profiles 레코드가 없으면 생성 (트리거가 실패한 경우)
        console.log('Creating missing profile for user:', userId);
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: email,
            email_confirmed_at: existingAuthUser.email_confirmed_at,
            phone: existingAuthUser.phone,
            phone_confirmed_at: existingAuthUser.phone_confirmed_at,
            auth_created_at: existingAuthUser.created_at,
            auth_updated_at: existingAuthUser.updated_at,
            last_sign_in_at: existingAuthUser.last_sign_in_at,
            auth_provider: existingAuthUser.app_metadata?.provider || 'email',
            name: existingAuthUser.user_metadata?.name || existingAuthUser.user_metadata?.full_name || email.split('@')[0],
            avatar_url: existingAuthUser.user_metadata?.avatar_url || null,
            terms_agreed_at: new Date().toISOString(),
            privacy_agreed_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Failed to create profile:', insertError);
        }
        isNewUser = true;
      }
    } else {
      // Create new user with admin API
      console.log('Creating new user for:', email);
      isNewUser = true;

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error('Failed to create user:', createError);
        return NextResponse.json(
          { success: false, error: 'Failed to create user' },
          { status: 500 }
        );
      }

      userId = newUser.user.id;
      console.log('New user created:', userId);

      // 프로필이 트리거로 생성되었는지 확인 (잠시 대기)
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 마케팅 동의 정보 업데이트 (신규 유저의 경우)
    if (isNewUser && marketingAgreed !== undefined) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          marketing_agreed: marketingAgreed,
          marketing_agreed_at: marketingAgreed ? new Date().toISOString() : null,
        })
        .eq('id', userId);
      console.log('Marketing update:', updateError ? updateError.message : 'success');
    }

    // Generate magic link token for client-side authentication
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error('Failed to generate link:', linkError);
      return NextResponse.json(
        { success: false, error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    console.log('Token generated successfully');

    // Return the token for client-side verification
    return NextResponse.json({
      success: true,
      token: linkData.properties.hashed_token,
      email,
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
