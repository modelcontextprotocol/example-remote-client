// React context for inference provider management

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type {
  InferenceProvider,
  InferenceRequest,
  InferenceResponse,
  Model,
} from '@/types/inference';

interface InferenceContextValue {
  // Current provider state
  provider: InferenceProvider | null;
  isLoading: boolean;
  error: string | null;

  // Provider actions
  setProvider: (provider: InferenceProvider) => void;
  clearProvider: () => void;

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

export function InferenceProvider({ children }: InferenceProviderProps) {
  const [provider, setProviderState] = useState<InferenceProvider | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(undefined);

  const setProvider = useCallback((newProvider: InferenceProvider) => {
    setProviderState(newProvider);
    setSelectedModelId(undefined);
    setError(null);
  }, []);

  const clearProvider = useCallback(() => {
    if (provider) {
      provider.logout();
    }
    setProviderState(null);
    setSelectedModelId(undefined);
    setError(null);
  }, [provider]);

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