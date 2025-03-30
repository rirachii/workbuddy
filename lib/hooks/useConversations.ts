import { useState, useEffect } from 'react';
import { Conversation, Task } from '../types/conversation';

const STORAGE_KEY = 'jobhunter_conversations';

// Helper function to migrate old task format to new format
function migrateTask(task: any): Task {
  return {
    id: task.id || `task_${Date.now()}_${Math.random()}`,
    text: task.text || '',
    deadline: task.deadline || 'No deadline specified',
    subtasks: task.subtasks || [], // Add default empty array for subtasks
    isPriority: task.isPriority || false
  };
}

// Helper function to migrate old conversation format to new format
function migrateConversation(conversation: any): Conversation {
  return {
    id: conversation.id || `session_${Date.now()}`,
    timestamp: conversation.timestamp || new Date().toISOString(),
    summary: conversation.summary || '',
    tasks: (conversation.tasks || []).map(migrateTask),
    rawResponse: conversation.rawResponse || ''
  };
}

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
          // Migrate and sort conversations by timestamp, newest first
          const migratedConversations = parsed.map(migrateConversation)
            .sort((a: Conversation, b: Conversation) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          setConversations(migratedConversations);
          
          // Save migrated data back to localStorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedConversations));
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
    // Ensure the new conversation has the correct format
    const migratedConversation = migrateConversation(conversation);
    const updated = [migratedConversation, ...conversations];
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