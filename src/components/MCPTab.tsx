// MCP tab with server management and connection functionality

import { useState } from 'react';
import { useMCP } from '@/contexts/MCPContext';
import { MCPMessageMonitor } from './MCPMessageMonitor';

export function MCPTab() {
  const { connections, addMcpServer, removeMcpServer, reconnectServer, isLoading } = useMCP();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  
  // Collapsible section states
  const [showSummary, setShowSummary] = useState(true);
  const [showAddServers, setShowAddServers] = useState(true);
  const [showServerList, setShowServerList] = useState(true);

  const handleAddExampleServer = async () => {
    try {
      await addMcpServer({
        name: 'Example Server',
        url: 'https://example-server.modelcontextprotocol.io/sse',
      });
    } catch (error) {
      console.error('Failed to add example server:', error);
    }
  };

  const handleAddCustomServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerUrl.trim()) return;

    try {
      await addMcpServer({
        name: newServerName,
        url: newServerUrl,
      });
      
      // Reset form
      setNewServerName('');
      setNewServerUrl('');
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to add custom server:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 dark:text-green-400';
      case 'connecting':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'failed':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const connectedServers = connections.filter(conn => conn.status === 'connected');
  const allTools = connections.flatMap(conn => conn.tools);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Summary */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowSummary(!showSummary)}
          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              MCP Summary
            </h3>
            <span className="text-gray-500 dark:text-gray-400">
              {showSummary ? '−' : '+'}
            </span>
          </div>
        </button>
        {showSummary && (
          <div className="px-4 pb-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="text-sm space-y-1">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{connectedServers.length}</span> servers connected
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{allTools.length}</span> tools available
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Servers Section */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowAddServers(!showAddServers)}
          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Add Servers
            </h3>
            <span className="text-gray-500 dark:text-gray-400">
              {showAddServers ? '−' : '+'}
            </span>
          </div>
        </button>
        {showAddServers && (
          <div className="px-4 pb-4 space-y-3">
            {/* Example Server Button */}
            <button
              onClick={handleAddExampleServer}
              disabled={isLoading || connections.some(conn => conn.name === 'Example Server')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {connections.some(conn => conn.name === 'Example Server') ? 'Example Server Added' : 'Add Example Server'}
            </button>

            {/* Custom Server Form Toggle */}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {showAddForm ? 'Cancel' : 'Add Custom Server'}
            </button>

            {/* Custom Server Form */}
            {showAddForm && (
              <form onSubmit={handleAddCustomServer} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Server Name
              </label>
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="My MCP Server"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Server URL
              </label>
              <input
                type="url"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
                placeholder="https://your-server.com/sse"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !newServerName.trim() || !newServerUrl.trim()}
              className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Adding...' : 'Add Server'}
            </button>
          </form>
        )}
          </div>
        )}
      </div>

      {/* Server List */}
      <div className="flex-shrink-0">
        <button
          onClick={() => setShowServerList(!showServerList)}
          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Servers ({connections.length})
            </h3>
            <span className="text-gray-500 dark:text-gray-400">
              {showServerList ? '−' : '+'}
            </span>
          </div>
        </button>
        {showServerList && (
          <div className="max-h-60 overflow-y-auto p-4">
        
        {connections.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No MCP servers configured. Add a server above to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {connections.map((connection) => (
              <div
                key={connection.id}
                className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">
                        {getStatusIcon(connection.status)}
                      </span>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {connection.name}
                      </h4>
                      {connection.url === 'local' && (
                        <span className="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 rounded">
                          In-Memory
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${getStatusColor(connection.status)}`}>
                      {connection.status}
                    </p>
                    {connection.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {connection.error}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {connection.url}
                    </p>
                  </div>
                  
                  <div className="flex space-x-1 ml-2">
                    {(connection.status === 'failed' || connection.status === 'disconnected') && (
                      <button
                        onClick={() => reconnectServer(connection.id)}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                        title="Reconnect server"
                      >
                        Reconnect
                      </button>
                    )}
                    <button
                      onClick={() => removeMcpServer(connection.id)}
                      className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                      title="Remove server"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                
                {connection.tools.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Tools ({connection.tools.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {connection.tools.slice(0, 3).map((tool, index) => (
                        <span
                          key={index}
                          className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs rounded"
                        >
                          {tool.function.name.split('__').pop()}
                        </span>
                      ))}
                      {connection.tools.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{connection.tools.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Message Monitor */}
      <MCPMessageMonitor />
    </div>
  );
}