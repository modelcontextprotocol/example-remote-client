// Test UI for inference provider functionality

import { useState, useCallback } from 'react';
import { useInference } from '@/contexts/InferenceContext';
import { OpenRouterApiProvider, OpenRouterOAuthProvider } from '@/providers/openrouter';
import type { ChatMessage, InferenceRequest } from '@/types/inference';
import { testTools, executeTestTool } from '@/utils/testTools';

export function InferenceTest() {
  const {
    provider,
    isLoading,
    error,
    setProvider,
    clearProvider,
    generateResponse,
    selectModel,
    loadModels,
    models,
    selectedModel,
    isAuthenticated,
  } = useInference();

  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState<string>('');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [enableTools, setEnableTools] = useState(false);

  const handleApiAuth = useCallback(async () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }

    try {
      const apiProvider = new OpenRouterApiProvider();
      await apiProvider.authenticate({ type: 'api_key', apiKey: apiKey.trim() });
      setProvider(apiProvider);
    } catch (err) {
      console.error('API authentication failed:', err);
      alert(`Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [apiKey, setProvider]);

  const handleOAuthAuth = useCallback(async () => {
    try {
      const oauthProvider = new OpenRouterOAuthProvider();
      await oauthProvider.authenticate({ type: 'oauth' });
      setProvider(oauthProvider);
    } catch (err) {
      console.error('OAuth authentication failed:', err);
      alert(`OAuth failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [setProvider]);

  const handleLoadModels = useCallback(async () => {
    try {
      await loadModels();
    } catch (err) {
      console.error('Failed to load models:', err);
      alert(`Failed to load models: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [loadModels]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || !provider || !selectedModel) {
      alert('Please enter a message and ensure a model is selected');
      return;
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: message.trim(),
    };

    let currentConversation = [...conversation, userMessage];
    setConversation(currentConversation);
    setMessage('');
    setResponse('');

    const request: InferenceRequest = {
      messages: currentConversation,
      maxTokens: 500,
      temperature: 0.7,
      tools: enableTools ? testTools : undefined,
    };

    try {
      const result = await generateResponse(request);
      let assistantMessage = result.message;
      
      // Handle tool calls
      if (assistantMessage.toolCalls && assistantMessage.toolCalls.length > 0) {
        // Add the assistant message with tool calls
        currentConversation = [...currentConversation, assistantMessage];
        setConversation(currentConversation);

        // Execute each tool call and add tool results
        for (const toolCall of assistantMessage.toolCalls) {
          const toolResult = executeTestTool(toolCall.function.name, toolCall.function.arguments);
          
          const toolMessage: ChatMessage = {
            role: 'tool',
            content: toolResult,
            toolCallId: toolCall.id,
          };

          currentConversation = [...currentConversation, toolMessage];
          setConversation(currentConversation);
        }

        // Make another request with the tool results
        const followUpRequest: InferenceRequest = {
          messages: currentConversation,
          maxTokens: 500,
          temperature: 0.7,
          tools: enableTools ? testTools : undefined,
        };

        const followUpResult = await generateResponse(followUpRequest);
        assistantMessage = followUpResult.message;
        setResponse(JSON.stringify(followUpResult, null, 2));
      } else {
        setResponse(JSON.stringify(result, null, 2));
      }
      
      setConversation([...currentConversation, assistantMessage]);
    } catch (err) {
      console.error('Inference failed:', err);
      alert(`Inference failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [message, provider, selectedModel, conversation, generateResponse, enableTools]);

  const handleClearConversation = useCallback(() => {
    setConversation([]);
    setResponse('');
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Inference Provider Test
        </h1>

        {/* Authentication Section */}
        <div className="space-y-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Authentication
          </h2>
          
          {!isAuthenticated ? (
            <div className="space-y-4">
              {/* API Key Auth */}
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter OpenRouter API Key"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  onClick={handleApiAuth}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  API Key Auth
                </button>
              </div>

              {/* OAuth Auth */}
              <div>
                <button
                  onClick={handleOAuthAuth}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  OAuth Auth
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-green-600 dark:text-green-400">
                ✓ Authenticated with {provider?.name}
              </span>
              <button
                onClick={clearProvider}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Model Selection */}
        {isAuthenticated && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Model Selection
              </h2>
              <button
                onClick={handleLoadModels}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
              >
                Reload Models
              </button>
            </div>

            {models.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={selectedModel?.id || ''}
                  onChange={(e) => selectModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a model</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.id})
                    </option>
                  ))}
                </select>
                
                {selectedModel && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Context: {selectedModel.contextLength} tokens | 
                    Max output: {selectedModel.capabilities.maxTokens} tokens | 
                    Tools: ✓ (all models support tools)
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No models loaded</p>
            )}
          </div>
        )}

        {/* Chat Interface */}
        {isAuthenticated && selectedModel && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Chat Test
              </h2>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableTools}
                  onChange={(e) => setEnableTools(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable Tools</span>
              </label>
              <button
                onClick={handleClearConversation}
                className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
              >
                Clear
              </button>
            </div>

            {/* Tool Test Suggestions */}
            {enableTools && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Tool Test Suggestions:
                </h3>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <div>• "What's the weather in San Francisco?"</div>
                  <div>• "Calculate 123 + 456"</div>
                  <div>• "What time is it in London?"</div>
                  <div>• "Get weather for Tokyo and add 10 + 20"</div>
                </div>
                <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                  Available tools: get_weather, calculate_sum, get_current_time
                </div>
              </div>
            )}

            {/* Conversation */}
            {conversation.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 max-h-80 overflow-y-auto space-y-3">
                {conversation.map((msg, index) => (
                  <div key={index} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                    <div className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {msg.role === 'user' && '👤 You'}
                      {msg.role === 'assistant' && '🤖 Assistant'}
                      {msg.role === 'tool' && '🛠️ Tool Result'}
                    </div>
                    
                    <div className="text-gray-900 dark:text-gray-100">
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    </div>
                    
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.toolCalls.map((toolCall, tcIndex) => (
                          <div key={tcIndex} className="bg-blue-100 dark:bg-blue-900/30 rounded-md p-2 text-sm">
                            <div className="font-medium text-blue-800 dark:text-blue-200">
                              🔧 {toolCall.function.name}
                            </div>
                            <div className="text-blue-700 dark:text-blue-300 mt-1">
                              {JSON.stringify(toolCall.function.arguments, null, 2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {msg.toolCallId && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ↳ Response to tool call: {msg.toolCallId}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter your message..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !message.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-700 dark:text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Response Debug */}
        {response && (
          <div className="mt-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Last Response (Debug):
            </h3>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-xs overflow-x-auto text-gray-900 dark:text-gray-100">
              {response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}