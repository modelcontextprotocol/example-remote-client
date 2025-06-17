// React context for inference provider management

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  Model,
  InferenceMessage,
  InferenceMessageCallback,
} from '@/types/inference';
import { v4 as uuidv4 } from 'uuid';
import { OpenRouterApiProvider } from '@/providers/openrouter/api-provider';
import { OpenRouterOAuthProvider } from '@/providers/openrouter/oauth-provider';

interface InferenceContextValue {
  // Current provider state
  provider: InferenceProvider | null;
  isLoading: boolean;
  error: string | null;

  // Provider actions
  setProvider: (provider: InferenceProvider) => void;
  clearProvider: () => void;
  refreshAuthState: () => void; // Force refresh of auth state

  // Inference actions
  generateResponse: (request: InferenceRequest) => Promise<InferenceResponse>;
  selectModel: (modelId: string) => void;
  loadModels: () => Promise<Model[]>;

  // Convenience getters
  models: Model[];
  selectedModel: Model | undefined;
  isAuthenticated: boolean;
  
  // Message monitoring
  messages: InferenceMessage[];
  addMessageCallback: (callback: InferenceMessageCallback) => string; // Returns callback ID
  removeMessageCallback: (callbackId: string) => void;
  clearMessages: () => void;
}

const InferenceContext = createContext<InferenceContextValue | null>(null);

interface InferenceProviderProps {
  children: ReactNode;
}

