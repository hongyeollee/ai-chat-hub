import { NextRequest, NextResponse } from 'next/server';
// import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { createServiceClient } from '@/lib/supabase/server';

// Resend is disabled for now.
// let resendClient: Resend | null = null;
//
// function getResendClient(): Resend {
//   if (!resendClient) {
//     resendClient = new Resend(process.env.RESEND_API_KEY);
//   }
//   return resendClient;
// }

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP settings are not configured');
  }

  return nodemailer.createTransport({
    host,
    port: Number.parseInt(port, 10),
    secure: Number.parseInt(port, 10) === 465,
    auth: {
      user,
      pass,
    },
  });
}

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store verification code in database using service role
    const supabase = await createServiceClient();

    // Delete any existing codes for this email
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email);

    // Insert new verification code
    const { error: insertError } = await supabase
      .from('email_verifications')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Failed to store verification code:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to generate verification code' },
        { status: 500 }
      );
    }

    const transporter = getSmtpTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!fromAddress) {
      throw new Error('SMTP_FROM is not configured');
    }

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: 'Your verification code for AI Chat Hub',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Verification Code</h1>
          <p style="color: #666; font-size: 16px;">
            Your verification code is:
          </p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
              ${code}
            </span>
          </div>
          <p style="color: #999; font-size: 14px;">
            This code will expire in 10 minutes.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email verification start error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
