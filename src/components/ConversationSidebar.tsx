// Conversation sidebar with conversation list and management

import { useConversation } from '@/contexts/ConversationContext';
import { useInference } from '@/contexts/InferenceContext';
import { useMCP } from '@/contexts/MCPContext';

export function ConversationSidebar() {
  const {
    conversations,
    activeConversationId,
    createConversation,
    deleteConversation,
    setActiveConversation,
  } = useConversation();
  
  const { clearProvider, provider } = useInference();
  const { connections, removeMcpServer } = useMCP();

  const handleNewConversation = () => {
    createConversation();
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the application? This will clear all data including conversations, authentication, and server connections.')) {
      // Clear inference provider authentication
      clearProvider();
      
      // Remove all MCP servers (this will disconnect them)
      connections.forEach(connection => {
        removeMcpServer(connection.id);
      });
      
      // Clear all conversations
      conversations.forEach(conversation => {
        deleteConversation(conversation.id);
      });
      
      // Clear ALL localStorage data
      localStorage.clear();
      
      // Refresh the page to ensure clean state
      window.location.reload();
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'thinking':
        return '💭';
      case 'calling_tools':
        return '🔧';
      case 'error':
        return '❌';
      default:
        return '';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* New Conversation Button */}
      <div className="p-4">
        <button
          onClick={handleNewConversation}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p>No conversations yet.</p>
            <p className="text-sm mt-1">Click "New Conversation" to get started.</p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setActiveConversation(conversation.id)}
                className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                  activeConversationId === conversation.id
                    ? 'bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {conversation.title}
                      </h3>
                      <span className="text-xs">
                        {getStatusIndicator(conversation.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(conversation.updatedAt)}
                    </p>
                    {conversation.messages.length > 0 && (
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                        {(() => {
                          const lastMessage = conversation.messages[conversation.messages.length - 1];
                          const firstBlock = lastMessage?.content?.[0];
                          return firstBlock?.type === 'text' ? firstBlock.text : 'Tool interaction';
                        })()}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conversation.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                    title="Delete conversation"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset Button */}
      {provider && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Reset All Data
          </button>
        </div>
      )}
    </div>
  );
}