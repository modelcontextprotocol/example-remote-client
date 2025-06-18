import { InferenceContextProvider } from '@/contexts/InferenceContext'
import { MCPProvider } from '@/contexts/MCPContext'
import { ConversationApp } from '@/components/ConversationApp'
import { OAuthCallback } from '@/components/OAuthCallback'

function App() {
  // Check if this is an OAuth callback based on query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  // Determine OAuth callback type from state parameter
  let oauthType: 'inference' | 'mcp' | null = null;
  if (code && state) {
    // The state parameter includes the callback type
    if (state.includes('inference:')) {
      oauthType = 'inference';
    } else if (state.includes('mcp:')) {
      oauthType = 'mcp';
    }
  }

  if (oauthType) {
    return <OAuthCallback type={oauthType} />;
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