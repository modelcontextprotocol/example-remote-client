// Component to monitor and display MCP messages

import { useState, useRef } from 'react';
import { useMCP } from '@/contexts/MCPContext';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export function MCPMessageMonitor() {
  const { messages, clearMessages } = useMCP();
  const [maxMessages, setMaxMessages] = useState(50);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Slice messages to show only the latest maxMessages
  const displayMessages = messages.slice(-maxMessages);

  const formatMessage = (msg: JSONRPCMessage) => {
    if ('method' in msg) {
      return `${msg.method}${'id' in msg ? ` (${msg.id})` : ''}`;
    }
    if ('id' in msg && 'result' in msg) {
      return `Response (${msg.id})`;
    }
    if ('id' in msg && 'error' in msg) {
      return `Error (${msg.id})`;
    }
    return 'Unknown';
  };

  const getMessageTypeColor = (msg: JSONRPCMessage, direction: string) => {
    const baseClass = direction === 'sent' 
      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
      : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
    
    if ('error' in msg) {
      return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    }
    
    return baseClass;
  };


  return (
    <div className="flex-1 flex flex-col border-t border-gray-200 dark:border-gray-700 min-h-0">
      <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Message Monitor ({displayMessages.length})
        </h3>
        <button
          onClick={clearMessages}
          className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 mx-4 mb-2 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
        {displayMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No messages yet. Messages will appear here as they're sent/received.
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {displayMessages.map((entry) => (
              <div
                key={entry.id}
                className={`p-2 rounded border text-xs ${getMessageTypeColor(entry.message, entry.direction)}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className={entry.direction === 'sent' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}>
                      {entry.direction === 'sent' ? '→' : '←'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMessage(entry.message)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {entry.serverName}
                    </span>
                  </div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <details className="text-gray-600 dark:text-gray-300">
                  <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100">
                    Details
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify(entry.message, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 pt-2 flex items-center justify-between text-xs border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <label className="text-gray-600 dark:text-gray-400">
            Max messages:
          </label>
          <select
            value={maxMessages}
            onChange={(e) => setMaxMessages(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          Live monitoring active
        </div>
      </div>
    </div>
  );
}