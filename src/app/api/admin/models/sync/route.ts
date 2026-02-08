import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncAllModels, syncProviderModels, type SyncResult, type ProviderSyncResult } from '@/lib/ai/model-sync';
import { getCacheStats } from '@/lib/ai/model-cache';
import type { AIProvider } from '@/config/models';

export interface SyncAPIResponse {
  success: boolean;
  data?: SyncResult | ProviderSyncResult;
  error?: string;
}

/**
 * POST /api/admin/models/sync - Sync model availability from providers
 *
 * Admin-only endpoint to refresh model availability cache.
 * Optionally sync a specific provider with ?provider=openai query param.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<SyncAPIResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json<SyncAPIResponse>(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Check if specific provider is requested
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider') as AIProvider | null;

    if (provider) {
      // Sync specific provider
      const validProviders: AIProvider[] = ['openai', 'anthropic', 'google', 'mistral', 'deepseek'];
      if (!validProviders.includes(provider)) {
        return NextResponse.json<SyncAPIResponse>(
          { success: false, error: `Invalid provider: ${provider}` },
          { status: 400 }
        );
      }

      const result = await syncProviderModels(provider);

      return NextResponse.json<SyncAPIResponse>({
        success: result.success,
        data: result,
        error: result.error,
      });
    }

    // Sync all providers
    const result = await syncAllModels();

    return NextResponse.json<SyncAPIResponse>({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Model sync error:', error);
    return NextResponse.json<SyncAPIResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/models/sync - Get sync status
 *
 * Returns current cache status and last sync time.
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const stats = getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        totalModels: stats.totalModels,
        availableModels: stats.availableModels,
        lastSyncTime: stats.lastSyncTime?.toISOString() || null,
        syncInProgress: stats.syncInProgress,
        cacheStale: stats.cacheStale,
      },
    });
  } catch (error) {
    console.error('Model sync status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
