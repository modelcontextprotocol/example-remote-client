// Agent loop hook with MCP and test tool integration

import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AgentLoopConfig,
  AgentLoopState,
  UseAgentLoopReturn,
  ConversationMessage,
  Conversation,
  ToolResultBlock,
  TestTool,
} from '@/types/conversation';
import type { ChatMessage, Tool, ToolCall, InferenceRequest } from '@/types/inference';
import { useInference } from '@/contexts/InferenceContext';
import { useMCP } from '@/contexts/MCPContext';
import { normalizeServerName } from '@/utils/mcpUtils';

// Test tools that work alongside MCP tools
const testTools: TestTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
        },
        required: ['location'],
      },
    },
    execute: async (args) => {
      // Mock weather data
      const weather = {
        location: args.location,
        temperature: Math.floor(Math.random() * 30) + 10,
        condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 40) + 30,
      };
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return weather;
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current date and time',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., "UTC", "America/New_York")',
          },
        },
      },
    },
    execute: async (args) => {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short',
      };

      if (args.timezone) {
        options.timeZone = args.timezone;
      }

      return {
        timestamp: new Date().toISOString(),
        formatted: new Date().toLocaleString('en-US', options),
        timezone: args.timezone || 'local',
      };
    },
  },
];

const DEFAULT_CONFIG: AgentLoopConfig = {
  maxIterations: 10,
  systemMessage: 'You are a helpful assistant with access to various tools. Use them when needed to answer questions accurately.',
  temperature: 0.7,
  stopOnError: false,
};

