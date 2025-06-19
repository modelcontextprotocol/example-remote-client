import { createServer as createTestServer } from "./test";
import type { MCPServerConfig } from "@/types/mcp";

export const availableServers: MCPServerConfig[] = [
    {
        name: "In-Memory Test Server",
        url: "local",
        localServer: createTestServer
    }
];