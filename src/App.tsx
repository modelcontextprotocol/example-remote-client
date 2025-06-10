import React from 'react'
import { InferenceProvider } from '@/contexts/InferenceContext'
import { InferenceTest } from '@/components/InferenceTest'
import { OAuthCallback } from '@/components/OAuthCallback'

function App() {
  // Simple routing based on pathname
  const pathname = window.location.pathname;
  const isInferenceOAuthCallback = pathname === '/oauth/inference/callback';
  const isMcpOAuthCallback = pathname.startsWith('/oauth/mcp/');

  if (isInferenceOAuthCallback) {
    return <OAuthCallback type="inference" />;
  }

  if (isMcpOAuthCallback) {
    // Extract server identifier from path like /oauth/mcp/server123/callback
    const serverMatch = pathname.match(/^\/oauth\/mcp\/([^\/]+)\/callback$/);
    const serverId = serverMatch?.[1];
    return <OAuthCallback type="mcp" serverId={serverId} />;
  }

  return (
    <InferenceProvider>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <InferenceTest />
      </div>
    </InferenceProvider>
  )
}

export default App