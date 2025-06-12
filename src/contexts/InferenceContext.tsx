// React context for inference provider management

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  Model,
} from '@/types/inference';
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
}

const InferenceContext = createContext<InferenceContextValue | null>(null);

interface InferenceProviderProps {
  children: ReactNode;
}

export function InferenceContextProvider({ children }: InferenceProviderProps) {
  const [provider, setProviderState] = useState<InferenceProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);
  const [_, setAuthStateVersion] = useState(0); // Force re-renders on auth changes

  const setProvider = useCallback((newProvider: InferenceProvider) => {
    setProviderState(newProvider);
    setSelectedModelId(undefined);
    setError(null);
    setAuthStateVersion(prev => prev + 1); // Trigger re-render
  }, []);

  const clearProvider = useCallback(() => {
    if (provider) {
      provider.logout();
    }
    setProviderState(null);
    setSelectedModelId(undefined);
    setError(null);
    setAuthStateVersion(prev => prev + 1);
  }, [provider]);

  const refreshAuthState = useCallback(() => {
    setAuthStateVersion(prev => prev + 1);
  }, []);

  // Auto-restore provider with stored credentials on mount
  useEffect(() => {
    const tryRestoreProvider = async () => {
      // Try API provider first
      const apiProvider = new OpenRouterApiProvider();
      if (apiProvider.isAuthenticated) {
        setProvider(apiProvider);
        return;
      }

      // Try OAuth provider
      const oauthProvider = new OpenRouterOAuthProvider();
      if (oauthProvider.isAuthenticated) {
        setProvider(oauthProvider);
        return;
      }
    };

    tryRestoreProvider().catch(console.error);
  }, [setProvider]);

  const generateResponse = useCallback(async (request: InferenceRequest): Promise<InferenceResponse> => {
    if (!provider) {
      throw new Error('No inference provider configured');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await provider.generateResponse(request);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Inference request failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

  const selectModel = useCallback((modelId: string) => {
    if (!provider) {
      throw new Error('No inference provider configured');
    }

    try {
      provider.selectModel(modelId);
      setSelectedModelId(modelId);
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
      // Update selectedModelId to match what the provider selected as default
      setSelectedModelId(provider.selectedModel?.id);
      return models;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load models';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [provider]);

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