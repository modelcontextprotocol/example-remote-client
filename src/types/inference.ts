// Core inference types and interfaces

// Inference message monitoring types
export interface InferenceMessage {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error' | 'stream_chunk';
  providerId: string;
  providerName: string;
  model?: string;
  request?: InferenceRequest;
  response?: InferenceResponse;
  streamChunk?: any;
  error?: any;
  duration?: number; // Response time in ms
}

export type InferenceMessageCallback = (message: InferenceMessage) => void;

export interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputCost?: number;  // per token
  outputCost?: number; // per token
  provider: string;
  capabilities: ModelCapabilities;
}

export interface ModelCapabilities {
  supportsVision: boolean;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolCallId?: string; // for tool response messages
}

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, any>; // Parsed JSON object
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>; // JSON schema
  };
}

export interface InferenceRequest {
  messages: ChatMessage[];
  model?: string;
  systemPrompt?: string;
  tools?: Tool[]; // toolChoice defaults to 'auto' when tools provided
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface InferenceResponse {
  message: ChatMessage;
  usage: TokenUsage;
  stopReason: 'stop' | 'max_tokens' | 'tool_calls' | 'error';
  finishReason?: string;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

export interface AuthConfig {
  type: 'api_key' | 'oauth';
  apiKey?: string;
  oauthConfig?: {
    clientId?: string;
    redirectUri?: string;
    scopes?: string[];
  };
}

export interface ProviderCapabilities {
  authMethods: ('api_key' | 'oauth')[];
  supportsModelListing: boolean;
  requiresAuth: boolean;
}

export interface InferenceError {
  type: 'auth' | 'network' | 'rate_limit' | 'invalid_request' | 'provider_error';
  message: string;
  details?: any;
  retryable: boolean;
}

export abstract class InferenceProvider {
  abstract readonly name: string;
  abstract readonly id: string;
  abstract readonly isAuthenticated: boolean;
  abstract readonly authError?: string;
  abstract readonly models: Model[];
  abstract readonly selectedModel?: Model;

  abstract generateResponse(request: InferenceRequest): Promise<InferenceResponse>;
  abstract loadModels(): Promise<Model[]>;
  abstract selectModel(modelId: string): void;
  abstract authenticate(config: AuthConfig): Promise<void>;
  abstract logout(): void;
  abstract getCapabilities(): ProviderCapabilities;
}