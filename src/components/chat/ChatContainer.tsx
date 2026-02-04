'use client';

import { useEffect, useState } from 'react';
import { ModelSelector } from './ModelSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/stores/chatStore';
import { getAllowedModelsForTier, type AIModel, type SubscriptionTier } from '@/types';

export function ChatContainer() {
  const { setSelectedModels, selectedModels } = useChatStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // 프로필에서 선호 모델과 티어 정보 가져오기
    const initializePreferredModel = async () => {
      try {
        const response = await fetch('/api/profile');
        const result = await response.json();

        if (result.success && result.data) {
          const profile = result.data;
          const tier = (profile.subscription_tier || 'free') as SubscriptionTier;
          const preferredModel = profile.preferred_model as AIModel;
          const allowedModels = getAllowedModelsForTier(tier);

          // 선호 모델이 현재 티어에서 허용되는지 확인
          if (preferredModel && allowedModels.includes(preferredModel)) {
            setSelectedModels([preferredModel]);
          } else {
            // 허용되지 않으면 첫 번째 허용 모델로 설정
            setSelectedModels([allowedModels[0]]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile for preferred model:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    // 아직 초기화되지 않았을 때만 실행
    if (!isInitialized) {
      initializePreferredModel();
    }
  }, [isInitialized, setSelectedModels]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <ModelSelector />
      </div>

      <MessageList />

      <MessageInput />
    </div>
  );
}
