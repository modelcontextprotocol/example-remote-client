// OpenRouter-specific types and configurations

export interface OpenRouterBaseConfig {
  baseUrl?: string; // defaults to https://openrouter.ai/api/v1
  defaultModel?: string;
  httpReferrer?: string;
  appName?: string;
}

export interface OpenRouterApiConfig extends OpenRouterBaseConfig {
  apiKey: string;
}

export interface OpenRouterOAuthConfig extends OpenRouterBaseConfig {
  clientId?: string; // for custom OAuth apps
  redirectUri?: string;
}

// OpenRouter API response types
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider: {
    max_completion_tokens?: number;
  };
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  supported_parameters?: string[];
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterMessage[];
  tools?: OpenRouterTool[];
  tool_choice?: string;
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  stream?: boolean;
}

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | OpenRouterContentBlock[];
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
}

export interface OpenRouterContentBlock {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string from API
  };
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}

export interface OpenRouterChatResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface OpenRouterErrorResponse {
  error: {
    type: string;
    message: string;
    code?: string;
  };
}