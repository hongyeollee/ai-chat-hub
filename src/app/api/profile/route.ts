import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/profile - 현재 사용자 프로필 조회
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/profile - 프로필 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const updates = await request.json();

    // 업데이트 가능한 필드만 허용
    const allowedFields = [
      'name',
      'language',
      'timezone',
      'marketing_agreed',
      'custom_instructions',
      'preferred_model',
      'memory_enabled',
    ];

    const sanitizedUpdates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // 마케팅 동의 시점 자동 기록
    if ('marketing_agreed' in sanitizedUpdates) {
      sanitizedUpdates.marketing_agreed_at = sanitizedUpdates.marketing_agreed
        ? new Date().toISOString()
        : null;
    }

    sanitizedUpdates.updated_at = new Date().toISOString();

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update profile:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
