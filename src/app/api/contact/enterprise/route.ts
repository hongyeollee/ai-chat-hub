import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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

// POST /api/contact/enterprise - Send enterprise inquiry to all admins
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

    const { companyName, teamSize, purpose, additionalInfo } = await request.json();

    if (!companyName || !teamSize || !purpose) {
      return NextResponse.json(
        { success: false, error: 'Required fields are missing' },
        { status: 400 }
      );
    }

    // Get user's email from profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', user.id)
      .single();

    // Get all admin emails using service client
    const serviceClient = await createServiceClient();
    const { data: admins, error: adminError } = await serviceClient
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .not('email', 'is', null);

    if (adminError || !admins || admins.length === 0) {
      console.error('Failed to fetch admin emails:', adminError);
      return NextResponse.json(
        { success: false, error: 'No administrators found' },
        { status: 500 }
      );
    }

    const adminEmails = admins.map(admin => admin.email).filter(Boolean) as string[];

    if (adminEmails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No administrator emails configured' },
        { status: 500 }
      );
    }

    const transporter = getSmtpTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!fromAddress) {
      throw new Error('SMTP_FROM is not configured');
    }

    const senderName = userProfile?.name || 'Unknown';
    const senderEmail = userProfile?.email || user.email || 'Unknown';

    // Send email to all admins (using BCC so recipients don't see each other)
    await transporter.sendMail({
      from: fromAddress,
      to: fromAddress, // Send to self
      bcc: adminEmails, // BCC to all admins
      subject: `[AI Chat Hub] Enterprise 플랜 문의 - ${companyName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
            Enterprise 플랜 문의
          </h1>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">문의자 정보</h2>
            <p><strong>이름:</strong> ${senderName}</p>
            <p><strong>이메일:</strong> ${senderEmail}</p>
          </div>

          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">문의 내용</h2>
            <p><strong>회사/팀명:</strong> ${companyName}</p>
            <p><strong>예상 사용 인원:</strong> ${teamSize}</p>
            <p><strong>주요 사용 목적:</strong></p>
            <p style="white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 4px;">${purpose}</p>
            ${additionalInfo ? `
              <p><strong>기타 요청사항:</strong></p>
              <p style="white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 4px;">${additionalInfo}</p>
            ` : ''}
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            이 메일은 AI Chat Hub Enterprise 플랜 문의 시스템에서 자동으로 발송되었습니다.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Enterprise contact error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send inquiry' },
      { status: 500 }
    );
  }
}
