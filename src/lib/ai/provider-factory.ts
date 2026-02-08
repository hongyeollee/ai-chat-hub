/**
 * Provider Factory
 *
 * Centralizes the logic for selecting the appropriate streaming function
 * based on the model configuration. This replaces the switch statements
 * in the messages API route.
 */

import {
  getEnabledModelConfig,
  type ModelConfig,
  type AIProvider,
} from '@/config/models';
import { streamOpenAI, isQuotaError, getOpenAIErrorMessage } from './openai';
import { streamClaude, isClaudeQuotaError, getClaudeErrorMessage } from './claude';
import { streamGemini } from './gemini';
import { streamMistral, isMistralQuotaError, getMistralErrorMessage } from './mistral';
import { streamDeepSeek, isDeepSeekQuotaError, getDeepSeekErrorMessage } from './deepseek';
import type { Message } from '@/types';

// Stream function type
type StreamFunction = (
  providerModelId: string,
  messages: Message[],
  summary: string | null,
  customInstructions: string | null,
  modelSwitchContext: string | null,
  alternativeResponseContext: string | null,
  systemPrompt: string
) => AsyncGenerator<string, void, unknown>;

// Provider stream function mapping
const providerStreamFunctions: Record<AIProvider, StreamFunction> = {
  openai: (providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt) =>
    streamOpenAI(providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt),

  anthropic: (providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt) =>
    streamClaude(providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt),

  google: (providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt) =>
    streamGemini(providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt),

  mistral: (providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt) =>
    streamMistral(providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt),

  deepseek: (providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt) =>
    streamDeepSeek(providerModelId, messages, summary, customInstructions, modelSwitchContext, alternativeResponseContext, systemPrompt),
};

// Error checker type
type ErrorChecker = (error: unknown) => boolean;

// Error message getter type
type ErrorMessageGetter = (error: unknown) => string;

// Provider error handling
const providerErrorCheckers: Record<AIProvider, ErrorChecker> = {
  openai: isQuotaError,
  anthropic: isClaudeQuotaError,
  google: () => false, // Google doesn't have a specific quota check exposed
  mistral: isMistralQuotaError,
  deepseek: isDeepSeekQuotaError,
};

const providerErrorMessages: Record<AIProvider, ErrorMessageGetter> = {
  openai: getOpenAIErrorMessage,
  anthropic: getClaudeErrorMessage,
  google: () => 'Gemini 응답 중 오류가 발생했습니다.',
  mistral: getMistralErrorMessage,
  deepseek: getDeepSeekErrorMessage,
};

export interface StreamOptions {
  messages: Message[];
  summary: string | null;
  customInstructions: string | null;
  modelSwitchContext: string | null;
  alternativeResponseContext: string | null;
}

/**
 * Get the streaming generator for a specific model
 */
export function getStreamGenerator(
  modelId: string,
  options: StreamOptions
): AsyncGenerator<string, void, unknown> {
  const config = getEnabledModelConfig(modelId);

  if (!config) {
    throw new Error(`Model ${modelId} not found or disabled`);
  }

  const streamFn = providerStreamFunctions[config.provider];

  return streamFn(
    config.providerModelId,
    options.messages,
    options.summary,
    options.customInstructions,
    options.modelSwitchContext,
    options.alternativeResponseContext,
    config.systemPrompt
  );
}

/**
 * Get the model configuration for a model ID
 * Throws if model is not found or disabled
 */
export function getModelConfigOrThrow(modelId: string): ModelConfig {
  const config = getEnabledModelConfig(modelId);

  if (!config) {
    throw new Error(`Model ${modelId} not found or disabled`);
  }

  return config;
}

/**
 * Get a user-friendly error message based on the model's provider
 */
export function getProviderErrorMessage(modelId: string, error: unknown): string {
  const config = getEnabledModelConfig(modelId);

  if (!config) {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  const errorChecker = providerErrorCheckers[config.provider];
  const errorMessageGetter = providerErrorMessages[config.provider];

  if (errorChecker(error)) {
    return errorMessageGetter(error);
  }

  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Check if an error is a quota/rate limit error for a specific model
 */
export function isProviderQuotaError(modelId: string, error: unknown): boolean {
  const config = getEnabledModelConfig(modelId);

  if (!config) {
    return false;
  }

  const errorChecker = providerErrorCheckers[config.provider];
  return errorChecker(error);
}
