// OpenRouter OAuth Provider

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
import type { OpenRouterOAuthConfig } from './types';

interface OAuthState {
  codeVerifier: string;
  state: string;
  expiresAt: number;
}

export class OpenRouterOAuthProvider extends InferenceProvider {
  readonly name = 'OpenRouter (OAuth)';
  readonly id = 'openrouter-oauth';

  private client: OpenRouterClient;
  private accessToken?: string;
  private refreshToken?: string;
  private _models: Model[] = [];
  private _selectedModel?: Model;
  private _authError?: string;
  private oauthConfig: OpenRouterOAuthConfig;

  constructor(config?: OpenRouterOAuthConfig) {
    super();
    this.oauthConfig = {
      redirectUri: `${window.location.origin}${window.location.pathname}`,
      ...config,
    };
    this.client = new OpenRouterClient(config || {});
    this.loadStoredTokens();
  }

  get isAuthenticated(): boolean {
    return !!this.accessToken && !this._authError;
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
    if (config.type !== 'oauth') {
      throw new Error('OpenRouterOAuthProvider requires OAuth authentication');
    }

    try {
      await this.startOAuthFlow();
    } catch (error) {
      this._authError = error instanceof Error ? error.message : 'OAuth authentication failed';
      throw error;
    }
  }

  logout(): void {
    this.accessToken = undefined;
    this.refreshToken = undefined;
    this._authError = undefined;
    this._models = [];
    this._selectedModel = undefined;
    this.clearStoredTokens();
  }

  async loadModels(): Promise<Model[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      this._models = await this.client.fetchModels(this.accessToken);
      
      // Check if currently selected model is still in the filtered list
      if (this._selectedModel && !this._models.find(m => m.id === this._selectedModel!.id)) {
        this._selectedModel = undefined;
      }
      
      // Set default model if none selected
      if (!this._selectedModel && this._models.length > 0) {
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
        // Try to refresh token
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            return await this.loadModels(); // Retry with new token
          } catch (refreshError) {
            this._authError = 'Token refresh failed';
            this.logout();
          }
        } else {
          this._authError = error.message;
          this.accessToken = undefined;
        }
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
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    if (!this._selectedModel) {
      throw new Error('No model selected');
    }

    try {
      return await this.client.generateResponse(
        request,
        this._selectedModel.id,
        this.accessToken
      );
    } catch (error) {
      if (this.isInferenceError(error) && error.type === 'auth') {
        // Try to refresh token
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            return await this.generateResponse(request); // Retry with new token
          } catch (refreshError) {
            this._authError = 'Token refresh failed';
            this.logout();
          }
        } else {
          this._authError = error.message;
          this.accessToken = undefined;
        }
      }
      throw error;
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      authMethods: ['oauth'],
      supportsModelListing: true,
      requiresAuth: true,
    };
  }

  private async startOAuthFlow(): Promise<void> {
    // Generate PKCE parameters
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    // Store OAuth state
    const oauthState: OAuthState = {
      codeVerifier,
      state,
      expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
    };
    localStorage.setItem('openrouter_oauth_state', JSON.stringify(oauthState));

    // Build authorization URL
    const authUrl = new URL('https://openrouter.ai/auth');
    authUrl.searchParams.append('callback_url', this.oauthConfig.redirectUri || '');
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', state);

    // Open popup for OAuth flow
    const popup = window.open(
      authUrl.toString(),
      'openrouter_oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
    }

    // Wait for OAuth callback
    return new Promise((resolve, reject) => {
      let isResolved = false;
      
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'oauth_callback') {
          if (isResolved) return; // Prevent double resolution
          isResolved = true;
          
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          popup.close();

          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            this.handleOAuthCallback(event.data.code, event.data.state)
              .then(resolve)
              .catch(reject);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed && !isResolved) {
          isResolved = true;
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('OAuth flow was cancelled'));
        }
      }, 1000);
    });
  }

  private async handleOAuthCallback(code: string, state: string): Promise<void> {
    // Verify state
    const storedStateJson = localStorage.getItem('openrouter_oauth_state');
    if (!storedStateJson) {
      throw new Error('Invalid OAuth state');
    }

    const storedState: OAuthState = JSON.parse(storedStateJson);
    // Extract the actual state without the prefix for comparison
    const stateWithoutPrefix = state.replace(/^inference:/, '');
    const storedStateWithoutPrefix = storedState.state.replace(/^inference:/, '');
    
    if (storedStateWithoutPrefix !== stateWithoutPrefix || Date.now() > storedState.expiresAt) {
      localStorage.removeItem('openrouter_oauth_state');
      throw new Error('Invalid or expired OAuth state');
    }

    // Exchange code for tokens
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          code_verifier: storedState.codeVerifier,
          code_challenge_method: 'S256',
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.key; // OpenRouter returns 'key' field
      
      // Store tokens
      this.storeTokens();
      localStorage.removeItem('openrouter_oauth_state');

      // Load models to verify authentication
      await this.loadModels();
    } catch (error) {
      localStorage.removeItem('openrouter_oauth_state');
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    // OpenRouter's OAuth implementation doesn't currently support refresh tokens
    // If this changes in the future, implement refresh logic here
    throw new Error('Token refresh not supported by OpenRouter');
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const randomPart = btoa(String.fromCharCode.apply(null, Array.from(array)));
    // Include callback type in state for routing
    return `inference:${randomPart}`;
  }

  private storeTokens(): void {
    if (this.accessToken) {
      localStorage.setItem('openrouter_access_token', this.accessToken);
    }
    if (this.refreshToken) {
      localStorage.setItem('openrouter_refresh_token', this.refreshToken);
    }
  }

  private loadStoredTokens(): void {
    this.accessToken = localStorage.getItem('openrouter_access_token') || undefined;
    this.refreshToken = localStorage.getItem('openrouter_refresh_token') || undefined;
    
    // If we have tokens, try to load models to verify they're still valid
    if (this.accessToken) {
      this.loadModels().catch(() => {
        // If loading fails, clear invalid tokens
        this.logout();
      });
    }
  }

  private clearStoredTokens(): void {
    localStorage.removeItem('openrouter_access_token');
    localStorage.removeItem('openrouter_refresh_token');
    localStorage.removeItem('openrouter_oauth_state');
  }

  private isInferenceError(error: any): error is InferenceError {
    return error && typeof error === 'object' && 'type' in error && 'message' in error;
  }
}