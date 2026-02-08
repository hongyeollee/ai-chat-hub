import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Generate a random token
function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Check if user exists
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const user = users?.find(u => u.email === email);

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Check if user has password (not OAuth)
    const { data: profile } = await supabase
      .from('profiles')
      .select('auth_method')
      .eq('id', user.id)
      .single();

    if (profile?.auth_method === 'google') {
      // Don't send reset email for OAuth users
      return NextResponse.json({ success: true });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (reusing email_verifications table)
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', `reset:${email}`);

    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        email: `reset:${email}`,
        code: resetToken,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store reset token:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate reset token' },
        { status: 500 }
      );
    }

    // Send reset email
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/ko/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const resend = getResendClient();
    const { error: emailError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Reset your password - NexusAI',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Password Reset</h1>
          <p style="color: #666; font-size: 16px;">
            You requested to reset your password. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send reset email:', emailError);
      // Don't expose email sending failures
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
