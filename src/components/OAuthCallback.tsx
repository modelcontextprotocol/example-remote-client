// OAuth callback handler for popup-based OAuth flows

import { useEffect } from 'react';

interface OAuthCallbackProps {
  type: 'inference' | 'mcp';
}

export function OAuthCallback({ type }: OAuthCallbackProps) {
  useEffect(() => {
    // Extract OAuth parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // For MCP OAuth, we just pass the callback data to the parent window
    // The parent window (which has the MCPProvider context) will handle the actual callback processing
    if (window.opener) {
      const messageType = type === 'inference' ? 'oauth_callback' : 'mcp_oauth_callback';
      
      if (error) {
        window.opener.postMessage({
          type: messageType,
          callbackType: type,
          error: errorDescription || error,
          state,
        }, window.location.origin);
      } else if (code && state) {
        window.opener.postMessage({
          type: messageType,
          callbackType: type,
          code,
          state,
        }, window.location.origin);
      } else {
        window.opener.postMessage({
          type: messageType,
          callbackType: type,
          error: 'Invalid OAuth callback - missing code or state',
          state,
        }, window.location.origin);
      }

      // Close the popup after a small delay to ensure message is processed
      setTimeout(() => {
        window.close();
      }, 100);
    } else {
      // Fallback if not in a popup - redirect to main app
      window.location.href = '/';
    }
  }, [type]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 max-w-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Processing OAuth callback...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This window will close automatically.
          </p>
        </div>
      </div>
    </div>
  );
}