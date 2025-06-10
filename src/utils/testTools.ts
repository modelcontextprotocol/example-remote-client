// Test tools for validating tool calling functionality

import type { Tool } from '@/types/inference';

export const testTools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g. San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit to use',
            default: 'fahrenheit',
          },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_sum',
      description: 'Calculate the sum of two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'First number',
          },
          b: {
            type: 'number',
            description: 'Second number',
          },
        },
        required: ['a', 'b'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current time in a specific timezone',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'The timezone (e.g., America/New_York, Europe/London)',
            default: 'UTC',
          },
        },
        required: [],
      },
    },
  },
];

// Mock tool execution for testing
export function executeTestTool(toolName: string, args: Record<string, any>): string {
  switch (toolName) {
    case 'get_weather':
      return JSON.stringify({
        location: args.location,
        temperature: Math.floor(Math.random() * 30) + 10,
        unit: args.unit || 'fahrenheit',
        condition: ['sunny', 'cloudy', 'rainy', 'snowy'][Math.floor(Math.random() * 4)],
        humidity: Math.floor(Math.random() * 50) + 30,
      });

    case 'calculate_sum':
      const sum = (args.a || 0) + (args.b || 0);
      return JSON.stringify({
        a: args.a,
        b: args.b,
        sum,
        operation: `${args.a} + ${args.b} = ${sum}`,
      });

    case 'get_current_time':
      const now = new Date();
      const timezone = args.timezone || 'UTC';
      return JSON.stringify({
        timezone,
        current_time: now.toISOString(),
        unix_timestamp: Math.floor(now.getTime() / 1000),
        formatted: now.toLocaleString('en-US', { 
          timeZone: timezone === 'UTC' ? 'UTC' : timezone 
        }),
      });

    default:
      return JSON.stringify({
        error: `Unknown tool: ${toolName}`,
      });
  }
}