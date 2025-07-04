// Utility functions for MCP server name normalization

/**
 * Normalize server name to comply with OpenRouter API tool naming requirements
 * Pattern: ^[a-zA-Z0-9_-]{1,64}$
 */
export function normalizeServerName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // Replace invalid characters with underscore
    .replace(/_{2,}/g, '_')           // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '')          // Remove leading/trailing underscores
    .substring(0, 32)                 // Limit length to leave room for tool name
    || 'server';                      // Fallback if name becomes empty
}