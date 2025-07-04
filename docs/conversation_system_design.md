# Conversation System & Agent Loop Architecture

## Overview

The conversation system implements a complete conversational AI interface with tool calling capabilities, multi-conversation management, and persistence. It integrates with both inference providers (OpenRouter) and MCP (Model Context Protocol) servers to provide a unified tool ecosystem.

## System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    ConversationApp                          │
├─────────────────────┬───────────────────────────────────────┤
│  ConversationSidebar│           ChatInterface               │
│  - Conversation List│  - MessageList                        │
│  - MCP Status       │  - MessageInput                       │
│  - Management       │  - Authentication                     │
└─────────────────────┴───────────────────────────────────────┘
```

### Context Providers

The system uses a layered context provider architecture:

```typescript
<InferenceProvider>          // Authentication & model management
  <MCPProvider>              // MCP server connections
    <ConversationProvider>   // Conversation state & agent loops
      <ConversationApp />
    </ConversationProvider>
  </MCPProvider>
</InferenceProvider>
```

## Data Models

### Conversation Structure

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'idle' | 'thinking' | 'calling_tools' | 'error';
  error?: string;
  pendingToolCalls?: PendingToolCall[];
}
```

### Message Format

Messages use a structured content block system that supports text, tool use, and tool results:

```typescript
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: ConversationContentBlock[];
  timestamp: Date;
}

type ConversationContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; content: string | ContentItem[]; is_error?: boolean }
```

This design aligns with the Anthropic/Claude message format and supports rich tool interactions.

## Agent Loop Implementation

### Hook Architecture

The agent loop is implemented as a custom React hook (`useAgentLoop`) that provides:

```typescript
interface UseAgentLoopReturn {
  executeAgentLoop: (conversation: Conversation, onUpdate: (conversation: Conversation) => void) => Promise<void>;
  stopLoop: (conversationId: string) => void;
  getLoopState: (conversationId: string) => AgentLoopState | undefined;
}
```

### Execution Flow

1. **Conversation Processing**: Takes a full conversation and processes the latest user message
2. **Tool Discovery**: Aggregates tools from test tools and connected MCP servers
3. **Inference Request**: Sends messages + available tools to the inference provider
4. **Tool Execution**: Executes any tool calls returned by the model
5. **Result Integration**: Adds tool results back to the conversation
6. **Iteration**: Continues until no more tool calls or max iterations reached

```typescript
for (let iteration = 0; iteration < maxIterations; iteration++) {
  // 1. Convert conversation to inference format
  const inferenceMessages = toInferenceMessages(conversation.messages);
  
  // 2. Get available tools (test + MCP)
  const allTools = [...testTools, ...mcpTools];
  
  // 3. Generate response with tools
  const response = await currentProvider.generateResponse({
    messages: inferenceMessages,
    tools: allTools
  });
  
  // 4. Add assistant message to conversation
  conversation.messages.push(fromInferenceResponse(response.message));
  
  // 5. Execute tool calls if present
  if (response.message.toolCalls) {
    for (const toolCall of response.message.toolCalls) {
      const result = await executeTool(toolCall);
      conversation.messages.push(createToolResultMessage(result));
    }
  } else {
    break; // No more tool calls, done
  }
}
```

### Tool Integration

#### Test Tools
Built-in tools for development and testing:
- `get_weather`: Mock weather data
- `calculate`: Basic arithmetic evaluation
- `get_current_time`: Current timestamp with timezone support

#### MCP Tools
Tools from connected MCP servers are:
- **Name-prefixed**: `${serverName}__${toolName}` to avoid conflicts and comply with API requirements
- **Dynamically routed**: Tool calls extract server name and route to correct connection
- **Auto-discovered**: Available tools update when servers connect/disconnect

```typescript
// Tool execution routing
if (toolCall.function.name.includes('__')) {
  const [serverName] = toolCall.function.name.split('__');
  const connection = connections.find(conn => conn.name === serverName);
  return await callMCPTool(connection.id, toolCall.function.name, toolCall.function.arguments);
}
```

#### Tool Naming Requirements

