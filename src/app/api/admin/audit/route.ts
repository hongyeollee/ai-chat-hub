import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdmin, getAuditLogs } from '@/lib/utils/admin';

/**
 * GET /api/admin/audit - 감사 로그 조회
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const targetUserId = searchParams.get('targetUserId') || undefined;

    // 최대 100개 제한
    const actualLimit = Math.min(limit, 100);

    const result = await getAuditLogs(page, actualLimit, targetUserId);

    return NextResponse.json({
      success: true,
      ...result,
      totalPages: Math.ceil(result.total / actualLimit),
    });
  } catch (error) {
    console.error('Admin audit GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
