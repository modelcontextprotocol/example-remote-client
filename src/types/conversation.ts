// Conversation and agent loop types that extend existing inference types

import type { ChatMessage, ToolCall, Tool } from './inference';

// Extend ContentBlock to support tool use and tool result blocks
export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | { type: 'text' | 'image' | 'error'; text?: string; image?: string; error?: string }[];
  is_error?: boolean;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

// Union of all content block types
export type ConversationContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// Extend ChatMessage for conversation persistence with structured content
export interface ConversationMessage extends Omit<ChatMessage, 'content'> {
  id: string;
  content: ConversationContentBlock[];
  timestamp: Date;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  status: 'idle' | 'thinking' | 'calling_tools' | 'error';
  error?: string;
  // Track ongoing tool calls for UI display
  pendingToolCalls?: {
    id: string;
    name: string;
    input: Record<string, any>;
    startedAt: Date;
  }[];
}

export interface AgentLoopState {
  isRunning: boolean;
  conversationId: string;
  currentStep: 'inference' | 'tool_execution' | 'complete';
  iteration: number;
  maxIterations: number;
  error?: string;
  // AbortController for stopping the loop
  abortController?: AbortController;
}

export interface ConversationContextValue {
  // Conversation management
  conversations: Conversation[];
  activeConversationId?: string;
  agentLoopStates: Map<string, AgentLoopState>;
  
  // Conversation operations
  createConversation: (title?: string) => string; // Returns conversation ID
  deleteConversation: (conversationId: string) => void;
  setActiveConversation: (conversationId: string) => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
  getConversation: (conversationId: string) => Conversation | undefined;
  
  // Message operations
  addUserMessage: (conversationId: string, content: string) => void;
  
  // Agent loop operations
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  continueConversation: (conversationId: string) => Promise<void>; // Continue after tool calls or follow-ups
  stopAgentLoop: (conversationId: string) => void;
  getAgentLoopState: (conversationId: string) => AgentLoopState | undefined;
}

export interface AgentLoopConfig {
  maxIterations: number;
  systemMessage?: string;
  temperature?: number;
  stopOnError: boolean;
}

// Test tools that can be used alongside MCP tools
export interface TestTool extends Tool {
  execute: (args: Record<string, any>) => Promise<any>;
}

// Hook interface for the agent loop
export interface UseAgentLoopReturn {
  executeAgentLoop: (
    conversation: Conversation,
    onUpdate: (conversation: Conversation) => void
  ) => Promise<void>;
  stopLoop: (conversationId: string) => void;
  getLoopState: (conversationId: string) => AgentLoopState | undefined;
}

export type AgentLoopHook = (config?: Partial<AgentLoopConfig>) => UseAgentLoopReturn;

// Helper functions for converting between formats
export interface ConversationHelpers {
  // Convert conversation messages to inference messages
  toInferenceMessages: (messages: ConversationMessage[]) => ChatMessage[];
  
  // Convert inference response to conversation message
  fromInferenceResponse: (response: ChatMessage) => ConversationMessage;
  
  // Create tool use blocks from tool calls
  createToolUseBlocks: (toolCalls: ToolCall[]) => ToolUseBlock[];
  
  // Create tool result blocks from tool execution
  createToolResultBlocks: (results: { toolCallId: string; result: any; error?: string }[]) => ToolResultBlock[];
  
  // Generate conversation title from first message
  generateConversationTitle: (firstMessage: string) => string;
}