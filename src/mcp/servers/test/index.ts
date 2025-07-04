import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";


export function createServer() {
    // Create an MCP server
    const server = new McpServer({
        name: "demo-server",
        version: "1.0.0"
    });

    // Add an addition tool
    server.registerTool("add",
        {
            description: "Add two numbers",
            inputSchema: { a: z.number(), b: z.number() },
        },
        async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }]
        })
    );
    return server;
}