// MCP status display for the conversation sidebar

import { useMCP } from '@/contexts/MCPContext';

export function MCPStatus() {
  const { connections, getAllTools, reconnectServer } = useMCP();
  
  const connectedServers = connections.filter(conn => conn.status === 'connected');
  const allTools = getAllTools();

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

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="space-y-4">
        {/* Summary */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            MCP Summary
          </h3>
          <div className="text-sm space-y-1">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{connectedServers.length}</span> servers connected
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{allTools.length}</span> tools available
            </p>
          </div>
        </div>

        {/* Server List */}
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Servers ({connections.length})
          </h3>
          
          {connections.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No MCP servers configured. Go to the "MCP Provider Test" tab to add servers.
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">
                          {getStatusIcon(connection.status)}
                        </span>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {connection.name}
                        </h4>
                      </div>
                      <p className={`text-xs mt-1 ${getStatusColor(connection.status)}`}>
                        {connection.status}
                      </p>
                      {connection.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {connection.error}
                        </p>
                      )}
                    </div>
                    
                    {(connection.status === 'failed' || connection.status === 'disconnected') && (
                      <button
                        onClick={() => reconnectServer(connection.id)}
                        className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                        title="Reconnect server"
                      >
                        Reconnect
                      </button>
                    )}
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
                            {tool.function.name.split('.').pop()}
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

        {/* Available Tools */}
        {allTools.length > 0 && (
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              Available Tools ({allTools.length})
            </h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {allTools.map((tool, index) => (
                <div
                  key={index}
                  className="text-xs bg-gray-50 dark:bg-gray-700 rounded px-2 py-1"
                >
                  <span className="font-mono text-gray-900 dark:text-white">
                    {tool.function.name}
                  </span>
                  {tool.function.description && (
                    <p className="text-gray-600 dark:text-gray-300 mt-1">
                      {tool.function.description}
                    </p>
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