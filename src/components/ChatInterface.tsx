// Main chat interface with message display and input

import { useState, useRef, useEffect } from 'react';
import { useConversation } from '@/contexts/ConversationContext';
import { useInference } from '@/contexts/InferenceContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { InferenceLogin } from './InferenceLogin';

export function ChatInterface() {
  const {
    activeConversationId,
    getConversation,
    sendMessage,
    stopAgentLoop,
    getAgentLoopState,
  } = useConversation();
  
  const { 
    models, 
    selectedModel, 
    selectModel,
    isAuthenticated 
  } = useInference();
  const [loadingConversations, setLoadingConversations] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = activeConversationId ? getConversation(activeConversationId) : undefined;
  const agentLoopState = activeConversationId ? getAgentLoopState(activeConversationId) : undefined;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId || !isAuthenticated) {
      return;
    }

    setLoadingConversations(prev => new Set(prev).add(activeConversationId));
    try {
      await sendMessage(activeConversationId, content);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoadingConversations(prev => {
        const newSet = new Set(prev);
        newSet.delete(activeConversationId);
        return newSet;
      });
    }
  };

  const handleStopGeneration = () => {
    if (activeConversationId) {
      stopAgentLoop(activeConversationId);
    }
  };

  // Show empty state if no conversation is selected
  if (!activeConversationId || !activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <h2 className="text-2xl font-bold mb-4">Welcome to MCP Chat</h2>
          <p className="mb-2">Start a new conversation to begin chatting with AI.</p>
          <p className="text-sm">
            The AI has access to both test tools and any connected MCP servers.
          </p>
        </div>
      </div>
    );
  }

  // Show auth prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <InferenceLogin />
      </div>
    );
  }

  const isCurrentConversationLoading = activeConversationId ? loadingConversations.has(activeConversationId) : false;
  const isGenerating = agentLoopState?.isRunning || isCurrentConversationLoading;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeConversation.title}
            </h2>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Model:
              </span>
              <select
                value={selectedModel?.id || ''}
                onChange={(e) => selectModel(e.target.value)}
                disabled={isGenerating || !isAuthenticated}
                className="text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                <option value="">Select a model</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {isGenerating && (
            <button
              onClick={handleStopGeneration}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Stop Generation
            </button>
          )}
        </div>
        
        {/* Status Indicator */}
        {agentLoopState && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            {agentLoopState.isRunning && (
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>
                  {agentLoopState.currentStep === 'inference' && 'Thinking...'}
                  {agentLoopState.currentStep === 'tool_execution' && 'Using tools...'}
                  {agentLoopState.currentStep === 'complete' && 'Complete'}
                </span>
                <span className="text-gray-500">
                  (Step {agentLoopState.iteration + 1}/{agentLoopState.maxIterations})
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <MessageList 
          messages={activeConversation.messages}
          isLoading={isGenerating}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <MessageInput
          onSendMessage={handleSendMessage}
          disabled={isGenerating}
          placeholder={
            isGenerating 
              ? "AI is thinking..." 
              : "Type your message..."
          }
        />
      </div>
    </div>
  );
}