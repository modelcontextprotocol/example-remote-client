# MCP Provider Interface Design

> **⚠️ DRAFT/TENTATIVE DESIGN**  
> This document outlines a proposed design for the MCP provider system. The design is subject to iteration and refinement during implementation.

## Overview

The MCP Provider system manages connections to multiple MCP servers, providing a unified interface for tool calling, resource access, and connection management. It follows similar architectural patterns to the InferenceProvider system.

## Goals

1. **Multi-Server Support**: Connect to multiple MCP servers simultaneously
2. **Transport Abstraction**: Support SSE and Streamable HTTP transports with automatic fallback
3. **Tool Aggregation**: Combine tools from all servers with conflict resolution
4. **Connection Management**: Handle connection lifecycle, reconnection, and error recovery
5. **OAuth Integration**: Support MCP server OAuth flows with proper callback routing
6. **Debug Visibility**: Comprehensive debugging interface for development and troubleshooting

## Core Interfaces

### MCPConnection
```typescript
interface MCPConnection {
  id: string;                    // Unique connection identifier
  name: string;                  // User-provided server name
  url: string;                   // Server URL
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
  client?: Client;               // MCP SDK client instance
  transport: 'sse' | 'streamable-http';
  authType: 'none' | 'oauth';
  
  // Available capabilities
  tools: Tool[];                 // Tools with name-prefixed identifiers
  resources?: Resource[];        // Available resources
  prompts?: Prompt[];           // Available prompts
  
  // Connection metadata
  error?: string;               // Last error message
  lastConnected?: Date;         // Last successful connection
  capabilities?: ServerCapabilities; // Server-advertised capabilities
  
  // Debug information
  messageTrace?: MCPMessage[];  // Recent message exchange history
  connectionAttempts: number;   // Number of reconnection attempts
}
```

### MCPServerConfig
```typescript
interface MCPServerConfig {
  name: string;                 // User-provided display name
  url: string;                  // Server endpoint URL
  transport?: 'sse' | 'streamable-http' | 'auto'; // Default: auto-detect
  authType?: 'none' | 'oauth'; // Default: none
  oauthConfig?: {
    // OAuth configuration if needed
    clientId?: string;
  };
  autoReconnect?: boolean;      // Default: true
  maxReconnectAttempts?: number; // Default: 5
}
```

### MCPContextValue
```typescript
interface MCPContextValue {
  // Connection state
  connections: MCPConnection[];
  isLoading: boolean;
  error: string | null;
  
  // Connection management
  addMcpServer: (config: MCPServerConfig) => Promise<string>; // Returns connection ID
  removeMcpServer: (connectionId: string) => void;
  reconnectServer: (connectionId: string) => Promise<void>;
  
  // Tool access (explicit server routing)
  getAllTools: () => Tool[];                    // All tools with prefixed names
  getToolsForServer: (connectionId: string) => Tool[];
  callTool: (connectionId: string, toolName: string, args: any) => Promise<any>;
  
  // Resource access
  getAllResources: () => Resource[];
  getResourcesForServer: (connectionId: string) => Resource[];
  
  // Status and debugging
  getConnectedServers: () => MCPConnection[];
  getServerStatus: (connectionId: string) => MCPConnection['status'];
  getConnectionById: (connectionId: string) => MCPConnection | undefined;
  getMessageTrace: (connectionId: string) => MCPMessage[];
}
```

## Tool Name Resolution

### Prefixing Strategy
Tools from each server are prefixed with the user-provided server name to avoid conflicts:

```typescript
// Original tool from weather server: "get_weather"
// Prefixed tool: "weather_server.get_weather"

// Original tool from calendar server: "get_events" 
// Prefixed tool: "calendar.get_events"
```

### Tool Discovery and Registration
```typescript
class MCPConnection {
  private async discoverTools(): Promise<Tool[]> {
    const tools = await this.client.listTools();
    return tools.map(tool => ({
      ...tool,
      function: {
        ...tool.function,
        name: `${this.name}.${tool.function.name}`, // Add prefix
        description: `[${this.name}] ${tool.function.description}`, // Add server context
      }
    }));
  }
}
```

## Connection Management

