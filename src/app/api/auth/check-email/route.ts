import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/check-email - 이메일 존재 여부 확인
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Supabase Auth에서 유저 확인 (auth.users 테이블)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('Failed to list users:', listError);
      return NextResponse.json(
        { success: false, error: 'Failed to check email' },
        { status: 500 }
      );
    }

    const existingUser = users?.find(u => u.email === email);

    console.log('Check email:', email, 'Auth user exists:', !!existingUser);

    return NextResponse.json({
      success: true,
      exists: !!existingUser,
    });
  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
