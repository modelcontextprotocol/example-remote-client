// Tabbed sidebar with Conversations, MCP, and Inference tabs

import { useState } from 'react';
import { ConversationSidebar } from './ConversationSidebar';
import { MCPTab } from './MCPTab';
import { InferenceTab } from './InferenceTab';

type TabType = 'mcp' | 'conversations' | 'inference';

export function TabbedSidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('mcp');

  const tabs = [
    { id: 'mcp' as const, label: 'MCP', icon: '🔧' },
    { id: 'conversations' as const, label: 'Conversations', icon: '💬' },
    { id: 'inference' as const, label: 'Inference', icon: '🤖' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Headers */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'mcp' && <MCPTab />}
        {activeTab === 'conversations' && <ConversationSidebar />}
        {activeTab === 'inference' && <InferenceTab />}
      </div>
    </div>
  );
}