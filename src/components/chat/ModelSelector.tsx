'use client';

import { useTranslations } from 'next-intl';
import { useChatStore } from '@/stores/chatStore';
import { AI_PROVIDERS } from '@/types';

export function ModelSelector() {
  const t = useTranslations();
  const { selectedModels, toggleModel, isStreaming } = useChatStore();

  return (
    <div className="flex items-center gap-4 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {AI_PROVIDERS.map((provider) => {
        const isSelected = selectedModels.includes(provider.model);
        const isOnlySelected = isSelected && selectedModels.length === 1;

        return (
          <label
            key={provider.id}
            className={`
              flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-md transition-all
              ${isSelected
                ? 'bg-white dark:bg-gray-700 shadow-sm'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }
              ${isStreaming ? 'opacity-50 cursor-not-allowed' : ''}
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
                ${isSelected
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
                }
              `}
            >
              {provider.icon} {t(`model.${provider.id}`)}
            </span>
          </label>
        );
      })}
    </div>
  );
}
