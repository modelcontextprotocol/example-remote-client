// React context for conversation management and agent loop orchestration

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  Conversation,
  ConversationMessage,
  ConversationContextValue,
  AgentLoopState,
} from '@/types/conversation';
import { useAgentLoop } from '@/hooks/useAgentLoop';

const ConversationContext = createContext<ConversationContextValue | null>(null);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [agentLoopStates, setAgentLoopStates] = useState<Map<string, AgentLoopState>>(new Map());
  
  const hasLoadedPersisted = useRef(false);
  const { executeAgentLoop, stopLoop, getLoopState } = useAgentLoop();

  // Load persisted conversations from localStorage on mount
  useEffect(() => {
    if (hasLoadedPersisted.current) return;
    hasLoadedPersisted.current = true;
    
    try {
      const persistedData = localStorage.getItem('conversations');
      if (persistedData) {
        const persistedConversations: Conversation[] = JSON.parse(persistedData);
        // Convert date strings back to Date objects
        const restored = persistedConversations.map(conv => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        }));
        setConversations(restored);
        
        // Set active conversation to the most recent one
        if (restored.length > 0) {
          const mostRecent = restored.reduce((latest, conv) => 
            conv.updatedAt > latest.updatedAt ? conv : latest
          );
          setActiveConversationId(mostRecent.id);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted conversations:', error);
    }
  }, []);

  // Persist conversations to localStorage when they change
  useEffect(() => {
    if (hasLoadedPersisted.current && conversations.length > 0) {
      try {
        localStorage.setItem('conversations', JSON.stringify(conversations));
      } catch (error) {
        console.error('Failed to persist conversations:', error);
      }
    }
  }, [conversations]);

  // Helper: Generate conversation title from first user message
  const generateConversationTitle = useCallback((firstMessage: string): string => {
    // Take first 50 characters and clean up
    const title = firstMessage
      .replace(/[^\w\s]/g, '')
      .trim()
      .substring(0, 50);
    
    return title || 'New Conversation';
  }, []);

  const createConversation = useCallback((title?: string): string => {
    const conversationId = uuidv4();
    const now = new Date();
    
    const newConversation: Conversation = {
      id: conversationId,
      title: title || 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      status: 'idle',
    };

    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(conversationId);
    
    return conversationId;
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    // Stop any running agent loop
    stopLoop(conversationId);
    
    // Remove from conversations
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    
    // Remove agent loop state
    setAgentLoopStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(conversationId);
      return newMap;
    });
    
    // If this was the active conversation, set to the next available one
    if (activeConversationId === conversationId) {
      setConversations(current => {
        const remaining = current.filter(conv => conv.id !== conversationId);
        setActiveConversationId(remaining.length > 0 ? remaining[0].id : undefined);
        return remaining;
      });
    }
  }, [activeConversationId, stopLoop]);

  const setActiveConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const updateConversationTitle = useCallback((conversationId: string, title: string) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, title, updatedAt: new Date() }
          : conv
      )
    );
  }, []);

  const getConversation = useCallback((conversationId: string): Conversation | undefined => {
    return conversations.find(conv => conv.id === conversationId);
  }, [conversations]);

  const addUserMessage = useCallback((conversationId: string, content: string) => {
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: [{ type: 'text', text: content }],
      timestamp: new Date(),
    };

    setConversations(prev => 
      prev.map(conv => {
        if (conv.id === conversationId) {
          // Auto-generate title from first user message
          const title = conv.messages.length === 0 
            ? generateConversationTitle(content)
            : conv.title;
            
          return {
            ...conv,
            title,
            messages: [...conv.messages, userMessage],
            updatedAt: new Date(),
            status: 'idle' as const,
          };
        }
        return conv;
      })
    );
  }, [generateConversationTitle]);

  // Update conversation state from agent loop
  const updateConversation = useCallback((updatedConversation: Conversation) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      )
    );
  }, []);

  const sendMessage = useCallback(async (conversationId: string, content: string): Promise<void> => {
    // Add user message first
    addUserMessage(conversationId, content);
    
    // Get the updated conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Create updated conversation with the new user message
    const userMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'user',
      content: [{ type: 'text', text: content }],
      timestamp: new Date(),
    };

    const updatedConversation: Conversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
      updatedAt: new Date(),
      status: 'thinking',
    };

    // Start agent loop
    try {
      await executeAgentLoop(updatedConversation, updateConversation);
    } catch (error) {
      // Update conversation with error state
      const errorConversation: Conversation = {
        ...updatedConversation,
        status: 'error',
        error: error instanceof Error ? error.message : 'Agent loop failed',
        updatedAt: new Date(),
      };
      updateConversation(errorConversation);
      throw error;
    }
  }, [conversations, addUserMessage, executeAgentLoop, updateConversation]);

  const continueConversation = useCallback(async (conversationId: string): Promise<void> => {
    const conversation = conversations.find(conv => conv.id === conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    try {
      await executeAgentLoop(conversation, updateConversation);
    } catch (error) {
      const errorConversation: Conversation = {
        ...conversation,
        status: 'error',
        error: error instanceof Error ? error.message : 'Agent loop failed',
        updatedAt: new Date(),
      };
      updateConversation(errorConversation);
      throw error;
    }
  }, [conversations, executeAgentLoop, updateConversation]);

  const stopAgentLoop = useCallback((conversationId: string) => {
    stopLoop(conversationId);
    
    // Update conversation status
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, status: 'idle' as const, updatedAt: new Date() }
          : conv
      )
    );
  }, [stopLoop]);

  const getAgentLoopState = useCallback((conversationId: string): AgentLoopState | undefined => {
    return getLoopState(conversationId);
  }, [getLoopState]);

  const contextValue: ConversationContextValue = {
    conversations,
    activeConversationId,
    agentLoopStates,
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
    getConversation,
    addUserMessage,
    sendMessage,
    continueConversation,
    stopAgentLoop,
    getAgentLoopState,
  };

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation(): ConversationContextValue {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}