# InferenceProvider Interface Design

This document outlines the design for the InferenceProvider interface and its implementations, which abstracts LLM inference capabilities for the MCP client.

## Goals

1. **Provider Agnostic**: Support multiple inference providers (OpenRouter, Anthropic, OpenAI, Google, etc.)
2. **Tool Calling**: Native support for function/tool calling with MCP tools
3. **Authentication**: Flexible auth patterns (API keys, OAuth, etc.)
4. **Model Selection**: Dynamic model listing and selection
5. **Error Handling**: Consistent error handling across providers

## Core Interface

```typescript
interface InferenceProvider {
  // Provider identification
  readonly name: string;
  readonly id: string;

  // Authentication state
  readonly isAuthenticated: boolean;
  readonly authError?: string;

  // Available models
  readonly models: Model[];
  readonly selectedModel?: Model;

  // Core inference method
  generateResponse(request: InferenceRequest): Promise<InferenceResponse>;

  // Model management
  loadModels(): Promise<Model[]>;
  selectModel(modelId: string): void;

  // Authentication
  authenticate(config: AuthConfig): Promise<void>;
  logout(): void;

  // Provider-specific capabilities
  getCapabilities(): ProviderCapabilities;
}
```

## Supporting Types

### Model
```typescript
interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  inputCost?: number;  // per token
  outputCost?: number; // per token
  provider: string;
  capabilities: ModelCapabilities;
}

interface ModelCapabilities {
  supportsTools: boolean;
  supportsVision: boolean;
  maxTokens: number;
}
```

### Inference Request/Response
```typescript
interface InferenceRequest {
  messages: ChatMessage[];
  tools?: Tool[]; // toolChoice defaults to 'auto' when tools provided
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

interface InferenceResponse {
  message: ChatMessage;
  usage: TokenUsage;
  stopReason: 'stop' | 'max_tokens' | 'tool_calls' | 'error';
  error?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  toolCallId?: string; // for tool response messages
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}
```

### Authentication
```typescript
interface AuthConfig {
  type: 'api_key' | 'oauth';
  apiKey?: string;
  oauthConfig?: {
    clientId?: string;
    redirectUri?: string;
    scopes?: string[];
  };
}

interface ProviderCapabilities {
  authMethods: ('api_key' | 'oauth')[];
  supportsModelListing: boolean;
  supportsToolCalling: boolean;
  requiresAuth: boolean;
}
```

## Provider Implementations

### OpenRouter Providers

For simplicity, we implement two separate providers using composition:

**OpenRouterApiProvider:**
- API key authentication only
- Simpler auth flow and error handling
- Direct API access

**OpenRouterOAuthProvider:**
- OAuth PKCE authentication only
- Browser-based auth popup flow
- Token refresh handling

**Shared Configuration:**
```typescript
interface OpenRouterBaseConfig {
  baseUrl?: string; // defaults to https://openrouter.ai/api/v1
  defaultModel?: string;
  httpReferrer?: string;
  appName?: string;
}

interface OpenRouterApiConfig extends OpenRouterBaseConfig {
  apiKey: string;
}

interface OpenRouterOAuthConfig extends OpenRouterBaseConfig {
  clientId?: string; // for custom OAuth apps
  redirectUri?: string;
}
```

**Shared Logic:**
Both providers use composition with shared utilities:
- `OpenRouterClient` - HTTP client and request formatting
- `OpenRouterModelParser` - Model list parsing and capabilities
- `OpenRouterToolFormatter` - Tool call formatting

### Future Providers

**AnthropicProvider:**
- OAuth integration with Anthropic Console
- Claude model family support
- Message batching optimization

**OpenAIProvider:**
- OpenAI API key or OAuth
- GPT model family support
- Function calling optimization

**GoogleProvider:**
- Google Cloud OAuth
- Gemini model family support
- Tool calling with Google AI format

## React Integration

### Provider Context
```typescript
interface InferenceContextValue {
  provider: InferenceProvider | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setProvider: (provider: InferenceProvider) => void;
  clearProvider: () => void;
  generateResponse: (request: InferenceRequest) => Promise<InferenceResponse>;
  selectModel: (modelId: string) => void;
  loadModels: () => Promise<Model[]>;

  // Convenience getters
  models: Model[];
  selectedModel: Model | undefined;
  isAuthenticated: boolean;
}

const InferenceContext = createContext<InferenceContextValue | null>(null);
```

