/**
 * Model Availability Cache
 *
 * Provides in-memory caching for model availability status.
 * This cache is refreshed periodically or on-demand via the sync API.
 */

import { MODEL_REGISTRY, type ModelConfig } from '@/config/models';

// Cache state
let modelAvailabilityCache: Map<string, boolean> = new Map();
let lastSyncTime: Date | null = null;
let syncInProgress = false;

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the cache with all models as available
 */
function initializeCache(): void {
  MODEL_REGISTRY.forEach((model) => {
    modelAvailabilityCache.set(model.id, model.enabled);
  });
  lastSyncTime = new Date();
}

// Initialize on module load
initializeCache();

/**
 * Check if a specific model is available
 */
export function isModelAvailable(modelId: string): boolean {
  // If model is not in registry, it's not available
  const model = MODEL_REGISTRY.find((m) => m.id === modelId);
  if (!model || !model.enabled) {
    return false;
  }

  // Check cache
  return modelAvailabilityCache.get(modelId) ?? true;
}

/**
 * Get all available models
 */
export function getAvailableModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter(
    (model) => model.enabled && isModelAvailable(model.id)
  );
}

/**
 * Update the availability of a specific model
 */
export function setModelAvailability(modelId: string, available: boolean): void {
  modelAvailabilityCache.set(modelId, available);
}

/**
 * Update availability for multiple models
 */
export function updateModelAvailability(
  availability: Record<string, boolean>
): void {
  Object.entries(availability).forEach(([modelId, available]) => {
    modelAvailabilityCache.set(modelId, available);
  });
  lastSyncTime = new Date();
}

/**
 * Check if cache needs refresh
 */
export function isCacheStale(): boolean {
  if (!lastSyncTime) {
    return true;
  }
  return Date.now() - lastSyncTime.getTime() > CACHE_TTL_MS;
}

/**
 * Get last sync timestamp
 */
export function getLastSyncTime(): Date | null {
  return lastSyncTime;
}

/**
 * Check if sync is in progress
 */
export function isSyncInProgress(): boolean {
  return syncInProgress;
}

/**
 * Set sync in progress flag
 */
export function setSyncInProgress(inProgress: boolean): void {
  syncInProgress = inProgress;
}

/**
 * Reset cache to initial state
 */
export function resetCache(): void {
  initializeCache();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalModels: number;
  availableModels: number;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
  cacheStale: boolean;
} {
  const availableCount = MODEL_REGISTRY.filter(
    (m) => m.enabled && isModelAvailable(m.id)
  ).length;

  return {
    totalModels: MODEL_REGISTRY.length,
    availableModels: availableCount,
    lastSyncTime,
    syncInProgress,
    cacheStale: isCacheStale(),
  };
}
