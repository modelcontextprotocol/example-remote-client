// Message list component to display conversation messages with tool calls

import type { ConversationMessage } from '@/types/conversation';

interface MessageListProps {
  messages: ConversationMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const renderContentBlock = (block: any, messageId: string, blockIndex: number) => {
    const key = `${messageId}-${blockIndex}`;
    
    switch (block.type) {
      case 'text':
        return (
          <div key={key} className="prose dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{block.text}</p>
          </div>
        );
        
      case 'tool_use':
        return (
          <div key={key} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 my-2">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">🔧</span>
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Using tool: {block.name}
              </span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded border p-3">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {JSON.stringify(block.input, null, 2)}
              </pre>
            </div>
          </div>
        );
        
      case 'tool_result':
        const isError = block.is_error;
        return (
          <div key={key} className={`border rounded-lg p-4 my-2 ${
            isError 
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm">
                {isError ? '❌' : '✅'}
              </span>
              <span className={`font-medium ${
                isError 
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-green-900 dark:text-green-100'
              }`}>
                Tool result
              </span>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded border p-3">
              {typeof block.content === 'string' ? (
                <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {block.content}
                </pre>
              ) : (
                block.content.map((contentItem: any, idx: number) => (
                  <div key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                    {contentItem.text && (
                      <pre className="whitespace-pre-wrap">{contentItem.text}</pre>
                    )}
                    {contentItem.error && (
                      <pre className="whitespace-pre-wrap text-red-600 dark:text-red-400">
                        Error: {contentItem.error}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
        
      default:
        return (
          <div key={key} className="bg-gray-100 dark:bg-gray-800 rounded p-2 text-sm">
            <span className="text-gray-500">Unknown content type: {block.type}</span>
          </div>
        );
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'user':
        return 'text-blue-600 dark:text-blue-400';
      case 'assistant':
        return 'text-green-600 dark:text-green-400';
      case 'tool':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getRoleLabel = (role: string): string => {
    switch (role) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'Assistant';
      case 'tool':
        return 'Tool';
      default:
        return role;
    }
  };

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">Start a conversation</p>
          <p className="text-sm">
            Ask a question or request help with something. The AI can use tools to help you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {messages.map((message) => (
        <div key={message.id} className="flex space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
              message.role === 'user' 
                ? 'bg-blue-500' 
                : message.role === 'assistant'
                ? 'bg-green-500'
                : 'bg-purple-500'
            }`}>
              {message.role === 'user' ? 'U' : message.role === 'assistant' ? 'A' : 'T'}
            </div>
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`font-medium text-sm ${getRoleColor(message.role)}`}>
                {getRoleLabel(message.role)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(message.timestamp)}
              </span>
            </div>

            {/* Render content blocks */}
            <div className="space-y-2">
              {message.content.map((block, index) => 
                renderContentBlock(block, message.id, index)
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex space-x-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-medium">
              A
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="font-medium text-sm text-green-600 dark:text-green-400">
                Assistant
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                thinking...
              </span>
            </div>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}