export function useAgentLoop(config: Partial<AgentLoopConfig> = {}): UseAgentLoopReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { provider: currentProvider, isAuthenticated, generateResponse } = useInference();
  const { getAllTools, callTool: callMCPTool, connections } = useMCP();
  
  // Track running loops
  const loopStates = useRef<Map<string, AgentLoopState>>(new Map());

  // Helper: Convert conversation messages to inference format
  const toInferenceMessages = useCallback((messages: ConversationMessage[]): ChatMessage[] => {
    return messages.map(msg => {
      // Convert content blocks back to the inference format
      if (msg.content.length === 1 && msg.content[0].type === 'text') {
        // Simple text message
        return {
          role: msg.role,
          content: msg.content[0].text,
        };
      }

      // Complex message with tool calls/results - reconstruct the format
      let content = '';
      const toolCalls: ToolCall[] = [];
      let toolCallId: string | undefined;

      for (const block of msg.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: block.input,
            },
          });
        } else if (block.type === 'tool_result') {
          toolCallId = block.tool_use_id;
          // For tool result messages, content comes from the tool result
          if (typeof block.content === 'string') {
            content = block.content;
          } else if (Array.isArray(block.content)) {
            content = block.content.map(c => c.text || c.error || '').join('');
          }
        }
      }

      return {
        role: msg.role,
        content: content || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        toolCallId,
      };
    });
  }, []);

  // Helper: Create conversation message from inference response
  const fromInferenceResponse = useCallback((response: ChatMessage): ConversationMessage => {
    const content: any[] = [];
    
    // Add text content if present
    if (typeof response.content === 'string' && response.content) {
      content.push({
        type: 'text',
        text: response.content,
      });
    }

    // Add tool calls if present
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    return {
      id: uuidv4(),
      role: response.role,
      content,
      timestamp: new Date(),
      toolCalls: response.toolCalls,
      toolCallId: response.toolCallId,
    };
  }, []);

  // Helper: Execute a tool call
  const executeTool = useCallback(async (toolCall: ToolCall): Promise<{ result: any; error?: string }> => {
    try {
      // Check if it's a test tool
      const testTool = testTools.find(t => t.function.name === toolCall.function.name);
      if (testTool) {
        const result = await testTool.execute(toolCall.function.arguments);
        return { result };
      }

      // Check if it's an MCP tool (prefixed with server name using double underscore)
      if (toolCall.function.name.includes('__')) {
        // Extract normalized server name from tool name (format: "normalized_server__tool_name")
        const [normalizedServerName] = toolCall.function.name.split('__');
        
        // Find the connection ID by comparing normalized server names
        const connection = connections.find(conn => {
          return normalizeServerName(conn.name) === normalizedServerName;
        });
        
        if (connection) {
          const result = await callMCPTool(connection.id, toolCall.function.name, toolCall.function.arguments);
          return { result };
        } else {
          throw new Error(`MCP server with normalized name "${normalizedServerName}" not found or not connected`);
        }
      }

      throw new Error(`Unknown tool: ${toolCall.function.name}`);
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }, [getAllTools, callMCPTool, connections]);

  // Main agent loop execution - processes the conversation and generates responses with tool calls
  const executeAgentLoop = useCallback(async (
    conversation: Conversation,
    onUpdate: (conversation: Conversation) => void
  ) => {
    if (!isAuthenticated || !currentProvider) {
      throw new Error('No authenticated inference provider available');
    }

    const conversationId = conversation.id;

    // Initialize loop state
    const abortController = new AbortController();
    const loopState: AgentLoopState = {
      isRunning: true,
      conversationId,
      currentStep: 'inference',
      iteration: 0,
      maxIterations: finalConfig.maxIterations,
      abortController,
    };

    loopStates.current.set(conversationId, loopState);

    try {
      let currentConversation = { ...conversation };
      
      for (let iteration = 0; iteration < finalConfig.maxIterations; iteration++) {
        if (abortController.signal.aborted) {
          break;
        }

        loopState.iteration = iteration;
        loopState.currentStep = 'inference';

        // Convert to inference format and add system message if needed
        const inferenceMessages = toInferenceMessages(currentConversation.messages);
        if (finalConfig.systemMessage && (inferenceMessages.length === 0 || inferenceMessages[0].role !== 'system')) {
          inferenceMessages.unshift({
            role: 'system',
            content: finalConfig.systemMessage,
          });
        }

        // Get available tools (test tools + MCP tools)
        const allTools: Tool[] = [
          ...testTools.map(t => ({ type: t.type, function: t.function })),
          ...getAllTools(),
        ];

        // Make inference request
        const request: InferenceRequest = {
          messages: inferenceMessages,
          tools: allTools.length > 0 ? allTools : undefined,
          temperature: finalConfig.temperature,
        };

        const response = await generateResponse(request);

        if (abortController.signal.aborted) {
          break;
        }

        // Add assistant response to conversation
        const assistantMessage = fromInferenceResponse(response.message);
        
        currentConversation = {
          ...currentConversation,
          messages: [...currentConversation.messages, assistantMessage],
          updatedAt: new Date(),
          status: response.message.toolCalls ? 'calling_tools' : 'idle',
        };
        
        onUpdate(currentConversation);

        // Check if we have tool calls to execute
        if (!response.message.toolCalls || response.message.toolCalls.length === 0) {
          // No tool calls, we're done
          break;
        }

        // Execute tool calls
        loopState.currentStep = 'tool_execution';
        currentConversation.status = 'calling_tools';
        onUpdate(currentConversation);

        const toolResults: ToolResultBlock[] = [];

        for (const toolCall of response.message.toolCalls) {
          if (abortController.signal.aborted) {
            break;
          }

          const { result, error } = await executeTool(toolCall);
          
          const toolResult: ToolResultBlock = {
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: error 
              ? [{ type: 'error', error }]
              : [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            is_error: !!error,
          };

          toolResults.push(toolResult);
        }

        // Add tool results as separate messages
        const toolResultMessages: ConversationMessage[] = toolResults.map(result => ({
          id: uuidv4(),
          role: 'tool' as const,
          content: [result],
          timestamp: new Date(),
          toolCallId: result.tool_use_id,
        }));

        currentConversation = {
          ...currentConversation,
          messages: [...currentConversation.messages, ...toolResultMessages],
          status: 'thinking',
          updatedAt: new Date(),
        };

        onUpdate(currentConversation);

        // Continue the loop to process tool results
      }

      // Mark as complete
      loopState.currentStep = 'complete';
      loopState.isRunning = false;
      
      if (currentConversation) {
        currentConversation.status = 'idle';
        onUpdate(currentConversation);
      }

    } catch (error) {
      loopState.error = error instanceof Error ? error.message : 'Agent loop failed';
      loopState.isRunning = false;
      
      if (finalConfig.stopOnError) {
        throw error;
      }
    } finally {
      loopStates.current.delete(conversationId);
    }
  }, [isAuthenticated, currentProvider, finalConfig, toInferenceMessages, fromInferenceResponse, getAllTools, executeTool]);

  const stopLoop = useCallback((conversationId: string) => {
    const loopState = loopStates.current.get(conversationId);
    if (loopState?.abortController) {
      loopState.abortController.abort();
      loopState.isRunning = false;
    }
  }, []);

  const getLoopState = useCallback((conversationId: string): AgentLoopState | undefined => {
    return loopStates.current.get(conversationId);
  }, []);

  return {
    executeAgentLoop,
    stopLoop,
    getLoopState,
  };
}