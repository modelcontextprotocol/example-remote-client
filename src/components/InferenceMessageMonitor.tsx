// Component to monitor and display inference messages

import { useState, useRef } from 'react';
import { useInference } from '@/contexts/InferenceContext';
import type { InferenceMessage } from '@/types/inference';

export function InferenceMessageMonitor() {
  const { messages, clearMessages } = useInference();
  const [maxMessages, setMaxMessages] = useState(50);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Slice messages to show only the latest maxMessages
  const displayMessages = messages.slice(-maxMessages);

  const getMessageTypeColor = (type: InferenceMessage['type']) => {
    switch (type) {
      case 'request':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
      case 'response':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
      case 'stream_chunk':
        return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatMessage = (message: InferenceMessage) => {
    switch (message.type) {
      case 'request':
        return `Request to ${message.model || 'default model'}`;
      case 'response':
        return `Response from ${message.model || 'default model'}`;
      case 'error':
        return `Error from ${message.model || 'default model'}`;
      case 'stream_chunk':
        return `Stream chunk from ${message.model || 'default model'}`;
      default:
        return 'Unknown message type';
    }
  };

  return (
    <div className="flex-1 flex flex-col border-t border-gray-200 dark:border-gray-700 min-h-0">
      <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Inference Monitor ({displayMessages.length})
        </h3>
        <button
          onClick={clearMessages}
          className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 mx-4 mb-2 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg min-h-0">
        {displayMessages.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No messages yet. Messages will appear here as inference requests are made.
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={`p-2 rounded border text-xs ${getMessageTypeColor(message.type)}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className={
                      message.type === 'request' ? 'text-blue-600 dark:text-blue-400' : 
                      message.type === 'response' ? 'text-green-600 dark:text-green-400' :
                      message.type === 'error' ? 'text-red-600 dark:text-red-400' :
                      'text-yellow-600 dark:text-yellow-400'
                    }>
                      {message.type === 'request' ? '→' : 
                       message.type === 'response' ? '←' :
                       message.type === 'error' ? '✗' : '⋯'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMessage(message)}
                    </span>
                    {message.duration && (
                      <span className="text-gray-500 dark:text-gray-400">
                        ({formatDuration(message.duration)})
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                
                {/* Message metadata */}
                <details className="text-gray-600 dark:text-gray-300 mt-2">
                  <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100">
                    Message Metadata
                  </summary>
                  <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                    {JSON.stringify({
                      id: message.id,
                      type: message.type,
                      providerId: message.providerId,
                      providerName: message.providerName,
                      model: message.model,
                      timestamp: message.timestamp.toISOString(),
                      duration: message.duration
                    }, null, 2)}
                  </pre>
                </details>
                
                {/* Request details */}
                {message.request && (
                  <details className="text-gray-600 dark:text-gray-300 mt-2">
                    <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100">
                      Request Details
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(message.request, null, 2)}
                    </pre>
                  </details>
                )}
                
                {/* Response details */}
                {message.response && (
                  <details className="text-gray-600 dark:text-gray-300 mt-2">
                    <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100">
                      Response Details
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {JSON.stringify(message.response, null, 2)}
                    </pre>
                  </details>
                )}
                
                {/* Error details */}
                {message.error && (
                  <details className="text-gray-600 dark:text-gray-300 mt-2">
                    <summary className="cursor-pointer hover:text-gray-800 dark:hover:text-gray-100">
                      Error Details
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                      {message.error instanceof Error ? message.error.message : JSON.stringify(message.error, null, 2)}
                    </pre>
                  </details>
                )}
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