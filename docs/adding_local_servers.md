# Adding In-Memory MCP Servers

This guide explains how to add in-memory MCP servers that run within the browser, using the InMemoryTransport from the MCP SDK.

## Overview

In-memory servers are useful for:
- Testing MCP functionality without external servers
- Providing demo capabilities
- Development and debugging
- Offline functionality

These servers run in the same JavaScript process as the client and communicate via the InMemoryTransport, eliminating network overhead and CORS issues.

## Creating an In-Memory Server

### 1. Create Your Server Implementation

Create a new file in `src/mcp/servers/your-server/index.ts`:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

export function createServer() {
    // Create an MCP server instance
    const server = new Server({
        name: "your-server-name",
        version: "1.0.0"
    }, {
        capabilities: {
            tools: {}  // Enable tools capability
        }
    });

    // Register tools using the McpFunction helper
    server.tool(
        "tool_name",
        "Tool description",
        {
            // Zod schema for input validation
            param1: z.string().describe("Parameter description"),
            param2: z.number().optional()
        },
        async ({ param1, param2 }) => {
            // Tool implementation
            return {
                content: [{ 
                    type: "text", 
                    text: `Result: ${param1}` 
                }]
            };
        }
    );

    return server;
}
```

### 2. Register Your Server

Add your server to the available servers list in `src/mcp/servers/index.ts`:

```typescript
import { createServer as createTestServer } from "./test";
import { createServer as createYourServer } from "./your-server";
import type { MCPServerConfig } from "@/types/mcp";

export const availableServers: MCPServerConfig[] = [
    {
        name: "In-Memory Test Server",
        url: "local",
        localServer: createTestServer
    },
    {
        name: "Your Server Name",
        url: "local",
        localServer: createYourServer
    }
];
```

## Server Implementation Details

### Tool Registration

The MCP SDK provides a convenient `tool()` method for registering tools:

```typescript
server.tool(
    "tool_name",           // Tool identifier
    "Tool description",    // Human-readable description
    {                      // Zod schema for parameters
        param: z.string()
    },
    async (args) => {      // Implementation function
        // Tool logic here
        return {
            content: [{
                type: "text",
                text: "Result"
            }]
        };
    }
);
```

### Available Content Types

Tools can return different content types:

```typescript
// Text content
return {
    content: [{
        type: "text",
        text: "Hello, world!"
    }]
};

// Error content
return {
    content: [{
        type: "text",
        text: "Error: Something went wrong"
    }],
    isError: true
};

// Multiple content blocks
return {
    content: [
        { type: "text", text: "Line 1" },
        { type: "text", text: "Line 2" }
    ]
};
```

### Resources and Prompts

You can also implement resources and prompts:

```typescript
// Resources
server.resource(
    "resource_uri",
    "Resource name",
    "Resource description",
    async () => ({
        content: [{
            type: "text",
            text: "Resource content"
        }]
    })
);

// Prompts
server.prompt(
    "prompt_name",
    "Prompt description",
    {
        param: z.string()
    },
    async ({ param }) => ({
        messages: [{
            role: "user",
            content: { type: "text", text: `Prompt with ${param}` }
        }]
    })
);
```

## Best Practices

1. **Naming**: Use descriptive names for your servers and tools
2. **Error Handling**: Always handle errors gracefully and return meaningful error messages
3. **Validation**: Use Zod schemas to validate input parameters
4. **Documentation**: Include clear descriptions for tools and parameters
5. **Testing**: Test your server implementation before adding it to the production list

## Example: Calculator Server

Here's a complete example of a calculator server:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";

export function createServer() {
    const server = new Server({
        name: "calculator",
        version: "1.0.0"
    }, {
        capabilities: {
            tools: {}
        }
    });

    server.tool(
        "add",
        "Add two numbers",
        {
            a: z.number().describe("First number"),
            b: z.number().describe("Second number")
        },
        async ({ a, b }) => ({
            content: [{
                type: "text",
                text: `${a} + ${b} = ${a + b}`
            }]
        })
    );

    server.tool(
        "multiply",
        "Multiply two numbers",
        {
            a: z.number().describe("First number"),
            b: z.number().describe("Second number")
        },
        async ({ a, b }) => ({
            content: [{
                type: "text",
                text: `${a} × ${b} = ${a * b}`
            }]
        })
    );

    return server;
}
```

## Debugging

In-memory servers will automatically connect when the application starts. You can see their status in the MCP tab of the UI, where they'll be marked with an "In-Memory" badge.

To debug your server:
1. Check the browser console for connection errors
2. Use the MCP message monitor to see tool calls and responses
3. Add console.log statements in your tool implementations

## Limitations

- In-memory servers are cleared when the page refreshes
- They cannot persist data between sessions
- They run in the browser's JavaScript environment, so they cannot access filesystem or system resources
- Performance is limited by the browser's capabilities

For production use cases requiring persistence or system access, use external MCP servers instead.