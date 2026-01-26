'use client';

import { useTranslations } from 'next-intl';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  const t = useTranslations();

  if (!content) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-600 dark:text-gray-400">{t('chat.thinking')}</span>
        <span className="animate-pulse">●</span>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap break-words">
      {content}
      <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse" />
    </div>
  );
}
