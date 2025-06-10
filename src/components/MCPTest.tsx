// Test UI for MCP provider functionality

import React, { useState, useCallback } from 'react';
import { useMCP } from '@/contexts/MCPContext';
import type { MCPServerConfig } from '@/types/mcp';

export function MCPTest() {
  const {
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
    getConnectedServers,
  } = useMCP();

  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [selectedToolName, setSelectedToolName] = useState('');
  const [toolArgs, setToolArgs] = useState('{}');
  const [toolResult, setToolResult] = useState<string>('');

  const handleAddServer = useCallback(async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      alert('Please enter both server name and URL');
      return;
    }

    const config: MCPServerConfig = {
      name: newServerName.trim(),
      url: newServerUrl.trim(),
      transport: 'auto',
      authType: 'none',
      autoReconnect: false, // Disable auto-reconnect for now to prevent loops
    };

    try {
      await addMcpServer(config);
      setNewServerName('');
      setNewServerUrl('');
    } catch (error) {
      console.error('Failed to add server:', error);
      alert(`Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [newServerName, newServerUrl, addMcpServer]);

  const handleAddServerWithOAuth = useCallback(async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      alert('Please enter both server name and URL');
      return;
    }

    const config: MCPServerConfig = {
      name: newServerName.trim(),
      url: newServerUrl.trim(),
      transport: 'auto',
      authType: 'oauth',
      autoReconnect: false,
    };

    try {
      await addMcpServer(config);
      setNewServerName('');
      setNewServerUrl('');
    } catch (error) {
      console.error('Failed to add server with OAuth:', error);
      alert(`Failed to add server with OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [newServerName, newServerUrl, addMcpServer]);

  const handleRemoveServer = useCallback((connectionId: string) => {
    if (confirm('Are you sure you want to remove this server?')) {
      removeMcpServer(connectionId);
      if (selectedConnectionId === connectionId) {
        setSelectedConnectionId('');
      }
    }
  }, [removeMcpServer, selectedConnectionId]);

  const handleReconnectServer = useCallback(async (connectionId: string) => {
    try {
      await reconnectServer(connectionId);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      alert(`Failed to reconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [reconnectServer]);

  const handleCallTool = useCallback(async () => {
    if (!selectedConnectionId || !selectedToolName) {
      alert('Please select a connection and tool');
      return;
    }

    try {
      const args = JSON.parse(toolArgs);
      const result = await callTool(selectedConnectionId, selectedToolName, args);
      setToolResult(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Tool call failed:', error);
      const errorResult = {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      };
      setToolResult(JSON.stringify(errorResult, null, 2));
    }
  }, [selectedConnectionId, selectedToolName, toolArgs, callTool]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 dark:text-green-400';
      case 'connecting': return 'text-yellow-600 dark:text-yellow-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      case 'disconnected': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return '✅';
      case 'connecting': return '🔄';
      case 'failed': return '❌';
      case 'disconnected': return '⚫';
      default: return '❓';
    }
  };

  const selectedConnection = connections.find(conn => conn.id === selectedConnectionId);
  const selectedTools = selectedConnection ? getToolsForServer(selectedConnectionId) : [];
  const allTools = getAllTools();
  const allResources = getAllResources();
  const connectedServers = getConnectedServers();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          MCP Provider Test
        </h1>

        {/* Add Server Section */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add MCP Server
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Server name (e.g., 'Weather Service')"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
            />
            <input
              type="url"
              placeholder="Server URL (e.g., 'https://api.example.com/mcp')"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              value={newServerUrl}
              onChange={(e) => setNewServerUrl(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleAddServer}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add Server (No Auth)'}
            </button>
            <button
              onClick={handleAddServerWithOAuth}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add Server (OAuth)'}
            </button>
          </div>
        </div>

        {/* Server List */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Connected Servers ({connections.length})
          </h2>
          
          {connections.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No servers added yet.</p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getStatusIcon(connection.status)}</span>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            {connection.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {connection.url}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className={getStatusColor(connection.status)}>
                          Status: {connection.status}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Transport: {connection.transport}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Tools: {connection.tools.length}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          Resources: {connection.resources.length}
                        </span>
                        {connection.connectionAttempts > 0 && (
                          <span className="text-orange-600 dark:text-orange-400">
                            Attempts: {connection.connectionAttempts}
                          </span>
                        )}
                      </div>
                      
                      {connection.error && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                          Error: {connection.error}
                        </div>
                      )}
                      
                      {connection.lastConnected && (
                        <div className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                          Last connected: {connection.lastConnected.toLocaleString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {connection.status === 'failed' && (
                        <button
                          onClick={() => handleReconnectServer(connection.id)}
                          className="px-3 py-1 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveServer(connection.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tool Testing */}
        {connectedServers.length > 0 && (
          <div className="space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tool Testing
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Server Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Server:
                </label>
                <select
                  value={selectedConnectionId}
                  onChange={(e) => {
                    setSelectedConnectionId(e.target.value);
                    setSelectedToolName('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a server</option>
                  {connectedServers.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} ({connection.tools.length} tools)
                    </option>
                  ))}
                </select>
              </div>

              {/* Tool Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Tool:
                </label>
                <select
                  value={selectedToolName}
                  onChange={(e) => setSelectedToolName(e.target.value)}
                  disabled={!selectedConnectionId}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="">Select a tool</option>
                  {selectedTools.map((tool) => (
                    <option key={tool.function.name} value={tool.function.name}>
                      {tool.function.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tool Arguments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tool Arguments (JSON):
              </label>
              <textarea
                value={toolArgs}
                onChange={(e) => setToolArgs(e.target.value)}
                placeholder='{"param1": "value1", "param2": "value2"}'
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                rows={3}
              />
            </div>

            {/* Call Tool Button */}
            <button
              onClick={handleCallTool}
              disabled={!selectedConnectionId || !selectedToolName || isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Calling...' : 'Call Tool'}
            </button>

            {/* Tool Result */}
            {toolResult && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tool Result:
                </label>
                <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
                  {toolResult}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {connections.length}
            </div>
            <div className="text-sm text-blue-800 dark:text-blue-200">
              Total Servers
            </div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {connectedServers.length}
            </div>
            <div className="text-sm text-green-800 dark:text-green-200">
              Connected
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {allTools.length}
            </div>
            <div className="text-sm text-purple-800 dark:text-purple-200">
              Total Tools
            </div>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {allResources.length}
            </div>
            <div className="text-sm text-orange-800 dark:text-orange-200">
              Total Resources
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-red-700 dark:text-red-400">Error: {error}</p>
          </div>
        )}

        {/* All Tools List */}
        {allTools.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              All Available Tools ({allTools.length})
            </h2>
            <div className="grid gap-2">
              {allTools.map((tool, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {tool.function.name}
                  </div>
                  {tool.function.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {tool.function.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}