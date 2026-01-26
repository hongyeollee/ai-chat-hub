'use client';

import { useTranslations } from 'next-intl';
import { useChatStore } from '@/stores/chatStore';
import { useEffect, useState, useRef, useCallback } from 'react';
import type { Conversation } from '@/types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const t = useTranslations();
  const {
    conversations,
    currentConversationId,
    setConversations,
    setCurrentConversationId,
    deleteConversation,
    setMessages,
  } = useChatStore();
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  const fetchConversations = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    try {
      const response = await fetch('/api/conversations');
      const result = await response.json();
      if (result.success) {
        setConversations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [setConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = async (conversation: Conversation) => {
    setCurrentConversationId(conversation.id);

    // Fetch messages for this conversation
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages`);
      const result = await response.json();
      if (result.success) {
        setMessages(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }

    onClose();
  };

  const handleNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    onClose();
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    if (!confirm(t('chat.confirmDelete'))) return;

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        deleteConversation(id);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={handleNewChat}
              className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              + {t('chat.newChat')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <h2 className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              {t('chat.conversations')}
            </h2>

            {loading ? (
              <div className="p-4 text-center text-gray-500">{t('common.loading')}</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {t('chat.noConversations')}
              </div>
            ) : (
              <ul className="space-y-1 mt-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectConversation(conversation)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectConversation(conversation);
                        }
                      }}
                      className={`
                        w-full text-left px-3 py-2 rounded-lg group flex items-center justify-between cursor-pointer
                        ${
                          currentConversationId === conversation.id
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      <span className="truncate flex-1">
                        {conversation.title || 'New conversation'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conversation.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        title={t('chat.deleteConversation')}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
