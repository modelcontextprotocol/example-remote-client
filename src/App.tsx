import { InferenceContextProvider } from '@/contexts/InferenceContext'
import { MCPProvider } from '@/contexts/MCPContext'
import { ConversationApp } from '@/components/ConversationApp'
import { OAuthCallback } from '@/components/OAuthCallback'

function App() {
  // Simple routing based on pathname
  const pathname = window.location.pathname;
  const isInferenceOAuthCallback = pathname === '/oauth/inference/callback';
  const isMcpOAuthCallback = pathname === '/oauth/mcp/callback';

  if (isInferenceOAuthCallback) {
    return <OAuthCallback type="inference" />;
  }

  if (isMcpOAuthCallback) {
    return <OAuthCallback type="mcp" />;
  }

  return (
    <InferenceContextProvider>
      <MCPProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          <ConversationApp />
        </div>
      </MCPProvider>
    </InferenceContextProvider>
  )
}

export default App