import React, { useState } from 'react'
import { InferenceProvider } from '@/contexts/InferenceContext'
import { MCPProvider } from '@/contexts/MCPContext'
import { InferenceTest } from '@/components/InferenceTest'
import { MCPTest } from '@/components/MCPTest'
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

  const [activeTab, setActiveTab] = useState<'conversations' | 'inference' | 'mcp'>('conversations');

  return (
    <InferenceProvider>
      <MCPProvider>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('conversations')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'conversations'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Conversations
                </button>
                <button
                  onClick={() => setActiveTab('inference')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'inference'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Inference Provider Test
                </button>
                <button
                  onClick={() => setActiveTab('mcp')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'mcp'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  MCP Provider Test
                </button>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'conversations' && <ConversationApp />}
          {activeTab === 'inference' && <InferenceTest />}
          {activeTab === 'mcp' && <MCPTest />}
        </div>
      </MCPProvider>
    </InferenceProvider>
  )
}

export default App