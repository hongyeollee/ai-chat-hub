import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getKoreanDate, getRemainingUsage } from '@/lib/utils/usage';

// GET /api/usage/today - Get today's usage for the current user
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

    const dateKr = getKoreanDate();

    const { data: usage } = await supabase
      .from('daily_usage')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_kr', dateKr)
      .single();

    const requestCount = usage?.request_count || 0;
    const charCount = usage?.char_count || 0;

    const remaining = getRemainingUsage(requestCount, charCount);

    return NextResponse.json({
      success: true,
      data: {
        dateKr,
        requestCount,
        charCount,
        ...remaining,
      },
    });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
