import { useState, useEffect } from 'react';
import { Conversation } from '../types/conversation';

const STORAGE_KEY = 'jobhunter_conversations';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load conversations from localStorage on mount
  useEffect(() => {
    const loadConversations = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Sort conversations by timestamp, newest first
          setConversations(parsed.sort((a: Conversation, b: Conversation) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          ));
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);

  // Add a new conversation
  const addConversation = (conversation: Conversation) => {
    const updated = [conversation, ...conversations];
    setConversations(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  // Delete a conversation
  const deleteConversation = (id: string) => {
    const updated = conversations.filter(conv => conv.id !== id);
    setConversations(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Clear all conversations
  const clearConversations = () => {
    setConversations([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing conversations:', error);
    }
  };

  // Get recent conversations (for context)
  const getRecentConversations = (limit: number = 5) => {
    return conversations.slice(0, limit);
  };

  return {
    conversations,
    isLoading,
    addConversation,
    deleteConversation,
    clearConversations,
    getRecentConversations,
  };
} 