export function InferenceContextProvider({ children }: InferenceProviderProps) {
  const [provider, setProviderState] = useState<InferenceProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    // Load saved model selection from localStorage
    return localStorage.getItem('selected_model_id') || undefined;
  });
  const [_, setAuthStateVersion] = useState(0); // Force re-renders on auth changes
  
  // Message callback management
  const [messageCallbacks, setMessageCallbacks] = useState<Map<string, InferenceMessageCallback>>(new Map());
  
  // Store messages in context for persistence
  const [messages, setMessages] = useState<InferenceMessage[]>([]);
  const maxMessages = 100; // Keep last 100 messages
  
  // Function to add a message to the stored messages
  const addMessage = useCallback((message: InferenceMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only the latest maxMessages
      return newMessages.slice(-maxMessages);
    });
  }, []);

  const setProvider = useCallback((newProvider: InferenceProvider) => {
    setProviderState(newProvider);
    setSelectedModelId(undefined);
    
    // Clear saved model selection when switching providers
    // (it will be restored during loadModels if still valid)
    localStorage.removeItem('selected_model_id');
    
    setError(null);
    setAuthStateVersion(prev => prev + 1); // Trigger re-render
  }, []);

  const clearProvider = useCallback(() => {
    if (provider) {
      provider.logout();
    }
    setProviderState(null);
    setSelectedModelId(undefined);
    
    // Clear saved model selection
    localStorage.removeItem('selected_model_id');
    
    setError(null);
    setAuthStateVersion(prev => prev + 1);
  }, [provider]);

  const refreshAuthState = useCallback(() => {
    setAuthStateVersion(prev => prev + 1);
  }, []);

  // Helper function to restore provider and load models
  const restoreProviderWithModels = useCallback(async (restoredProvider: InferenceProvider) => {
    setProviderState(restoredProvider);
    setAuthStateVersion(prev => prev + 1);
    
    try {
      await restoredProvider.loadModels();
      
      // Restore saved model selection
      const savedModelId = localStorage.getItem('selected_model_id');
      
      if (savedModelId && restoredProvider.models.find(m => m.id === savedModelId)) {
        restoredProvider.selectModel(savedModelId);
        setSelectedModelId(savedModelId);
      } else {
        // Clear invalid saved model
        if (savedModelId) {
          localStorage.removeItem('selected_model_id');
        }
        setSelectedModelId(restoredProvider.selectedModel?.id);
      }
      
      // Force a re-render to update context with loaded models
      setAuthStateVersion(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load models on provider restore:', error);
      setError(error instanceof Error ? error.message : 'Failed to load models');
    }
  }, []);

  // Auto-restore provider with stored credentials on mount
  useEffect(() => {
    const tryRestoreProvider = async () => {
      // Try API provider first
      const apiProvider = new OpenRouterApiProvider();
      if (apiProvider.isAuthenticated) {
        await restoreProviderWithModels(apiProvider);
        return;
      }

      // Try OAuth provider
      const oauthProvider = new OpenRouterOAuthProvider();
      if (oauthProvider.isAuthenticated) {
        await restoreProviderWithModels(oauthProvider);
        return;
      }
    };

    tryRestoreProvider().catch(console.error);
  }, [restoreProviderWithModels]);

  const generateResponse = useCallback(async (request: InferenceRequest): Promise<InferenceResponse> => {
    if (!provider) {
      throw new Error('No inference provider configured');
    }

    setIsLoading(true);
    setError(null);
    
    const requestId = uuidv4();
    const startTime = Date.now();
    
    // Broadcast request message
    const requestMessage: InferenceMessage = {
      id: `${requestId}-request`,
      timestamp: new Date(),
      type: 'request',
      providerId: provider.id,
      providerName: provider.name,
      model: request.model,
      request,
    };
    
    // Store message in context
    addMessage(requestMessage);
    
    messageCallbacks.forEach(callback => {
      try {
        callback(requestMessage);
      } catch (error) {
        console.error('Error in inference message callback:', error);
      }
    });

    try {
      const response = await provider.generateResponse(request);
      
      // Broadcast response message
      const responseMessage: InferenceMessage = {
        id: `${requestId}-response`,
        timestamp: new Date(),
        type: 'response',
        providerId: provider.id,
        providerName: provider.name,
        model: request.model,
        response,
        duration: Date.now() - startTime,
      };
      
      // Store message in context
      addMessage(responseMessage);
      
      messageCallbacks.forEach(callback => {
        try {
          callback(responseMessage);
        } catch (error) {
          console.error('Error in inference message callback:', error);
        }
      });
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Inference request failed';
      setError(errorMessage);
      
      // Broadcast error message
      const errorMessageObj: InferenceMessage = {
        id: `${requestId}-error`,
        timestamp: new Date(),
        type: 'error',
        providerId: provider.id,
        providerName: provider.name,
        model: request.model,
        error: err,
        duration: Date.now() - startTime,
      };
      
      // Store message in context
      addMessage(errorMessageObj);
      
      messageCallbacks.forEach(callback => {
        try {
          callback(errorMessageObj);
        } catch (error) {
          console.error('Error in inference message callback:', error);
        }
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [provider, messageCallbacks, addMessage]);

  const selectModel = useCallback((modelId: string) => {
    if (!provider) {
      throw new Error('No inference provider configured');
    }

    try {
      provider.selectModel(modelId);
      setSelectedModelId(modelId);
      
      // Persist model selection to localStorage
      if (modelId) {
        localStorage.setItem('selected_model_id', modelId);
      } else {
        localStorage.removeItem('selected_model_id');
      }
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to select model';
      setError(errorMessage);
      throw err;
    }
  }, [provider]);

  const loadModels = useCallback(async (): Promise<Model[]> => {
    if (!provider) {
      throw new Error('No inference provider configured');
    }

    setIsLoading(true);
    setError(null);

    try {
      const models = await provider.loadModels();
      
      // Try to restore saved model selection
      const savedModelId = localStorage.getItem('selected_model_id');
      if (savedModelId && models.find(m => m.id === savedModelId)) {
        // Saved model exists in the available models, select it
        provider.selectModel(savedModelId);
        setSelectedModelId(savedModelId);
      } else {
        // Use provider's default selection or clear invalid saved selection
        if (savedModelId && !models.find(m => m.id === savedModelId)) {
          // Remove invalid saved model
          localStorage.removeItem('selected_model_id');
        }
        setSelectedModelId(provider.selectedModel?.id);
      }
      
      return models;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  // Message callback management
  const addMessageCallback = useCallback((callback: InferenceMessageCallback): string => {
    const callbackId = uuidv4();
    setMessageCallbacks(prev => new Map(prev).set(callbackId, callback));
    return callbackId;
  }, []);

  const removeMessageCallback = useCallback((callbackId: string) => {
    setMessageCallbacks(prev => {
      const newMap = new Map(prev);
      newMap.delete(callbackId);
      return newMap;
    });
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const contextValue: InferenceContextValue = {
    provider,
    isLoading,
    error,
    setProvider,
    clearProvider,
    refreshAuthState,
    generateResponse,
    selectModel,
    loadModels,
    models: provider?.models || [],
    selectedModel: selectedModelId ? provider?.models.find(m => m.id === selectedModelId) : undefined,
    isAuthenticated: provider?.isAuthenticated || false,
    messages,
    addMessageCallback,
    removeMessageCallback,
    clearMessages,
  };


  return (
    <InferenceContext.Provider value={contextValue}>
      {children}
    </InferenceContext.Provider>
  );
}

export function useInference(): InferenceContextValue {
  const context = useContext(InferenceContext);
  if (!context) {
    throw new Error('useInference must be used within an InferenceProvider');
  }
  return context;
}