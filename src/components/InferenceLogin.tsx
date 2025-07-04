// Inference provider login component for inline authentication

import { useState, useMemo } from 'react';
import { useInference } from '@/contexts/InferenceContext';
import { OpenRouterApiProvider } from '@/providers/openrouter/api-provider';
import { OpenRouterOAuthProvider } from '@/providers/openrouter/oauth-provider';

export function InferenceLogin() {
  const { provider: currentProvider, setProvider, models, refreshAuthState } = useInference();
  const [selectedProviderId, setSelectedProviderId] = useState(currentProvider?.id || '');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create available providers
  const availableProviders = useMemo(() => [
    new OpenRouterApiProvider(),
    new OpenRouterOAuthProvider(),
  ], []);

  const selectedProvider = availableProviders.find(p => p.id === selectedProviderId);

  const handleApiKeyLogin = async () => {
    if (!selectedProvider || !apiKey.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await selectedProvider.authenticate({
        type: 'api_key',
        apiKey: apiKey.trim(),
      });

      // Load models after authentication
      await selectedProvider.loadModels();
      
      // Set this as the active provider
      setProvider(selectedProvider);
      refreshAuthState(); // Force re-render to show auth state
      setApiKey(''); // Clear the API key input
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    if (!selectedProvider) return;

    setIsLoading(true);
    setError(null);

    try {
      await selectedProvider.authenticate({
        type: 'oauth',
      });

      // Set this as the active provider
      setProvider(selectedProvider);
      refreshAuthState(); // Force re-render to show auth state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const capabilities = selectedProvider?.getCapabilities();

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Connect to AI Provider
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose a provider and authenticate to start chatting
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Provider Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          AI Provider
        </label>
        <select
          value={selectedProviderId}
          onChange={(e) => setSelectedProviderId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a provider...</option>
          {availableProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProvider && capabilities && (
        <div className="space-y-4">
          {/* API Key Authentication */}
          {capabilities.authMethods.includes('api_key') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && apiKey.trim()) {
                      handleApiKeyLogin();
                    }
                  }}
                />
                <button
                  onClick={handleApiKeyLogin}
                  disabled={!apiKey.trim() || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Connecting...' : 'Connect'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your API key is stored locally and never sent to our servers
              </p>
            </div>
          )}

          {/* OAuth Authentication */}
          {capabilities.authMethods.includes('oauth') && (
            <div>
              {capabilities.authMethods.includes('api_key') && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      or
                    </span>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleOAuthLogin}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Redirecting...' : `Sign in with ${selectedProvider.name} OAuth`}
              </button>
            </div>
          )}
        </div>
      )}

      {currentProvider?.isAuthenticated && models.length > 0 && (
        <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-md">
          <div className="flex items-center">
            <span className="text-green-600 dark:text-green-400 mr-2">✓</span>
            <span className="text-sm text-green-700 dark:text-green-300">
              Connected successfully! You can now start chatting.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}