// Main conversation application with sidebar and chat interface

import { useState } from 'react';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { ConversationSidebar } from './ConversationSidebar';
import { ChatInterface } from './ChatInterface';
import { MCPStatus } from './MCPStatus';

export function ConversationApp() {
  const [showMCPStatus, setShowMCPStatus] = useState(false);

  return (
    <ConversationProvider>
      <div className="h-[calc(100vh-4rem)] flex bg-gray-100 dark:bg-gray-900">
        {/* Left Sidebar - Conversations */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversations
              </h1>
              <button
                onClick={() => setShowMCPStatus(!showMCPStatus)}
                className="text-sm px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {showMCPStatus ? 'Hide' : 'Show'} MCP
              </button>
            </div>
          </div>
          
          {showMCPStatus ? (
            <MCPStatus />
          ) : (
            <ConversationSidebar />
          )}
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <ChatInterface />
        </div>
      </div>
    </ConversationProvider>
  );
}