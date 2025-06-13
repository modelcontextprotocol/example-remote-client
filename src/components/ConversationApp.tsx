// Main conversation application with sidebar and chat interface

import { useState, useRef, useCallback } from 'react';
import { ConversationProvider } from '@/contexts/ConversationContext';
import { TabbedSidebar } from './TabbedSidebar';
import { ChatInterface } from './ChatInterface';

export function ConversationApp() {
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 240 && newWidth <= window.innerWidth * 0.8) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  return (
    <ConversationProvider>
      <div className="h-screen flex bg-gray-100 dark:bg-gray-900">
        {/* Left Sidebar - Tabbed Interface */}
        <div 
          className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col relative h-full"
          style={{ width: `${sidebarWidth}px` }}
        >
          <TabbedSidebar />
          
          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:bg-opacity-50 transition-colors"
            onMouseDown={handleMouseDown}
          />
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          <ChatInterface />
        </div>
      </div>
    </ConversationProvider>
  );
}