### Connection Lifecycle
```typescript
class MCPConnection {
  async connect(): Promise<void> {
    this.status = 'connecting';
    
    try {
      // 1. Try StreamableHTTP first
      if (this.transport === 'auto' || this.transport === 'streamable-http') {
        await this.tryStreamableHttp();
      }
      
      // 2. Fallback to SSE if needed
      if (this.status !== 'connected' && (this.transport === 'auto' || this.transport === 'sse')) {
        await this.trySSE();
      }
      
      // 3. Initialize capabilities
      await this.initializeCapabilities();
      
      this.status = 'connected';
      this.lastConnected = new Date();
      this.connectionAttempts = 0;
      
    } catch (error) {
      this.status = 'failed';
      this.error = error.message;
      this.connectionAttempts++;
      
      if (this.autoReconnect && this.connectionAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.connect(), this.getBackoffDelay());
      }
    }
  }
}
```

### Auto-Reconnection Strategy
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Maximum 5 attempts by default
- Reset attempt counter on successful connection
- User can manually retry after max attempts reached

## React Integration

### MCPProvider Context
```typescript
export function MCPProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [connectionStates, setConnectionStates] = useState<Record<string, any>>({});
  
  // Load persisted connections from localStorage on mount
  useEffect(() => {
    loadPersistedConnections();
  }, []);
  
  // Auto-save connections to localStorage
  useEffect(() => {
    persistConnections(connections);
  }, [connections]);
  
  // ... implementation
}
```

### Hook Usage
```typescript
const {
  connections,
  addMcpServer,
  callTool,
  getAllTools
} = useMCP();

// Add a server
const connectionId = await addMcpServer({
  name: 'Weather Service',
  url: 'https://weather.mcp.example.com',
  transport: 'auto'
});

// Call a tool
const result = await callTool(connectionId, 'get_weather', { 
  location: 'San Francisco' 
});
```

## Authentication & OAuth

### OAuth Flow for MCP Servers
Following the established callback routing pattern:
- OAuth callbacks: `/oauth/mcp/{connectionId}/callback`
- Server-specific state management
- Automatic token refresh handling

```typescript
interface MCPOAuthProvider {
  authenticate(connectionId: string): Promise<void>;
  refreshToken(connectionId: string): Promise<void>;
  getAuthStatus(connectionId: string): 'authenticated' | 'pending' | 'failed';
}
```

## Error Handling & Debugging

### Message Tracing
```typescript
interface MCPMessage {
  timestamp: Date;
  direction: 'sent' | 'received';
  type: 'request' | 'response' | 'notification';
  method?: string;
  id?: string | number;
  content: any;
  error?: any;
}
```

### Connection Debugging
- Real-time connection status monitoring
- Message trace viewer with filtering
- Transport fallback information
- OAuth flow status tracking
- Tool discovery and registration logs

## Implementation Strategy

### Phase 1: Core Connection Management ⏳
1. Basic MCPConnection class with transport support
2. MCPProvider React context with connection lifecycle
3. Tool discovery and name prefixing
4. Basic error handling and reconnection

### Phase 2: Debug Interface ⏳
1. Connection status dashboard
2. Tool listing and testing interface
3. Message trace viewer
4. Manual connection controls

### Phase 3: OAuth & Advanced Features
1. OAuth integration for authenticated servers
2. Resource and prompt support
3. Enhanced debugging and monitoring
4. Performance optimizations

### Phase 4: Integration
1. Integration with agent loop and inference provider
2. Unified tool calling across test tools and MCP tools
3. Advanced error recovery and resilience

## Security Considerations

1. **URL Validation**: Validate MCP server URLs to prevent malicious redirects
2. **OAuth Security**: Proper PKCE implementation for OAuth flows
3. **Message Validation**: Validate all MCP messages against protocol schema
4. **Storage Security**: Secure storage of OAuth tokens and sensitive config
5. **CORS Handling**: Proper CORS error detection and user guidance

## Testing Strategy

### Unit Tests
- MCPConnection class functionality
- Tool name prefixing and conflict resolution
- Connection lifecycle and error handling
- OAuth flow simulation

### Integration Tests
- Real MCP server connections (with test servers)
- Transport fallback scenarios
- Multi-server tool calling
- OAuth authentication flows

## Future Enhancements

1. **Advanced Tool Routing**: Smart tool routing based on capability matching
2. **Connection Pooling**: Efficient connection reuse and management
3. **Caching**: Tool schema and response caching
4. **Monitoring**: Connection health monitoring and alerts
5. **Batch Operations**: Bulk tool calling and resource access
6. **Custom Transports**: Support for WebSocket and custom transport protocols