**Important**: Tool names must comply with OpenRouter API requirements:
- **Pattern**: Must match `^[a-zA-Z0-9_-]{1,64}$`
- **No dots allowed**: This is why we use double underscore (`__`) as separator
- **Length limit**: Maximum 64 characters total

Example tool names:
- ✅ `test__echo` (valid)
- ✅ `weather_service__get_forecast` (valid) 
- ❌ `test.echo` (invalid - contains dot)
- ❌ `server__very_long_tool_name_that_exceeds_the_sixty_four_character_limit` (invalid - too long)

## State Management

### Conversation Persistence

Conversations are persisted to `localStorage` with automatic serialization/deserialization:

```typescript
// Save on changes
useEffect(() => {
  if (hasLoadedPersisted.current && conversations.length > 0) {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }
}, [conversations]);

// Load on mount
useEffect(() => {
  const persistedData = localStorage.getItem('conversations');
  if (persistedData) {
    const restored = JSON.parse(persistedData).map(conv => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
    setConversations(restored);
  }
}, []);
```

### Authentication State Management

The system uses a reactive authentication pattern to ensure UI consistency:

```typescript
// InferenceContext tracks auth state changes
const [authStateVersion, setAuthStateVersion] = useState(0);

const refreshAuthState = useCallback(() => {
  setAuthStateVersion(prev => prev + 1);
}, []);

// Components use context's reactive isAuthenticated value
const contextValue = {
  isAuthenticated: provider?.isAuthenticated || false,
  refreshAuthState,
  // ...
};
```

**Critical Pattern**: Always use `isAuthenticated` from context, not `provider?.isAuthenticated` directly, to ensure reactive updates.

## User Interface Components

### ConversationSidebar
- **Conversation list** with title, timestamp, status indicators
- **New conversation** creation
- **Conversation management** (delete, switch active)
- **MCP status toggle** for debugging

### ChatInterface
- **Authentication gate**: Shows inline login if not authenticated
- **Message display** with tool call visualization
- **Input handling** with disabled states
- **Real-time status** showing agent loop progress

### MessageList
- **Role-based styling** (user, assistant, tool)
- **Tool call blocks** showing tool name and input parameters
- **Tool result blocks** with success/error states and formatted output
- **Timestamp display** with relative formatting

### MessageInput
- **Auto-resize textarea** with Enter/Shift+Enter handling
- **Send button** with proper disabled states and tooltips
- **Character count** for long messages

## Authentication Flow

### Inline Authentication
Users authenticate directly in the chat interface without leaving the conversation view:

1. **Provider Selection**: Choose between API key and OAuth providers
2. **Authentication**: Enter API key or complete OAuth flow
3. **Model Loading**: Automatically load available models
4. **Context Update**: Refresh authentication state across all components
5. **Chat Enablement**: Message input becomes active

```typescript
// After successful authentication
await selectedProvider.authenticate({ type: 'api_key', apiKey });
await selectedProvider.loadModels();
setProvider(selectedProvider);
refreshAuthState(); // Critical: Force reactive update
```

## Development Guidelines

### Adding New Tools

1. **Test Tools**: Add to `testTools` array in `useAgentLoop.ts`
2. **MCP Tools**: Connect MCP server via MCP Provider Test tab

```typescript
const newTestTool: TestTool = {
  type: 'function',
  function: {
    name: 'my_tool',
    description: 'Description of what the tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  },
  execute: async (args) => {
    // Tool implementation
    return { result: 'tool output' };
  }
};
```

### Adding New Inference Providers

1. **Implement InferenceProvider abstract class**
2. **Add to available providers** in `InferenceLogin` component
3. **Handle authentication methods** (API key, OAuth)

### Message Format Extensions

To add new content block types:

1. **Extend ConversationContentBlock union type**
2. **Add rendering logic** in `MessageList.renderContentBlock()`
3. **Update conversion helpers** in `useAgentLoop`

### Debugging

Use the MCP Status panel (toggle in sidebar) to monitor:
- **Server connections** and their status
- **Available tools** from each server
- **Connection errors** and retry attempts

