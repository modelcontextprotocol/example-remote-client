// React context for MCP server connection management

import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  MCPConnection,
  MCPServerConfig,
  MCPResource,
  MCPContextValue,
  MCPMessageCallback,
  MCPMonitorMessage,
} from '@/types/mcp';
import type { Tool } from '@/types/inference';
import { MCPConnectionManager } from '@/mcp/connection';
import { availableServers } from '@/mcp/servers';

const MCPContext = createContext<MCPContextValue | null>(null);

interface MCPProviderProps {
  children: ReactNode;
}

export function MCPProvider({ children }: MCPProviderProps) {
  const [connections, setConnections] = useState<MCPConnection[]>([]);
  const [managers, setManagers] = useState<Map<string, MCPConnectionManager>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedPersisted = useRef(false);
  const connectionsRef = useRef<MCPConnection[]>([]);
  
  // Message callback management
  const [messageCallbacks, setMessageCallbacks] = useState<Map<string, MCPMessageCallback>>(new Map());
  const messageCallbacksRef = useRef<Map<string, MCPMessageCallback>>(new Map());
  
  // Store messages for persistence
  const [messages, setMessages] = useState<MCPMonitorMessage[]>([]);
  const maxMessages = 100; // Keep last 100 messages
  
  // Keep refs in sync with state
  useEffect(() => {
    messageCallbacksRef.current = messageCallbacks;
  }, [messageCallbacks]);
  
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  // Function to add a message to the stored messages
  const addMessage = useCallback((message: MCPMonitorMessage) => {
    setMessages(prev => {
      const newMessages = [...prev, message];
      // Keep only the latest maxMessages
      return newMessages.slice(-maxMessages);
    });
  }, []);

  // Function to broadcast messages to all callbacks (stable reference)
  const broadcastMessage = useCallback((
    connection: MCPConnection, 
    client: any, 
    message: any, 
    direction: 'sent' | 'received', 
    extra?: any
  ) => {
    // Store message
    const storedMessage: MCPMonitorMessage = {
      id: uuidv4(),
      timestamp: new Date(),
      connectionId: connection.id,
      serverName: connection?.name || 'Unknown Server',
      message,
      direction,
      extra,
    };
    addMessage(storedMessage);
    
    messageCallbacksRef.current.forEach(callback => {
      try {
        callback(connection.id, client, message, direction, extra);
      } catch (error) {
        console.error('Error in MCP message callback:', error);
      }
    });
  }, [addMessage]); // Only depends on addMessage, uses ref for connections

  // Load persisted connections from localStorage on mount
  useEffect(() => {
    // Prevent loading if we've already loaded
    if (hasLoadedPersisted.current) {
      return;
    }
    
    hasLoadedPersisted.current = true;
    
    const loadPersistedConnections = async () => {
      try {
        const persistedData = localStorage.getItem('mcp_connections');
        if (persistedData) {
          const persistedData_parsed = JSON.parse(persistedData);
          
          // Handle both old format (array of configs) and new format (array of {id, config})
          const persistedConnections = Array.isArray(persistedData_parsed) && persistedData_parsed.length > 0
            ? (typeof persistedData_parsed[0] === 'object' && 'config' in persistedData_parsed[0]
                ? persistedData_parsed as {id: string, config: MCPServerConfig}[]
                : persistedData_parsed.map((config: MCPServerConfig) => ({id: uuidv4(), config})))
            : [];
          
          // Restore connections and auto-reconnect
          for (const {id: connectionId, config} of persistedConnections) {
            try {
              const manager = new MCPConnectionManager(connectionId, config);
              
              // Set up callback for connection state updates
              manager.setConnectionUpdateCallback(() => {
                setConnections(prev => {
                  connectionsRef.current = prev.map(conn => 
                    conn.id === connectionId ? manager.getConnection() : conn
                  )
                  return connectionsRef.current
                });
              });
              
              // Set up message callback
              manager.setMessageCallback(broadcastMessage);
              
              // Add to managers map
              setManagers(prev => new Map(prev).set(connectionId, manager));
              
              // Add initial connection state
              setConnections(prev => [...prev, manager.getConnection()]);
              
              // Auto-connect on restoration
              try {
                await manager.connect();
                console.log(`Auto-reconnected to ${config.name}`);
              } catch (error) {
                console.warn(`Failed to auto-reconnect to ${config.name}:`, error);
              }
            } catch (error) {
              console.warn(`Failed to restore connection to ${config.name}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load persisted MCP connections:', error);
      }
      
      // After loading persisted connections, add local servers
      await addLocalServers();
    };

    const addLocalServers = async () => {
      // Check if local servers are already added
      const hasLocalServers = connectionsRef.current.some(conn => conn.url === 'local');
      if (hasLocalServers) {
        return;
      }

      // Add each available local server
      for (const serverConfig of availableServers) {
        try {
          const connectionId = uuidv4();
          const manager = new MCPConnectionManager(connectionId, serverConfig);
          
          // Set up callback for connection state updates
          manager.setConnectionUpdateCallback(() => {
            setConnections(prev => {
               connectionsRef.current = prev.map(conn => 
                  conn.id === connectionId ? manager.getConnection() : conn
                );
               return connectionsRef.current;
            });
          });
          
          // Set up message callback
          manager.setMessageCallback(broadcastMessage);
          
          // Add to managers map
          setManagers(prev => new Map(prev).set(connectionId, manager));
          
          // Add initial connection state
          setConnections(prev => [...prev, manager.getConnection()]);
          
          // Auto-connect local servers
          await manager.connect();
          console.log(`Connected to local server: ${serverConfig.name}`);
        } catch (error) {
          console.error(`Failed to connect to local server ${serverConfig.name}:`, error);
        }
      }
    };

    loadPersistedConnections();
  }, []); // Empty dependency array - only run once on mount

  const persistConnections = useCallback(() => {
    try {
      // Store both config and connection ID to maintain OAuth token association
      const connectionData = connections.filter(conn => conn.url !== 'local').map(conn => ({
        id: conn.id,
        config: conn.config
      }));
      localStorage.setItem('mcp_connections', JSON.stringify(connectionData));
    } catch (error) {
      console.error('Failed to persist MCP connections:', error);
    }
  }, [connections]);

  // Auto-save connections to localStorage when they change
  useEffect(() => {
    // Only save if we've finished initial loading
    if (hasLoadedPersisted.current && connections.length > 0) {
      persistConnections();
    }
  }, [persistConnections]);

  const addMcpServer = useCallback(async (config: MCPServerConfig): Promise<string> => {
    const connectionId = uuidv4();
    
    setIsLoading(true);
    setError(null);

    try {
      // Create connection manager
      const manager = new MCPConnectionManager(connectionId, config);
      
      // Set up callback for connection state updates
      manager.setConnectionUpdateCallback(() => {
        setConnections(prev => 
          prev.map(conn => 
            conn.id === connectionId ? manager.getConnection() : conn
          )
        );
      });
      
      // Set up message callback
      manager.setMessageCallback(broadcastMessage);
      
      // Add to managers map
      setManagers(prev => new Map(prev).set(connectionId, manager));
      
      // Add initial connection state
      setConnections(prev => [...prev, manager.getConnection()]);
      
      // Attempt to connect
      try {
        await manager.connect();
        
        // Update connection state after successful connection
        setConnections(prev => 
          prev.map(conn => 
            conn.id === connectionId ? manager.getConnection() : conn
          )
        );
      } catch (error) {
        // Update connection state with error
        setConnections(prev => 
          prev.map(conn => 
            conn.id === connectionId ? managers.get(connectionId)?.getConnection() || conn : conn
          )
        );
        
        // For OAuth servers, initial connection failure is expected
        // The OAuth flow will handle the authentication and retry automatically
        console.log('Caught error during connection:', {
          authType: config.authType,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          fullError: error
        });
        
        const isUnauthorizedError = 
          config.authType === 'oauth' && (
            (error instanceof Error && error.message === 'Unauthorized') ||
            (error instanceof Error && error.constructor.name === 'UnauthorizedError')
          );
        
        if (isUnauthorizedError) {
          console.log('Initial OAuth connection failed as expected, OAuth flow will handle authentication...');
        } else {
          console.log('Non-OAuth error, propagating:', error);
          // For non-OAuth errors, propagate the error
          const errorMessage = error instanceof Error ? error.message : 'Failed to add MCP server';
          setError(errorMessage);
          throw error;
        }
      }
      
      return connectionId;
    } finally {
      setIsLoading(false);
    }
  }, [managers]);

  const removeMcpServer = useCallback((connectionId: string) => {
    const manager = managers.get(connectionId);
    if (manager) {
      // Disconnect the server
      manager.disconnect();
      
      // Remove from managers
      setManagers(prev => {
        const newMap = new Map(prev);
        newMap.delete(connectionId);
        return newMap;
      });
      
      // Remove from connections
      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    }
  }, [managers]);

  const reconnectServer = useCallback(async (connectionId: string): Promise<void> => {
    const manager = managers.get(connectionId);
    if (!manager) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    setIsLoading(true);
    setError(null);

    try {
      await manager.reconnect();
      
      // Update connection state
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId ? manager.getConnection() : conn
        )
      );
    } catch (error) {
      // Update connection state with error
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId ? manager.getConnection() : conn
        )
      );
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to reconnect server';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [managers]);

  const getAllTools = useCallback((): Tool[] => {
    return connections.flatMap(conn => conn.tools);
  }, [connections]);

  const getToolsForServer = useCallback((connectionId: string): Tool[] => {
    const connection = connections.find(conn => conn.id === connectionId);
    return connection?.tools || [];
  }, [connections]);

  const callTool = useCallback(async (connectionId: string, toolName: string, args: any): Promise<any> => {
    const manager = managers.get(connectionId);
    if (!manager) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      return await manager.callTool(toolName, args);
    } catch (error) {
      // Update connection state in case status changed
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId ? manager.getConnection() : conn
        )
      );
      throw error;
    }
  }, [managers]);

  const getAllResources = useCallback((): MCPResource[] => {
    return connections.flatMap(conn => conn.resources);
  }, [connections]);

  const getResourcesForServer = useCallback((connectionId: string): MCPResource[] => {
    const connection = connections.find(conn => conn.id === connectionId);
    return connection?.resources || [];
  }, [connections]);

  const getConnectedServers = useCallback((): MCPConnection[] => {
    return connections.filter(conn => conn.status === 'connected');
  }, [connections]);

  const getServerStatus = useCallback((connectionId: string): MCPConnection['status'] => {
    const connection = connections.find(conn => conn.id === connectionId);
    return connection?.status || 'disconnected';
  }, [connections]);

  const getConnectionById = useCallback((connectionId: string): MCPConnection | undefined => {
    return connections.find(conn => conn.id === connectionId);
  }, [connections]);

  const updateServerConfig = useCallback((connectionId: string, configUpdate: Partial<MCPServerConfig>) => {
    setConnections(prev => 
      prev.map(conn => 
        conn.id === connectionId 
          ? { ...conn, config: { ...conn.config, ...configUpdate } }
          : conn
      )
    );
  }, []);

  const handleOAuthCallback = useCallback(async (connectionId: string, authorizationCode: string): Promise<void> => {
    const manager = managers.get(connectionId);
    if (!manager) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    setIsLoading(true);
    setError(null);

    try {
      // Type assertion to access the OAuth callback method
      const connectionManager = manager as any;
      if (typeof connectionManager.handleOAuthCallback === 'function') {
        await connectionManager.handleOAuthCallback(authorizationCode);
        
        // Update connection state
        setConnections(prev => 
          prev.map(conn => 
            conn.id === connectionId ? manager.getConnection() : conn
          )
        );
      } else {
        throw new Error('OAuth callback not supported by this connection');
      }
    } catch (error) {
      // Update connection state with error
      setConnections(prev => 
        prev.map(conn => 
          conn.id === connectionId ? manager.getConnection() : conn
        )
      );
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to handle OAuth callback';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [managers]);

  // Message callback management
  const addMessageCallback = useCallback((callback: MCPMessageCallback): string => {
    const callbackId = uuidv4();
    setMessageCallbacks(prev => new Map(prev).set(callbackId, callback));
    return callbackId;
  }, []);

  const removeMessageCallback = useCallback((callbackId: string) => {
    setMessageCallbacks(prev => {
      const newMap = new Map(prev);
      newMap.delete(callbackId);
      return newMap;
    });
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const contextValue: MCPContextValue = {
    connections,
    isLoading,
    error,
    addMcpServer,
    removeMcpServer,
    reconnectServer,
    getAllTools,
    getToolsForServer,
    callTool,
    getAllResources,
    getResourcesForServer,
    getConnectedServers,
    getServerStatus,
    getConnectionById,
    updateServerConfig,
    handleOAuthCallback,
    messages,
    addMessageCallback,
    removeMessageCallback,
    clearMessages,
  };

  return (
    <MCPContext.Provider value={contextValue}>
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP(): MCPContextValue {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
}