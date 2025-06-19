// MCP provider types and interfaces

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from './inference';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.d.ts';

export interface MCPServerConfig {
  name: string;                 // User-provided display name
  url: string;                  // Server endpoint URL (or 'local' for in-memory servers)
  authType?: 'none' | 'oauth'; // Default: none
  oauthConfig?: {
    clientId?: string;
    authUrl?: string;           // OAuth authorization endpoint
    tokenUrl?: string;          // Token exchange endpoint
    scope?: string;             // OAuth scope
    redirectUri?: string;       // Override default redirect URI
  };
  maxReconnectAttempts?: number; // Default: 5
  localServer?: () => any;      // Function to create the local server instance (when url === 'local')
}

export interface MCPMessage {
  timestamp: Date;
  direction: 'sent' | 'received';
  type: 'request' | 'response' | 'notification';
  method?: string;
  id?: string | number;
  content: any;
  error?: any;
}

// Message callback types
export type MCPMessageCallback = (
  connectionId: string,
  client: Client,
  message: JSONRPCMessage,
  direction: 'sent' | 'received',
  extra?: { authInfo?: AuthInfo; options?: TransportSendOptions }
) => void;

// MCP message for storage/monitoring
export interface MCPMonitorMessage {
  id: string;
  timestamp: Date;
  connectionId: string;
  serverName: string;
  message: JSONRPCMessage;
  direction: 'sent' | 'received';
  extra?: { authInfo?: AuthInfo; options?: TransportSendOptions };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPConnection {
  id: string;                    // Unique connection identifier
  name: string;                  // User-provided server name
  url: string;                   // Server URL
  status: 'connecting' | 'connected' | 'failed' | 'disconnected';
  client?: Client;               // MCP SDK client instance
  transport?: 'sse' | 'streamable-http' | 'inmemory';
  authType?: 'none' | 'oauth';
  
  // Available capabilities
  tools: Tool[];                 // Tools with name-prefixed identifiers
  resources: MCPResource[];      // Available resources
  prompts: MCPPrompt[];         // Available prompts
  
  // Connection metadata
  error?: string;               // Last error message
  lastConnected?: Date;         // Last successful connection
  connectionAttempts: number;   // Number of reconnection attempts
  
  // Configuration
  config: MCPServerConfig;
}

export interface MCPConnectionManager {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): void;
  reconnect(): Promise<void>;
  
  // Capability discovery
  discoverTools(): Promise<Tool[]>;
  discoverResources(): Promise<MCPResource[]>;
  discoverPrompts(): Promise<MCPPrompt[]>;
  
  // Tool execution
  callTool(toolName: string, args: any): Promise<any>;
  
  // Status
  getStatus(): MCPConnection['status'];
  getConnection(): MCPConnection;
  
  // Connection state updates
  setConnectionUpdateCallback(callback: () => void): void;
}

export interface MCPError {
  type: 'connection' | 'auth' | 'tool_execution' | 'protocol' | 'transport';
  message: string;
  details?: any;
  connectionId?: string;
  retryable: boolean;
}

export interface MCPContextValue {
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
  getAllResources: () => MCPResource[];
  getResourcesForServer: (connectionId: string) => MCPResource[];
  
  // Status and debugging
  getConnectedServers: () => MCPConnection[];
  getServerStatus: (connectionId: string) => MCPConnection['status'];
  getConnectionById: (connectionId: string) => MCPConnection | undefined;
  
  // Connection configuration
  updateServerConfig: (connectionId: string, config: Partial<MCPServerConfig>) => void;
  
  // OAuth handling
  handleOAuthCallback: (connectionId: string, authorizationCode: string) => Promise<void>;
  
  // Message monitoring
  messages: MCPMonitorMessage[];
  addMessageCallback: (callback: MCPMessageCallback) => string; // Returns callback ID
  removeMessageCallback: (callbackId: string) => void;
  clearMessages: () => void;
}