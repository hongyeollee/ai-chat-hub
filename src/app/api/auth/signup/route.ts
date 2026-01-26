import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validatePassword, hashPassword } from '@/lib/utils/password';

export async function POST(request: NextRequest) {
  try {
    const { email, password, marketingAgreed, code } = await request.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      );
    }

    // Validate password
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid password', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check verification code
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { success: false, error: 'Verification code not found' },
        { status: 400 }
      );
    }

    if (verification.code !== code) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', email);

      return NextResponse.json(
        { success: false, error: 'Verification code expired' },
        { status: 400 }
      );
    }

    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email);

    // Check if user already exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existingUser = users?.find(u => u.email === email);

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in Supabase Auth
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

    // Wait for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update profile with password hash and auth method
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        password_hash: passwordHash,
        auth_method: 'email',
        marketing_agreed: marketingAgreed || false,
        marketing_agreed_at: marketingAgreed ? new Date().toISOString() : null,
        terms_agreed_at: new Date().toISOString(),
        privacy_agreed_at: new Date().toISOString(),
      })
      .eq('id', newUser.user.id);

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      // Don't fail the signup, profile can be updated later
    }

    // Generate magic link for auto-login after signup
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error('Failed to generate login token:', linkError);
      return NextResponse.json(
        { success: false, error: 'Account created but failed to generate login token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      token: linkData.properties.hashed_token,
      email,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
