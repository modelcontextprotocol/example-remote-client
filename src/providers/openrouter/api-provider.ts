// OpenRouter API Key Provider

import { InferenceProvider } from '@/types/inference';
import type {
  Model,
  InferenceRequest,
  InferenceResponse,
  AuthConfig,
  ProviderCapabilities,
  InferenceError,
} from '@/types/inference';
import { OpenRouterClient } from './client';
import type { OpenRouterApiConfig } from './types';

export class OpenRouterApiProvider extends InferenceProvider {
  readonly name = 'OpenRouter (API Key)';
  readonly id = 'openrouter-api';

  private client: OpenRouterClient;
  private apiKey?: string;
  private _models: Model[] = [];
  private _selectedModel?: Model;
  private _authError?: string;

  constructor(config?: Partial<OpenRouterApiConfig>) {
    super();
    this.client = new OpenRouterClient(config || {});
    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    }
    if (config?.defaultModel) {
      // We'll set this after loading models
    }
    
    // Load stored API key
    this.loadStoredApiKey();
  }

  get isAuthenticated(): boolean {
    return !!this.apiKey && !this._authError;
  }

  get authError(): string | undefined {
    return this._authError;
  }

  get models(): Model[] {
    return this._models;
  }

  get selectedModel(): Model | undefined {
    return this._selectedModel;
  }

  async authenticate(config: AuthConfig): Promise<void> {
    if (config.type !== 'api_key' || !config.apiKey) {
      throw new Error('OpenRouterApiProvider requires API key authentication');
    }

    this.apiKey = config.apiKey;
    this._authError = undefined;

    try {
      // Test the API key by loading models
      await this.loadModels();
      
      // Store API key after successful validation
      this.storeApiKey();
    } catch (error) {
      this._authError = error instanceof Error ? error.message : 'Authentication failed';
      this.apiKey = undefined;
      throw error;
    }
  }

  logout(): void {
    this.apiKey = undefined;
    this._authError = undefined;
    this._models = [];
    this._selectedModel = undefined;
    this.clearStoredApiKey();
  }

  async loadModels(): Promise<Model[]> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    try {
      this._models = await this.client.fetchModels(this.apiKey);
      
      // Check if currently selected model is still in the filtered list
      if (this._selectedModel && !this._models.find(m => m.id === this._selectedModel!.id)) {
        this._selectedModel = undefined;
      }
      
      // Set default model if none selected
      if (!this._selectedModel && this._models.length > 0) {
        // Try to find a good default model
        const defaultModel = this._models.find(m => 
          m.id.includes('gpt-4') || 
          m.id.includes('claude') || 
          m.id.includes('llama')
        ) || this._models[0];
        
        this._selectedModel = defaultModel;
      }

      return this._models;
    } catch (error) {
      if (this.isInferenceError(error) && error.type === 'auth') {
        this._authError = error.message;
        this.apiKey = undefined;
      }
      throw error;
    }
  }

  selectModel(modelId: string): void {
    const model = this._models.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    this._selectedModel = model;
  }

  async generateResponse(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this.apiKey) {
      throw new Error('Not authenticated');
    }

    if (!this._selectedModel) {
      throw new Error('No model selected');
    }

    try {
      return await this.client.generateResponse(
        request,
        this._selectedModel.id,
        this.apiKey
      );
    } catch (error) {
      if (this.isInferenceError(error) && error.type === 'auth') {
        this._authError = error.message;
        this.apiKey = undefined;
      }
      throw error;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      authMethods: ['api_key'],
      supportsModelListing: true,
      requiresAuth: true,
    };
  }

  private isInferenceError(error: any): error is InferenceError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error;
  }

  private storeApiKey(): void {
    if (this.apiKey) {
      localStorage.setItem('openrouter_api_key', this.apiKey);
    }
  }

  private loadStoredApiKey(): void {
    const storedKey = localStorage.getItem('openrouter_api_key');
    if (storedKey) {
      this.apiKey = storedKey;
      // Try to load models to verify the key is still valid
      this.loadModels().catch(() => {
        // If loading fails, clear invalid key
        this.logout();
      });
    }
  }

  private clearStoredApiKey(): void {
    localStorage.removeItem('openrouter_api_key');
  }
}