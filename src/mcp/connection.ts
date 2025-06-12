// Individual MCP server connection management

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { 
  auth,
  type OAuthClientProvider
} from '@modelcontextprotocol/sdk/client/auth.js';

import type {
  MCPConnection,
  MCPServerConfig,
  MCPResource,
  MCPPrompt,
  MCPError,
} from '@/types/mcp';
import type { Tool } from '@/types/inference';

interface MCPOAuthState {
  codeVerifier: string;
  state: string;
  expiresAt: number;
}

// OAuth types matching the MCP SDK's internal interfaces
interface OAuthClientMetadata {
  redirect_uris: string[];
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  token_endpoint_auth_method?: string;
  scope?: string;
  jwks_uri?: string;
}

interface OAuthClientInformation {
  client_id: string;
  client_secret?: string;
  registration_access_token?: string;
  registration_client_uri?: string;
  client_secret_expires_at?: number;
}

interface OAuthTokens {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

class MCPOAuthProvider implements OAuthClientProvider {
  private connectionId: string;
  private serverName: string;
  private serverUrl: string;
  pendingAuthorizationCode?: string;
  authError?: string;
  private onOAuthComplete?: () => void;
  
  constructor(connectionId: string, serverName: string, serverUrl: string, onOAuthComplete?: () => void) {
    this.connectionId = connectionId;
    this.serverName = serverName;
    this.serverUrl = serverUrl;
    this.onOAuthComplete = onOAuthComplete;
  }
  
  get redirectUrl(): string {
    return `${window.location.origin}/oauth/mcp/callback`;
  }
  
  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      client_name: `MCP Client - ${this.serverName}`,
      token_endpoint_auth_method: 'none', // Public client
    };
  }
  
  state(): string {
    // Encode connection ID in the state parameter for callback identification
    const randomPart = this.generateRandomString(8);
    return `${this.connectionId}.${randomPart}`;
  }
  
  // Generate a consistent key for the server based on URL
  getServerKey(): string {
    try {
      const url = new URL(this.serverUrl);
      // Use hostname + pathname to create a unique but consistent key
      // This allows the same server to reuse client registration even if added multiple times
      return btoa(`${url.hostname}${url.pathname}`).replace(/[+/=]/g, '');
    } catch {
      // Fallback to connection ID if URL parsing fails
      return this.connectionId;
    }
  }

  clientInformation(): OAuthClientInformation | undefined {
    const serverKey = this.getServerKey();
    const stored = localStorage.getItem(`mcp_oauth_client_${serverKey}`);
    return stored ? JSON.parse(stored) : undefined;
  }
  
  async saveClientInformation(clientInformation: OAuthClientInformation): Promise<void> {
    console.log('Registered OAuth client for MCP server');
    const serverKey = this.getServerKey();
    localStorage.setItem(`mcp_oauth_client_${serverKey}`, JSON.stringify(clientInformation));
  }
  
  tokens(): OAuthTokens | undefined {
    const stored = localStorage.getItem(`mcp_oauth_tokens_${this.connectionId}`);
    return stored ? JSON.parse(stored) : undefined;
  }
  
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    console.log('OAuth tokens saved successfully');
    localStorage.setItem(`mcp_oauth_tokens_${this.connectionId}`, JSON.stringify(tokens));
  }
  
  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    console.log('🔐 Starting OAuth flow in popup window...');
    
    // Open popup for OAuth flow
    const popup = window.open(
      authorizationUrl.toString(),
      'mcp_oauth_popup',
      'width=600,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      throw new Error('Failed to open OAuth popup. Please allow popups for this site.');
    }

    // Set up message listener for the authorization code
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type !== 'mcp_oauth_callback') return;
      
      // Extract connection ID from state parameter
      const state = event.data.state;
      if (!state || !state.startsWith(this.connectionId + '.')) return;

      window.removeEventListener('message', handleMessage);
      popup.close();

      if (event.data.error) {
        console.error('❌ OAuth authorization failed:', event.data.error);
        this.authError = event.data.error;
      } else if (event.data.code) {
        console.log('✅ OAuth authorization successful, exchanging code for tokens...');
        this.processAuthorizationCode(event.data.code);
      } else {
        console.error('❌ OAuth callback missing authorization code');
        this.authError = 'No authorization code received';
      }
    };

    window.addEventListener('message', handleMessage);
  }
  
  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const oauthState: MCPOAuthState = {
      codeVerifier,
      state: this.generateRandomString(16),
      expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
    };
    localStorage.setItem(`mcp_oauth_state_${this.connectionId}`, JSON.stringify(oauthState));
  }
  
  async codeVerifier(): Promise<string> {
    const stored = localStorage.getItem(`mcp_oauth_state_${this.connectionId}`);
    if (!stored) {
      throw new Error('No OAuth state found');
    }
    
    const oauthState: MCPOAuthState = JSON.parse(stored);
    if (Date.now() > oauthState.expiresAt) {
      localStorage.removeItem(`mcp_oauth_state_${this.connectionId}`);
      throw new Error('OAuth state expired');
    }
    
    return oauthState.codeVerifier;
  }
  
  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Method to process authorization code immediately when received from popup
  private async processAuthorizationCode(authorizationCode: string): Promise<void> {
    try {
      // Call the SDK's auth function with the authorization code to exchange for tokens
      const result = await auth(this, {
        serverUrl: this.serverUrl,
        authorizationCode,
      });
      
      if (result === 'AUTHORIZED') {
        console.log('🎉 OAuth authentication completed! Connecting to MCP server...');
        this.notifyOAuthComplete();
      } else {
        console.error('❌ OAuth token exchange failed');
        this.authError = 'Authorization failed';
      }
    } catch (error) {
      console.error('❌ OAuth token exchange error:', error instanceof Error ? error.message : error);
      this.authError = error instanceof Error ? error.message : 'Authorization failed';
    }
  }

  // Method to notify connection manager that OAuth is complete
  private notifyOAuthComplete(): void {
    if (this.onOAuthComplete) {
      this.onOAuthComplete();
    }
  }

  // Method to get and clear the pending authorization code
  getPendingAuthorizationCode(): string | undefined {
    const code = this.pendingAuthorizationCode;
    this.pendingAuthorizationCode = undefined;
    return code;
  }
}

