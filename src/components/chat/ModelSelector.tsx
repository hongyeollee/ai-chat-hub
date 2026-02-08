"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chatStore";
import {
  AI_PROVIDERS,
  getAllowedModelsForTier,
  getModelTranslationKey,
  type SubscriptionTier,
  type AIModel,
} from "@/types";

export function ModelSelector() {
  const t = useTranslations();
  const { selectedModels, toggleModel, isStreaming } = useChatStore();
  const [allowedModels, setAllowedModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAllowedModels = async () => {
      try {
        const response = await fetch("/api/profile");
        const result = await response.json();

        if (result.success && result.data) {
          const tier = (result.data.subscription_tier ||
            "free") as SubscriptionTier;
          setAllowedModels(getAllowedModelsForTier(tier));
        } else {
          // 기본값: Free 티어의 허용 모델
          setAllowedModels(getAllowedModelsForTier("free"));
        }
      } catch (error) {
        console.error("Failed to fetch profile for allowed models:", error);
        setAllowedModels(getAllowedModelsForTier("free"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllowedModels();
  }, []);

  // 허용된 모델만 필터링
  const filteredProviders = AI_PROVIDERS.filter((provider) =>
    allowedModels.includes(provider.model),
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="skeleton h-8 w-32" />
        <div className="skeleton h-8 w-32" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {filteredProviders.map((provider) => {
        const isSelected = selectedModels.includes(provider.model);
        const isOnlySelected = isSelected && selectedModels.length === 1;

        return (
          <label
            key={provider.id}
            className={`
              flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-md transition-all
              ${
                isSelected
                  ? "bg-white dark:bg-gray-700 shadow-sm"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }
              ${isStreaming ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleModel(provider.model)}
              disabled={isStreaming || isOnlySelected}
              className={`
                w-4 h-4 rounded border-gray-300 dark:border-gray-600
                text-blue-600 focus:ring-blue-500 focus:ring-offset-0
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            />
            <span
              className={`
                font-medium text-sm
                ${
                  isSelected
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400"
                }
              `}
            >
              {provider.icon}{" "}
              {t(`model.${getModelTranslationKey(provider.model)}`)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