Debug conversation state in browser DevTools:
- **localStorage['conversations']**: Persisted conversation data
- **React DevTools**: Component state and context values

## Error Handling

### Agent Loop Errors
- **Tool execution failures**: Captured and shown as error tool results
- **Network failures**: Retry with exponential backoff
- **Authentication failures**: Graceful fallback to login screen
- **Max iterations**: Configurable limit to prevent infinite loops

### State Recovery
- **Conversation persistence**: Automatic save/restore across sessions
- **Connection restoration**: MCP servers automatically reconnect on app load
- **Authentication persistence**: Tokens stored securely in localStorage

## Performance Considerations

### Optimization Strategies
- **Message virtualization**: Consider for very long conversations
- **Tool result caching**: Avoid re-executing identical tool calls
- **Connection pooling**: Reuse MCP connections across conversations
- **Lazy loading**: Load conversation history on demand

### Memory Management
- **Conversation limits**: Consider archiving old conversations
- **Message trimming**: Truncate very long conversations for inference
- **Tool result size**: Limit large tool outputs in UI display

## Security Considerations

### Authentication
- **API keys**: Stored in localStorage, never sent to third parties
- **OAuth tokens**: Proper PKCE flow with secure token storage
- **MCP connections**: Support both authenticated and unauthenticated servers

### Tool Safety
- **Input validation**: Sanitize tool inputs before execution
- **Output sanitization**: Escape tool outputs in UI display
- **Execution limits**: Prevent long-running or resource-intensive tools

### Data Privacy
- **Local storage**: All conversation data stays on client
- **No analytics**: No conversation data sent to analytics services
- **MCP isolation**: Each server connection is isolated

## Future Enhancements

### Planned Features
- **Streaming responses**: Real-time message generation
- **File attachments**: Support for images and documents
- **Voice input/output**: Speech-to-text and text-to-speech
- **Advanced tool calling**: Parallel tool execution, tool composition
- **Conversation export**: Export conversations to various formats
- **Collaborative editing**: Shared conversations between users

### Architecture Improvements
- **Message streaming**: WebSocket-based real-time updates
- **Background processing**: Web Workers for tool execution
- **Offline support**: Service Worker for offline conversation access
- **Database migration**: Move from localStorage to IndexedDB
- **Plugin system**: Third-party tool and provider extensions

## Testing Strategy

### Unit Tests
- **Tool execution**: Verify tool calling and result handling
- **Message formatting**: Test content block serialization/deserialization
- **Authentication flows**: Mock provider authentication

### Integration Tests
- **Agent loop**: End-to-end conversation flow with tool calls
- **MCP integration**: Real MCP server connections and tool execution
- **Persistence**: Conversation save/restore functionality

### User Testing
- **Authentication UX**: Smooth login flow without friction
- **Tool usage**: Intuitive tool call visualization and results
- **Multi-conversation**: Easy conversation management and switching

## Troubleshooting Guide

### Common Issues

**"No authenticated inference provider available"**
- Verify `isAuthenticated` from context, not `provider?.isAuthenticated`
- Ensure `refreshAuthState()` called after authentication
- Check if provider is properly set in context

**Tool calls not working**
- Verify MCP server connections in MCP Status panel
- Check tool name prefixing for MCP tools (`server__tool_name`)
- Ensure tool schemas match expected format
- Verify tool names comply with API requirements (alphanumeric, underscore, hyphen only)

**Conversations not persisting**
- Check localStorage quota and permissions
- Verify conversation serialization doesn't fail
- Check browser's localStorage support

**UI not updating after authentication**
- Ensure components use context's `isAuthenticated` value
- Verify `refreshAuthState()` is called after auth changes
- Check React DevTools for proper context updates

**Agent loop hangs with MCP tools connected**
- Check browser console for OpenRouter API errors about tool names
- Verify tool names don't contain dots or other invalid characters
- Ensure tool names are under 64 characters total length
- Look for pattern validation errors: `String should match pattern '^[a-zA-Z0-9_-]{1,64}'`

This system provides a robust foundation for conversational AI with extensible tool calling capabilities, proper state management, and a clean user experience.