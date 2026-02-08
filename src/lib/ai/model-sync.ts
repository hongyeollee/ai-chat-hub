/**
 * Model Synchronization
 *
 * Fetches available models from each provider's API and updates the cache.
 * Some providers (like Anthropic) don't have a model listing API,
 * so we fall back to config-based availability.
 */

import { MODEL_REGISTRY, type AIProvider, type ModelConfig } from '@/config/models';
import {
  updateModelAvailability,
  setSyncInProgress,
  isSyncInProgress,
} from './model-cache';

export interface ProviderSyncResult {
  provider: AIProvider;
  success: boolean;
  availableModels: string[];
  error?: string;
}

export interface SyncResult {
  success: boolean;
  results: ProviderSyncResult[];
  syncedAt: Date;
  totalModels: number;
  availableModels: number;
}

/**
 * Fetch available models from OpenAI
 */
async function fetchOpenAIModels(): Promise<ProviderSyncResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        provider: 'openai',
        success: false,
        availableModels: [],
        error: 'OPENAI_API_KEY not configured',
      };
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        provider: 'openai',
        success: false,
        availableModels: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const modelIds = data.data
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.includes('gpt'));

    return {
      provider: 'openai',
      success: true,
      availableModels: modelIds,
    };
  } catch (error) {
    return {
      provider: 'openai',
      success: false,
      availableModels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch available models from Anthropic
 * Note: Anthropic doesn't have a public model listing API,
 * so we validate by attempting to get model info
 */
async function fetchAnthropicModels(): Promise<ProviderSyncResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        provider: 'anthropic',
        success: false,
        availableModels: [],
        error: 'ANTHROPIC_API_KEY not configured',
      };
    }

    // Anthropic doesn't have a model list API
    // Return config-based models as available if API key exists
    const claudeModels = MODEL_REGISTRY
      .filter((m) => m.provider === 'anthropic' && m.enabled)
      .map((m) => m.providerModelId);

    return {
      provider: 'anthropic',
      success: true,
      availableModels: claudeModels,
    };
  } catch (error) {
    return {
      provider: 'anthropic',
      success: false,
      availableModels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch available models from Google
 */
async function fetchGoogleModels(): Promise<ProviderSyncResult> {
  try {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return {
        provider: 'google',
        success: false,
        availableModels: [],
        error: 'GOOGLE_GEMINI_API_KEY not configured',
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      return {
        provider: 'google',
        success: false,
        availableModels: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const modelIds = data.models
      ?.map((m: { name: string }) => m.name.replace('models/', ''))
      .filter((id: string) => id.includes('gemini')) || [];

    return {
      provider: 'google',
      success: true,
      availableModels: modelIds,
    };
  } catch (error) {
    return {
      provider: 'google',
      success: false,
      availableModels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch available models from Mistral
 */
async function fetchMistralModels(): Promise<ProviderSyncResult> {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return {
        provider: 'mistral',
        success: false,
        availableModels: [],
        error: 'MISTRAL_API_KEY not configured',
      };
    }

    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        provider: 'mistral',
        success: false,
        availableModels: [],
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const modelIds = data.data?.map((m: { id: string }) => m.id) || [];

    return {
      provider: 'mistral',
      success: true,
      availableModels: modelIds,
    };
  } catch (error) {
    return {
      provider: 'mistral',
      success: false,
      availableModels: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch available models from DeepSeek
 * DeepSeek uses OpenAI-compatible API
 */
async function fetchDeepSeekModels(): Promise<ProviderSyncResult> {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return {
        provider: 'deepseek',
        success: false,
        availableModels: [],
        error: 'DEEPSEEK_API_KEY not configured',
      };
    }

    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      // DeepSeek might not support model listing
      // Fall back to config-based models
      const deepseekModels = MODEL_REGISTRY
        .filter((m) => m.provider === 'deepseek' && m.enabled)
        .map((m) => m.providerModelId);

      return {
        provider: 'deepseek',
        success: true,
        availableModels: deepseekModels,
      };
    }

    const data = await response.json();
    const modelIds = data.data?.map((m: { id: string }) => m.id) || [];

    return {
      provider: 'deepseek',
      success: true,
      availableModels: modelIds.length > 0 ? modelIds : ['deepseek-chat'],
    };
  } catch (error) {
    // Fall back to config-based models on error
    const deepseekModels = MODEL_REGISTRY
      .filter((m) => m.provider === 'deepseek' && m.enabled)
      .map((m) => m.providerModelId);

    return {
      provider: 'deepseek',
      success: true,
      availableModels: deepseekModels,
    };
  }
}

/**
 * Provider fetch functions map
 */
const providerFetchFunctions: Record<AIProvider, () => Promise<ProviderSyncResult>> = {
  openai: fetchOpenAIModels,
  anthropic: fetchAnthropicModels,
  google: fetchGoogleModels,
  mistral: fetchMistralModels,
  deepseek: fetchDeepSeekModels,
};

/**
 * Sync models from all providers
 */
export async function syncAllModels(): Promise<SyncResult> {
  if (isSyncInProgress()) {
    return {
      success: false,
      results: [],
      syncedAt: new Date(),
      totalModels: MODEL_REGISTRY.length,
      availableModels: 0,
    };
  }

  setSyncInProgress(true);

  try {
    // Fetch from all providers in parallel
    const results = await Promise.all([
      fetchOpenAIModels(),
      fetchAnthropicModels(),
      fetchGoogleModels(),
      fetchMistralModels(),
      fetchDeepSeekModels(),
    ]);

    // Build availability map
    const availability: Record<string, boolean> = {};

    for (const model of MODEL_REGISTRY) {
      const providerResult = results.find((r) => r.provider === model.provider);

      if (providerResult?.success) {
        // Check if the provider model ID is in the available list
        // or if the provider doesn't support listing (like Anthropic)
        const isAvailable =
          providerResult.availableModels.includes(model.providerModelId) ||
          providerResult.availableModels.some((id) =>
            model.providerModelId.includes(id) || id.includes(model.providerModelId)
          );

        availability[model.id] = isAvailable;
      } else {
        // If provider sync failed, assume model is available (fail-open)
        availability[model.id] = model.enabled;
      }
    }

    // Update cache
    updateModelAvailability(availability);

    const availableCount = Object.values(availability).filter(Boolean).length;

    return {
      success: true,
      results,
      syncedAt: new Date(),
      totalModels: MODEL_REGISTRY.length,
      availableModels: availableCount,
    };
  } finally {
    setSyncInProgress(false);
  }
}

/**
 * Sync models from a specific provider
 */
export async function syncProviderModels(
  provider: AIProvider
): Promise<ProviderSyncResult> {
  const fetchFn = providerFetchFunctions[provider];
  if (!fetchFn) {
    return {
      provider,
      success: false,
      availableModels: [],
      error: `Unknown provider: ${provider}`,
    };
  }

  const result = await fetchFn();

  if (result.success) {
    // Update availability for this provider's models only
    const availability: Record<string, boolean> = {};

    MODEL_REGISTRY
      .filter((m) => m.provider === provider)
      .forEach((model) => {
        const isAvailable = result.availableModels.some(
          (id) =>
            model.providerModelId === id ||
            model.providerModelId.includes(id) ||
            id.includes(model.providerModelId)
        );
        availability[model.id] = isAvailable;
      });

    updateModelAvailability(availability);
  }

  return result;
}

/**
 * Get models that are configured but not available from providers
 */
export async function getUnavailableModels(): Promise<ModelConfig[]> {
  const syncResult = await syncAllModels();

  if (!syncResult.success) {
    return [];
  }

  const unavailableModels: ModelConfig[] = [];

  for (const model of MODEL_REGISTRY) {
    if (!model.enabled) continue;

    const providerResult = syncResult.results.find(
      (r) => r.provider === model.provider
    );

    if (providerResult?.success) {
      const isAvailable = providerResult.availableModels.some(
        (id) =>
          model.providerModelId === id ||
          model.providerModelId.includes(id) ||
          id.includes(model.providerModelId)
      );

      if (!isAvailable) {
        unavailableModels.push(model);
      }
    }
  }

  return unavailableModels;
}
