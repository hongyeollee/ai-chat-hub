import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/utils/password';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate inputs
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Find user in auth.users
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get profile with password hash
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('password_hash, auth_method')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch profile:', profileError);
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has password set
    if (!profile.password_hash) {
      // User might be Google OAuth or OTP-only
      const method = profile.auth_method || 'unknown';
      if (method === 'google') {
        return NextResponse.json(
          { success: false, error: 'Please use Google login for this account' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'No password set. Please use one-time code login.' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, profile.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Password verified - generate session token
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error('Failed to generate login token:', linkError);
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      );
    }

    // Update last sign in
    await supabase
      .from('profiles')
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      token: linkData.properties.hashed_token,
      email,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
