import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validatePassword, hashPassword } from '@/lib/utils/password';

export async function POST(request: NextRequest) {
  try {
    const { email, token, password } = await request.json();

    // Validate inputs
    if (!email || !token || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid password', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify reset token
    const { data: verification, error: fetchError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', `reset:${email}`)
      .single();

    if (fetchError || !verification) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token matches
    if (verification.code !== token) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(verification.expires_at) < new Date()) {
      await supabase
        .from('email_verifications')
        .delete()
        .eq('email', `reset:${email}`);

      return NextResponse.json(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      );
    }

    // Find user
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password in profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        password_hash: passwordHash,
        auth_method: 'email',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // Delete used reset token
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', `reset:${email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
