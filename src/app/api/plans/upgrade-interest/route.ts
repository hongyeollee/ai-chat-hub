import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@/lib/supabase/server';
import { TIER_LIMITS, type SubscriptionTier } from '@/types';

// 관리자 알림 이메일 주소
const ADMIN_NOTIFICATION_EMAIL = 'zeler1005@gmail.com';

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

// POST /api/plans/upgrade-interest - 플랜 업그레이드 관심 표명
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

    const { tier } = await request.json();

    if (!tier || !['light', 'pro', 'enterprise'].includes(tier)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tier' },
        { status: 400 }
      );
    }

    // 사용자 프로필 가져오기
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name, subscription_tier')
      .eq('id', user.id)
      .single();

    const userName = profile?.name || '(이름 없음)';
    const userEmail = profile?.email || user.email || '(이메일 없음)';
    const currentTier = profile?.subscription_tier || 'free';
    const requestedTierConfig = TIER_LIMITS[tier as SubscriptionTier];

    const transporter = getSmtpTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!fromAddress) {
      throw new Error('SMTP_FROM is not configured');
    }

    // 관리자에게 이메일 발송
    await transporter.sendMail({
      from: fromAddress,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `[NexusAI] 플랜 업그레이드 요청 - ${userName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              플랜 업그레이드 요청
            </h1>
          </div>

          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <div style="background-color: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
              <p style="margin: 0; color: #166534; font-weight: 500;">
                사용자가 유료 플랜 업그레이드에 관심을 표명했습니다!
              </p>
            </div>

            <h2 style="color: #1f2937; font-size: 18px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
              사용자 정보
            </h2>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280; width: 120px;">이름</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-weight: 500;">${userName}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">이메일</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-weight: 500;">${userEmail}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">현재 플랜</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #1f2937; font-weight: 500;">${currentTier.toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">요청 플랜</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6;">
                  <span style="background-color: #7c3aed; color: white; padding: 4px 12px; border-radius: 20px; font-weight: 500;">
                    ${requestedTierConfig.name}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 12px; color: #6b7280;">요청 시간</td>
                <td style="padding: 12px; color: #1f2937; font-weight: 500;">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
              </tr>
            </table>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 16px; border-radius: 8px;">
              <p style="margin: 0; color: #1e40af; font-size: 14px;">
                <strong>참고:</strong> 결제 시스템이 연동되면 이 사용자에게 업그레이드 안내를 보내주세요.
              </p>
            </div>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
            이 메일은 NexusAI 플랜 업그레이드 관심 표명 시스템에서 자동으로 발송되었습니다.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Upgrade interest error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit interest' },
      { status: 500 }
    );
  }
}
