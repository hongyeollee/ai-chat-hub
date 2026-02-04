import { createClient } from '@/lib/supabase/server';
import type { UserOverride, AdminAuditAction, UserRole } from '@/types';
import { getCurrentMonthStart } from './credits';

/**
 * 관리자 권한 확인
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return data?.role === 'admin';
}

/**
 * 사용자의 역할 가져오기
 */
export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  return (data?.role as UserRole) || null;
}

/**
 * 사용자 오버라이드 조회 (만료 체크 포함)
 */
export async function getUserOverride(userId: string): Promise<UserOverride | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_overrides')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!data) {
    return null;
  }

  // 만료 체크
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data as UserOverride;
}

/**
 * 감사 로그 기록
 */
export async function logAdminAction(
  adminId: string,
  action: AdminAuditAction,
  targetUserId: string | null,
  details: Record<string, unknown>,
  request?: Request
): Promise<void> {
  const supabase = await createClient();

  await supabase.from('admin_audit_log').insert({
    admin_id: adminId,
    action,
    target_user_id: targetUserId,
    details,
    ip_address: request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || null,
    user_agent: request?.headers.get('user-agent') || null,
  });
}

/**
 * 크레딧 수동 부여 (Admin 전용)
 */
export async function grantCredits(
  adminId: string,
  targetUserId: string,
  amount: number,
  reason: string,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // 현재 월 계산
  const month = getCurrentMonthStart();

  try {
    // monthly_credits 업데이트 (purchased_credits에 추가)
    const { data: existing } = await supabase
      .from('monthly_credits')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('month', month)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from('monthly_credits')
        .update({
          purchased_credits: (existing.purchased_credits || 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update monthly_credits:', updateError);
        return { success: false, error: 'Failed to update credits' };
      }
    } else {
      const { error: insertError } = await supabase.from('monthly_credits').insert({
        user_id: targetUserId,
        month,
        base_credits: 0,
        rollover_credits: 0,
        purchased_credits: amount,
        used_credits: 0,
      });

      if (insertError) {
        console.error('Failed to insert monthly_credits:', insertError);
        return { success: false, error: 'Failed to create credits record' };
      }
    }

    // 새 잔액 계산
    const updatedCredits = existing
      ? (existing.base_credits || 0) + (existing.rollover_credits || 0) +
        (existing.purchased_credits || 0) + amount - (existing.used_credits || 0)
      : amount;

    // 트랜잭션 로그 기록
    await supabase.from('credit_transactions').insert({
      user_id: targetUserId,
      amount,
      balance_after: updatedCredits,
      type: 'admin_grant',
      description: `Admin grant: ${reason}`,
    });

    // 감사 로그 기록
    await logAdminAction(adminId, 'grant_credits', targetUserId, {
      amount,
      reason,
      month,
    }, request);

    return { success: true };
  } catch (error) {
    console.error('Error in grantCredits:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * 사용자 오버라이드 설정/수정
 */
export async function setUserOverride(
  adminId: string,
  targetUserId: string,
  override: Partial<Omit<UserOverride, 'id' | 'user_id' | 'created_by' | 'created_at' | 'updated_at'>>,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // 기존 오버라이드 조회
    const { data: existing } = await supabase
      .from('user_overrides')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (existing) {
      // 기존 오버라이드 업데이트
      const { error: updateError } = await supabase
        .from('user_overrides')
        .update({
          ...override,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Failed to update user_overrides:', updateError);
        return { success: false, error: 'Failed to update override' };
      }
    } else {
      // 새 오버라이드 생성
      const { error: insertError } = await supabase.from('user_overrides').insert({
        user_id: targetUserId,
        created_by: adminId,
        ...override,
      });

      if (insertError) {
        console.error('Failed to insert user_overrides:', insertError);
        return { success: false, error: 'Failed to create override' };
      }
    }

    // 감사 로그
    await logAdminAction(adminId, 'set_override', targetUserId, {
      previous: existing || null,
      new: override,
    }, request);

    return { success: true };
  } catch (error) {
    console.error('Error in setUserOverride:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * 사용자 오버라이드 삭제
 */
export async function removeUserOverride(
  adminId: string,
  targetUserId: string,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // 기존 오버라이드 조회 (로그용)
    const { data: existing } = await supabase
      .from('user_overrides')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (!existing) {
      return { success: false, error: 'No override found' };
    }

    // 오버라이드 삭제
    const { error: deleteError } = await supabase
      .from('user_overrides')
      .delete()
      .eq('user_id', targetUserId);

    if (deleteError) {
      console.error('Failed to delete user_overrides:', deleteError);
      return { success: false, error: 'Failed to delete override' };
    }

    // 감사 로그
    await logAdminAction(adminId, 'remove_override', targetUserId, {
      removed: existing,
    }, request);

    return { success: true };
  } catch (error) {
    console.error('Error in removeUserOverride:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * 사용자 역할 변경
 */
export async function changeUserRole(
  adminId: string,
  targetUserId: string,
  newRole: UserRole,
  request?: Request
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // 기존 역할 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single();

    if (!profile) {
      return { success: false, error: 'User not found' };
    }

    const previousRole = profile.role;

    // 역할 업데이트
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Failed to update profile role:', updateError);
      return { success: false, error: 'Failed to change role' };
    }

    // 감사 로그
    await logAdminAction(adminId, 'change_role', targetUserId, {
      previous_role: previousRole,
      new_role: newRole,
    }, request);

    return { success: true };
  } catch (error) {
    console.error('Error in changeUserRole:', error);
    return { success: false, error: 'Internal error' };
  }
}

/**
 * 감사 로그 조회
 */
export async function getAuditLogs(
  page: number = 1,
  limit: number = 50,
  targetUserId?: string
): Promise<{
  data: Array<{
    id: string;
    admin_id: string;
    action: AdminAuditAction;
    target_user_id: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    admin?: { email: string | null; name: string | null };
    target?: { email: string | null; name: string | null };
  }>;
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = await createClient();

  let query = supabase
    .from('admin_audit_log')
    .select(`
      *,
      admin:profiles!admin_audit_log_admin_id_fkey(email, name),
      target:profiles!admin_audit_log_target_user_id_fkey(email, name)
    `, { count: 'exact' });

  if (targetUserId) {
    query = query.eq('target_user_id', targetUserId);
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  return {
    data: data || [],
    total: count || 0,
    page,
    limit,
  };
}
