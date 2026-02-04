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
          w-72 sidebar
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <button
              onClick={handleNewChat}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('chat.newChat')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <h2 className="px-2 py-1 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              {t('chat.conversations')}
            </h2>

            {loading ? (
              <div className="space-y-2 mt-3">
                <div className="skeleton h-10 w-full"></div>
                <div className="skeleton h-10 w-full"></div>
                <div className="skeleton h-10 w-3/4"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">
                {t('chat.noConversations')}
              </div>
            ) : (
              <ul className="space-y-1 mt-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id} className="animate-fade-in">
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
                        sidebar-item w-full text-left group flex items-center justify-between
                        ${currentConversationId === conversation.id ? 'active' : ''}
                      `}
                    >
                      <span className="truncate flex-1 text-sm">
                        {conversation.title || 'New conversation'}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conversation.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[var(--surface-active)] rounded-md transition-all"
                        title={t('chat.deleteConversation')}
                      >
                        <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