### Hook Usage
```typescript
const useInference = () => {
  const context = useContext(InferenceContext);
  if (!context) {
    throw new Error('useInference must be used within InferenceProvider');
  }
  return context;
};
```

## Error Handling

### Error Types
```typescript
interface InferenceError {
  type: 'auth' | 'network' | 'rate_limit' | 'invalid_request' | 'provider_error';
  message: string;
  details?: any;
  retryable: boolean;
}
```

### Error Scenarios
- **Authentication failures**: Invalid API key, expired tokens
- **Rate limiting**: Provider-specific rate limits
- **Network errors**: Connection issues, timeouts
- **Validation errors**: Invalid tool schemas, malformed requests
- **Provider errors**: Service unavailable, model not found

## Implementation Strategy

### Phase 1: Basic OpenRouter Support ✅
1. Implement core InferenceProvider interface
2. Create OpenRouterApiProvider with API key auth
3. Basic model listing and selection (filtered to tool-capable models only)
4. Simple tool calling support (toolChoice=auto)
5. React context with proper state management for UI reactivity

### Phase 2: OAuth and Enhanced Features ✅
1. Create OpenRouterOAuthProvider with PKCE auth
2. Implement error recovery and retries
3. Add usage tracking and cost estimation
4. Improve tool call validation

### Current Status
- ✅ Two OpenRouter providers (API key & OAuth) implemented
- ✅ Provider-level model filtering (only tool-capable models)
- ✅ React context with proper UI state synchronization
- ✅ Interactive test UI with tool calling demonstration
- ✅ OAuth callback routing for future MCP server integration

### Phase 3: Multi-Provider Support
1. Add AnthropicProvider
2. Add OpenAIProvider
3. Provider switching UI
4. Unified configuration management

## Testing Strategy

### Unit Tests
- Mock provider implementations for testing
- Tool call serialization/deserialization
- Error handling scenarios
- Authentication flows

### Integration Tests
- Real provider API integration (with test keys)
- End-to-end tool calling workflows
- Provider switching scenarios
- Authentication persistence

## Security Considerations

1. **API Key Storage**: Secure storage in browser (encrypted localStorage)
2. **OAuth Flow**: Secure popup-based OAuth with PKCE
3. **Token Refresh**: Automatic token refresh handling
4. **Rate Limiting**: Client-side rate limiting to prevent abuse
5. **Input Validation**: Strict validation of tool calls and responses

## Key Design Decisions

### 1. Provider-Level Model Filtering
All providers filter models to only return those that support tool calling. This simplifies consumers and prevents tool-calling errors:

```typescript
// In OpenRouterClient.fetchModels()
return response.data
  .filter(model => model.supported_parameters?.includes('tools'))
  .map(this.parseModel);
```

**Benefits:**
- No tool capability checking needed in UI components
- Eliminates "model doesn't support tools" errors
- Cleaner separation of concerns

### 2. React State Management for UI Reactivity
The React context tracks model selection in React state to ensure UI updates when models are selected:

```typescript
const [selectedModelId, setSelectedModelId] = useState<string | undefined>();

// In selectModel callback
provider.selectModel(modelId);        // Update provider internal state
setSelectedModelId(modelId);          // Update React state → triggers re-render

// In context value - compute selectedModel from React-tracked ID
selectedModel: selectedModelId ? provider?.models.find(m => m.id === selectedModelId) : undefined
```

**Why this pattern:**
- Provider internal state changes don't trigger React re-renders automatically
- React needs to track state changes to update the UI
- Keeps provider logic decoupled from React specifics

### 3. Composition Over Inheritance
Two separate OpenRouter providers (API & OAuth) use shared utilities rather than complex inheritance:
- `OpenRouterClient` - HTTP client and request formatting  
- Shared model parsing and tool formatting logic
- Clean separation of authentication concerns

**Benefits:**
- Simpler code paths (no branching auth logic)
- Easier testing and maintenance
- Clear separation of API vs OAuth concerns

## Future Enhancements

1. **Caching**: Response caching for repeated requests
2. **Load Balancing**: Multi-provider load balancing
3. **Analytics**: Usage analytics and monitoring
4. **Custom Models**: Support for custom/fine-tuned models
5. **Advanced Tool Choice**: Support for specific tool selection (beyond auto)
6. **Streaming Support**: Real-time response streaming (if needed later)