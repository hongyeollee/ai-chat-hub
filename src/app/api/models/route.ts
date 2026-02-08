import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MODEL_REGISTRY, getEnabledModels, type ModelConfig } from '@/config/models';
import { getAvailableModels, getCacheStats } from '@/lib/ai/model-cache';
import type { SubscriptionTier, ModelCategory } from '@/types';
import { TIER_LIMITS } from '@/types';

export interface ModelResponse {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  icon: string;
  credits: number;
  category: ModelCategory;
  description: string;
  available: boolean;
  allowedForTier: boolean;
}

export interface ModelsAPIResponse {
  success: boolean;
  data?: {
    models: ModelResponse[];
    tier: SubscriptionTier;
    allowedCategories: ModelCategory[];
    cacheStats?: {
      lastSyncTime: string | null;
      cacheStale: boolean;
    };
  };
  error?: string;
}

/**
 * GET /api/models - Get available models for the current user
 *
 * Returns all enabled models with availability status and tier access info.
 * Models are filtered based on cache availability and user's subscription tier.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json<ModelsAPIResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's subscription tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = (profile?.subscription_tier || 'free') as SubscriptionTier;
    const tierConfig = TIER_LIMITS[tier];
    const allowedCategories = tierConfig.allowedModelCategories;

    // Get available models from cache
    const availableModels = getAvailableModels();
    const availableModelIds = new Set(availableModels.map((m) => m.id));

    // Build response
    const models: ModelResponse[] = getEnabledModels().map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      providerName: model.providerName,
      icon: model.icon,
      credits: model.credits,
      category: model.category,
      description: model.description,
      available: availableModelIds.has(model.id),
      allowedForTier: allowedCategories.includes(model.category),
    }));

    // Get cache stats
    const stats = getCacheStats();

    return NextResponse.json<ModelsAPIResponse>({
      success: true,
      data: {
        models,
        tier,
        allowedCategories,
        cacheStats: {
          lastSyncTime: stats.lastSyncTime?.toISOString() || null,
          cacheStale: stats.cacheStale,
        },
      },
    });
  } catch (error) {
    console.error('Models GET error:', error);
    return NextResponse.json<ModelsAPIResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