export class MCPConnectionManager {
  private connection: MCPConnection;
  private client?: Client;
  private transport?: Transport;
  private reconnectTimeout?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private oauthProvider?: MCPOAuthProvider;
  private onConnectionUpdate?: () => void;

  constructor(id: string, config: MCPServerConfig) {
    this.connection = {
      id,
      name: config.name,
      url: config.url,
      status: 'disconnected',
      transport: 'streamable-http', // Will be determined during connection
      authType: config.authType || 'none',
      tools: [],
      resources: [],
      prompts: [],
      connectionAttempts: 0,
      config,
    };
    
    // Initialize OAuth provider if auth is required
    if (this.connection.authType === 'oauth') {
      this.oauthProvider = new MCPOAuthProvider(id, config.name, config.url, () => {
        // Callback when OAuth completes successfully
        this.handleOAuthSuccess();
      });
    }
  }

  getConnection(): MCPConnection {
    return { ...this.connection };
  }

  // Set callback for connection state updates
  setConnectionUpdateCallback(callback: () => void): void {
    this.onConnectionUpdate = callback;
  }

  // Notify about connection state changes
  private notifyConnectionUpdate(): void {
    if (this.onConnectionUpdate) {
      this.onConnectionUpdate();
    }
  }

  async connect(): Promise<void> {
    this.connection.status = 'connecting';
    this.connection.error = undefined;
    
    try {
      // Validate URL format
      console.log('Validating URL:', this.connection.url);
      try {
        const url = new URL(this.connection.url);
        console.log('URL parsed successfully:', {
          protocol: url.protocol,
          hostname: url.hostname,
          pathname: url.pathname,
          port: url.port
        });
      } catch (urlError) {
        throw new Error(`Invalid URL format: ${this.connection.url}`);
      }
      
      // Clear any existing connections
      await this.disconnect();
      
      // Determine transport strategy
      const transportPreference = this.connection.config.transport || 'auto';
      
      if (transportPreference === 'auto' || transportPreference === 'streamable-http') {
        try {
          await this.tryStreamableHttp();
          this.connection.transport = 'streamable-http';
        } catch (error) {
          if (transportPreference === 'streamable-http') {
            throw error; // Don't fallback if explicitly requested
          }
          // Try SSE fallback
          await this.trySSE();
          this.connection.transport = 'sse';
        }
      } else if (transportPreference === 'sse') {
        await this.trySSE();
        this.connection.transport = 'sse';
      }

      // Initialize client capabilities
      await this.initializeCapabilities();
      
      this.connection.status = 'connected';
      this.connection.lastConnected = new Date();
      this.connection.connectionAttempts = 0;
      
      // Start health check monitoring
      this.startHealthCheck();
      
    } catch (error) {
      this.connection.status = 'failed';
      this.connection.error = error instanceof Error ? error.message : 'Unknown connection error';
      this.connection.connectionAttempts++;
      
      // Schedule auto-reconnect if enabled
      if (this.connection.config.autoReconnect !== false && 
          this.connection.connectionAttempts < (this.connection.config.maxReconnectAttempts || 5)) {
        const delay = this.getBackoffDelay();
        console.log(`Scheduling reconnect attempt ${this.connection.connectionAttempts} in ${delay}ms`);
        this.reconnectTimeout = setTimeout(async () => {
          try {
            await this.reconnect();
          } catch (error) {
            console.error('Auto-reconnect failed:', error);
            // Don't throw here to prevent uncaught promise rejection
          }
        }, delay);
      }
      
      throw this.createMCPError('connection', this.connection.error, error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        // Ignore disconnect errors
      }
      this.client = undefined;
    }
    
    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        // Ignore transport close errors
      }
      this.transport = undefined;
    }
    
    this.connection.status = 'disconnected';
    this.connection.client = undefined;
  }

  // Method to handle OAuth callback with authorization code
  async handleOAuthCallback(authorizationCode: string): Promise<void> {
    if (!this.oauthProvider) {
      throw new Error('OAuth provider not initialized');
    }

    console.log('Processing OAuth callback with authorization code...');
    
    try {
      // If we have an active transport, use its finishAuth method
      if (this.transport && typeof (this.transport as any).finishAuth === 'function') {
        console.log('Calling transport.finishAuth...');
        await (this.transport as any).finishAuth(authorizationCode);
        console.log('OAuth authorization completed via transport');
        
        // Now attempt to connect - the transport should be authenticated
        await this.connect();
      } else {
        // If no transport yet, store the authorization code and try connecting
        // The transport creation will handle the auth flow
        this.oauthProvider.pendingAuthorizationCode = authorizationCode;
        console.log('Stored authorization code, attempting connection...');
        await this.connect();
      }
      
      console.log('OAuth callback processed successfully');
    } catch (error) {
      console.error('OAuth callback processing failed:', error);
      throw new Error(`OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method to clear stored OAuth data
  clearOAuthData(): void {
    if (this.connection.authType === 'oauth' && this.oauthProvider) {
      // Clear connection-specific data
      localStorage.removeItem(`mcp_oauth_tokens_${this.connection.id}`);
      localStorage.removeItem(`mcp_oauth_state_${this.connection.id}`);
      
      // Note: We intentionally don't clear client information here since it's 
      // shared across connections to the same server. Use clearSharedClientData() 
      // if you need to clear the client registration for this server.
    }
  }

  // Method to clear shared client data for this server (affects all connections to the same server)
  clearSharedClientData(): void {
    if (this.connection.authType === 'oauth' && this.oauthProvider) {
      const serverKey = this.oauthProvider.getServerKey();
      localStorage.removeItem(`mcp_oauth_client_${serverKey}`);
    }
  }

  async reconnect(): Promise<void> {
    await this.connect();
  }

  // Handle successful OAuth completion
  private async handleOAuthSuccess(): Promise<void> {
    console.log('OAuth completed successfully, retrying connection...');
    
    try {
      // Reset connection state and retry
      this.connection.status = 'connecting';
      this.connection.error = undefined;
      this.notifyConnectionUpdate();
      
      // Attempt to connect now that we have valid tokens
      await this.connect();
      
      console.log('Post-OAuth connection successful!');
      this.notifyConnectionUpdate();
    } catch (error) {
      console.error('Post-OAuth connection failed:', error);
      this.connection.status = 'failed';
      this.connection.error = error instanceof Error ? error.message : 'Post-OAuth connection failed';
      this.notifyConnectionUpdate();
    }
  }


  private async tryStreamableHttp(): Promise<void> {
    try {
      console.log('Attempting StreamableHTTP connection to:', this.connection.url);
      
      // Create transport options with OAuth provider if configured
      const transportOptions: any = {};
      
      if (this.connection.authType === 'oauth' && this.oauthProvider) {
        transportOptions.authProvider = this.oauthProvider;
      }
      
      const transport = new StreamableHTTPClientTransport(new URL(this.connection.url), transportOptions);
      await this.initializeClient(transport);
      console.log('StreamableHTTP connection successful');
    } catch (error) {
      console.error('StreamableHTTP connection failed:', error);
      throw error;
    }
  }

  private async trySSE(): Promise<void> {
    try {
      console.log('Attempting SSE connection to:', this.connection.url);
      
      // Create transport options with OAuth provider if configured
      const transportOptions: any = {};
      
      if (this.connection.authType === 'oauth' && this.oauthProvider) {
        transportOptions.authProvider = this.oauthProvider;
      }
      
      const transport = new SSEClientTransport(new URL(this.connection.url), transportOptions);
      console.log('SSE transport created, attempting client connection...');
      await this.initializeClient(transport);
      console.log('SSE connection successful');
    } catch (error) {
      console.error('SSE connection failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url: this.connection.url
      });
      throw error;
    }
  }

  private async initializeClient(transport: Transport): Promise<void> {
    try {
      console.log('Initializing MCP client...');
      this.transport = transport;
      this.client = new Client(
        {
          name: 'example-remote-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      console.log('Connecting client to transport...');
      console.log('Transport type:', transport.constructor.name);
      console.log('Transport details:', transport);
      
      await this.client.connect(transport);
      this.connection.client = this.client;
      console.log('Client connected successfully');
    } catch (error) {
      console.error('Client initialization failed:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : error);
      console.error('Full error object:', error);
      throw error;
    }
  }

  private async initializeCapabilities(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      // Discover tools
      this.connection.tools = await this.discoverTools();
      
      // Discover resources (if supported)
      try {
        this.connection.resources = await this.discoverResources();
      } catch (error) {
        // Resources not supported by this server
        this.connection.resources = [];
      }
      
      // Discover prompts (if supported)
      try {
        this.connection.prompts = await this.discoverPrompts();
      } catch (error) {
        // Prompts not supported by this server
        this.connection.prompts = [];
      }
      
    } catch (error) {
      throw this.createMCPError('protocol', 'Failed to initialize server capabilities', error);
    }
  }

  async discoverTools(): Promise<Tool[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.listTools();

      // Transform MCP tools to our Tool interface with name prefixing
      // Use double underscore instead of dot to comply with OpenRouter API requirements
      return result.tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: `${this.connection.name}__${tool.name}`,
          description: `[${this.connection.name}] ${tool.description || ''}`,
          parameters: tool.inputSchema || {},
        },
      }));
    } catch (error) {
      throw this.createMCPError('protocol', 'Failed to discover tools', error);
    }
  }

  async discoverResources(): Promise<MCPResource[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.listResources();

      return result.resources.map(resource => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
    } catch (error) {
      throw this.createMCPError('protocol', 'Failed to discover resources', error);
    }
  }

  async discoverPrompts(): Promise<MCPPrompt[]> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.listPrompts();

      return result.prompts.map(prompt => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
      }));
    } catch (error) {
      throw this.createMCPError('protocol', 'Failed to discover prompts', error);
    }
  }

  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    // Remove the server prefix from the tool name (using double underscore separator)
    const unprefixedName = toolName.startsWith(`${this.connection.name}__`) 
      ? toolName.slice(this.connection.name.length + 2)
      : toolName;

    try {
      const result = await this.client.callTool({
        name: unprefixedName,
        arguments: args,
      });

      return result;
    } catch (error) {
      throw this.createMCPError('tool_execution', `Failed to call tool ${unprefixedName}`, error);
    }
  }

  getStatus(): MCPConnection['status'] {
    return this.connection.status;
  }

  private getBackoffDelay(): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return Math.min(1000 * Math.pow(2, this.connection.connectionAttempts - 1), 16000);
  }

  private startHealthCheck(): void {
    // Clear any existing health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Start health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000);
    
    console.log(`Started health check monitoring for ${this.connection.name}`);
  }

  private async performHealthCheck(): Promise<void> {
    // Only check if we're supposed to be connected
    if (this.connection.status !== 'connected' || !this.client) {
      return;
    }

    try {
      // Try to list tools as a health check - this is a lightweight operation
      await this.client.listTools();
      console.log(`Health check passed for ${this.connection.name}`);
    } catch (error) {
      console.warn(`Health check failed for ${this.connection.name}:`, error);
      await this.handleHealthCheckFailure(error);
    }
  }

  private async handleHealthCheckFailure(error: any): Promise<void> {
    console.log(`Connection health check failed for ${this.connection.name}, attempting reconnection...`);
    
    // Stop health check during reconnection attempt
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Mark as disconnected and attempt reconnection
    this.connection.status = 'connecting';
    this.connection.error = error instanceof Error ? error.message : 'Health check failed';
    this.notifyConnectionUpdate();

    try {
      // Attempt reconnection
      await this.connect();
      console.log(`Health check reconnection successful for ${this.connection.name}`);
    } catch (reconnectError) {
      console.error(`Health check reconnection failed for ${this.connection.name}:`, reconnectError);
      // The connect method will handle scheduling retry attempts
    }
  }

  private createMCPError(type: MCPError['type'], message: string, details?: any): MCPError {
    return {
      type,
      message,
      details,
      connectionId: this.connection.id,
      retryable: type === 'connection' || type === 'transport',
    };
  }
}