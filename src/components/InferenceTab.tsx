// Inference tab for managing OpenRouter connection

import { useState } from 'react';
import { useInference } from '@/contexts/InferenceContext';
import { OpenRouterOAuthProvider } from '@/providers/openrouter/oauth-provider';
import { InferenceMessageMonitor } from './InferenceMessageMonitor';

export function InferenceTab() {
  const { provider, models, clearProvider, setProvider } = useInference();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(true);
  const [showModels, setShowModels] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const oauthProvider = new OpenRouterOAuthProvider();
      await oauthProvider.authenticate({ type: 'oauth' });
      setProvider(oauthProvider);
    } catch (error) {
      console.error('Failed to connect to OpenRouter:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect from OpenRouter? This will clear your authentication.')) {
      clearProvider();
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Connection Status */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowConnectionStatus(!showConnectionStatus)}
          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Connection Status
            </h3>
            <span className="text-gray-500 dark:text-gray-400">
              {showConnectionStatus ? '−' : '+'}
            </span>
          </div>
        </button>
        {showConnectionStatus && (
          <div className="px-4 pb-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              {provider ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="text-green-600 dark:text-green-400">🟢</span> Connected to {provider.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {models.length} models available
                      </p>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-gray-400">⚪</span> Not connected
                  </p>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect to OpenRouter'}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                    <p>Connect to OpenRouter to access AI models for conversations.</p>
                    <p>You'll need an OpenRouter account and API key to authenticate.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Available Models */}
      {provider && models.length > 0 && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowModels(!showModels)}
            className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Available Models ({models.length})
              </h3>
              <span className="text-gray-500 dark:text-gray-400">
                {showModels ? '−' : '+'}
              </span>
            </div>
          </button>
          {showModels && (
            <div className="px-4 pb-4">
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {models.map((model) => (
                  <div
                    key={model.id}
                    className="text-xs bg-gray-50 dark:bg-gray-700 rounded px-2 py-2"
                  >
                    <div className="font-mono text-gray-900 dark:text-white">
                      {model.id}
                    </div>
                    {model.name && model.name !== model.id && (
                      <div className="text-gray-600 dark:text-gray-300 mt-1">
                        {model.name}
                      </div>
                    )}
                    <div className="text-gray-500 dark:text-gray-400 mt-1">
                      Context: {model.contextLength?.toLocaleString() || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inference Message Monitor */}
      <InferenceMessageMonitor />
    </div>
  );
}