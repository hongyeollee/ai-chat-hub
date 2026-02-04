import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, getUserOverride, setUserOverride, removeUserOverride } from '@/lib/utils/admin';

/**
 * GET /api/admin/overrides?userId=xxx - 사용자 오버라이드 조회
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const override = await getUserOverride(targetUserId);

    return NextResponse.json({
      success: true,
      data: override,
    });
  } catch (error) {
    console.error('Admin overrides GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/overrides - 사용자 오버라이드 설정/수정
 */
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

    // 관리자 권한 확인
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { targetUserId, ...overrideData } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'targetUserId is required' },
        { status: 400 }
      );
    }

    // 대상 사용자 존재 확인
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', targetUserId)
      .single();

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found' },
        { status: 404 }
      );
    }

    // usage_type_override 검증
    if (overrideData.usage_type_override !== undefined &&
        overrideData.usage_type_override !== null &&
        !['daily', 'credits'].includes(overrideData.usage_type_override)) {
      return NextResponse.json(
        { success: false, error: 'usage_type_override must be "daily", "credits", or null' },
        { status: 400 }
      );
    }

    // 오버라이드 설정
    const result = await setUserOverride(user.id, targetUserId, overrideData, request);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully set override for ${targetUser.email}`,
    });
  } catch (error) {
    console.error('Admin overrides POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/overrides?userId=xxx - 사용자 오버라이드 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    if (!(await isAdmin(user.id))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const result = await removeUserOverride(user.id, targetUserId, request);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully removed override',
    });
  } catch (error) {
    console.error('Admin overrides DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
