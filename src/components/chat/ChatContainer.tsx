'use client';

import { ModelSelector } from './ModelSelector';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatContainer() {
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
