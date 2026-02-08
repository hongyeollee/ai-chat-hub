/**
 * Central Model Registry
 *
 * This file contains all AI model configurations in a single place.
 * To add a new model, simply add an entry to MODEL_REGISTRY.
 *
 * Model IDs should be unique and used throughout the application.
 * providerModelId is the actual model identifier used when calling the provider's API.
 */

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'deepseek';
export type ModelCategory = 'low' | 'medium' | 'high';

export interface ModelConfig {
  /** Unique identifier used in the application */
  id: string;
  /** AI provider */
  provider: AIProvider;
  /** Actual model ID used in API calls to the provider */
  providerModelId: string;
  /** Display name */
  name: string;
  /** Provider display name */
  providerName: string;
  /** Emoji icon */
  icon: string;
  /** Credits cost per message */
  credits: number;
  /** Category for tier access control */
  category: ModelCategory;
  /** Description of the model */
  description: string;
  /** Whether the model is enabled */
  enabled: boolean;
  /** Default system prompt for this provider */
  systemPrompt: string;
}

/**
 * Central registry of all AI models
 * Add new models here - no other files need to be modified
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // OpenAI Models
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    providerModelId: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerName: 'OpenAI',
    icon: '🤖',
    credits: 1,
    category: 'low',
    description: '빠르고 효율적인 일상 대화용',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    providerModelId: 'gpt-4o',
    name: 'GPT-4o',
    providerName: 'OpenAI',
    icon: '🧠',
    credits: 15,
    category: 'high',
    description: 'OpenAI의 최신 고성능 모델',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },

  // Google Models
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    providerModelId: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    providerName: 'Google',
    icon: '✨',
    credits: 1,
    category: 'low',
    description: '빠른 응답의 구글 AI',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },

  // DeepSeek Models
  {
    id: 'deepseek-v3',
    provider: 'deepseek',
    providerModelId: 'deepseek-chat',
    name: 'DeepSeek V3',
    providerName: 'DeepSeek',
    icon: '🔍',
    credits: 1,
    category: 'low',
    description: '코딩과 추론에 강한 AI',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },

  // Mistral Models
  {
    id: 'mistral-small-3',
    provider: 'mistral',
    providerModelId: 'mistral-small-latest',
    name: 'Mistral Small 3',
    providerName: 'Mistral',
    icon: '💨',
    credits: 1,
    category: 'low',
    description: '가볍고 빠른 유럽 AI',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },
  {
    id: 'mistral-medium-3',
    provider: 'mistral',
    providerModelId: 'mistral-medium-latest',
    name: 'Mistral Medium 3',
    providerName: 'Mistral',
    icon: '🌀',
    credits: 2,
    category: 'medium',
    description: '균형 잡힌 성능의 AI',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },

  // Anthropic/Claude Models
  {
    id: 'claude-haiku-3.5',
    provider: 'anthropic',
    providerModelId: 'claude-3-5-haiku-latest',
    name: 'Claude Haiku 3.5',
    providerName: 'Anthropic',
    icon: '🎋',
    credits: 5,
    category: 'medium',
    description: '빠르고 정확한 Anthropic AI',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },
  {
    id: 'claude-sonnet-4.5',
    provider: 'anthropic',
    providerModelId: 'claude-sonnet-4-5-20250514',
    name: 'Claude Sonnet 4.5',
    providerName: 'Anthropic',
    icon: '🎭',
    credits: 20,
    category: 'high',
    description: 'Anthropic의 최고 성능 모델',
    enabled: true,
    systemPrompt: "You are NexusAI, a helpful assistant. Answer the user's request directly with concrete, actionable content. Respond in the user's language; if unclear, default to Korean. Avoid generic greetings or deferring questions like 'How can I assist you today?'.",
  },
];

// ============================================================================
// Derived Types and Utilities
// ============================================================================

/** Type for all valid model IDs */
export type AIModelId = (typeof MODEL_REGISTRY)[number]['id'];

/** Get enabled models only */
export function getEnabledModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.enabled);
}

/** Get a specific model config by ID */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId);
}

/** Get a specific enabled model config by ID */
export function getEnabledModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find((m) => m.id === modelId && m.enabled);
}

/** Get models by provider */
export function getModelsByProvider(provider: AIProvider): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider && m.enabled);
}

/** Get models by category */
export function getModelsByCategory(category: ModelCategory): ModelConfig[] {
  return MODEL_REGISTRY.filter((m) => m.category === category && m.enabled);
}

/** Check if a model ID is valid and enabled */
export function isValidModel(modelId: string): boolean {
  return MODEL_REGISTRY.some((m) => m.id === modelId && m.enabled);
}

/** Get credit cost for a model */
export function getModelCredits(modelId: string): number {
  const model = getModelConfig(modelId);
  return model?.credits ?? 1;
}

/** Get category for a model */
export function getModelCategory(modelId: string): ModelCategory | undefined {
  const model = getModelConfig(modelId);
  return model?.category;
}

/** Get all model IDs */
export function getAllModelIds(): string[] {
  return MODEL_REGISTRY.map((m) => m.id);
}

/** Get enabled model IDs */
export function getEnabledModelIds(): string[] {
  return getEnabledModels().map((m) => m.id);
}

// ============================================================================
// Derived Lookups (for backward compatibility)
// ============================================================================

/** Model credits lookup (backward compatible) */
export const MODEL_CREDITS_MAP: Record<string, number> = Object.fromEntries(
  MODEL_REGISTRY.map((m) => [m.id, m.credits])
);

/** Model categories grouped (backward compatible) */
export const MODEL_CATEGORIES_MAP: Record<ModelCategory, string[]> = {
  low: MODEL_REGISTRY.filter((m) => m.category === 'low' && m.enabled).map((m) => m.id),
  medium: MODEL_REGISTRY.filter((m) => m.category === 'medium' && m.enabled).map((m) => m.id),
  high: MODEL_REGISTRY.filter((m) => m.category === 'high' && m.enabled).map((m) => m.id),
};

/** Model to category mapping (backward compatible) */
export const MODEL_TO_CATEGORY_MAP: Record<string, ModelCategory> = Object.fromEntries(
  MODEL_REGISTRY.map((m) => [m.id, m.category])
);

/** Model info lookup (backward compatible) */
export const MODEL_INFO_MAP: Record<string, ModelConfig> = Object.fromEntries(
  MODEL_REGISTRY.map((m) => [m.id, m])
);
