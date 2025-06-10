# MCP OAuth Implementation Guide

## Overview

This document explains how OAuth authentication is implemented for MCP servers in our client, including lessons learned from early implementation attempts.

## Final Working Implementation

### Architecture

The OAuth implementation uses the MCP TypeScript SDK's built-in auth system with a custom `OAuthClientProvider` that handles browser-based popup flows:

```typescript
class MCPOAuthProvider implements OAuthClientProvider {
  // Implements all required OAuth provider methods
  // Handles popup-based authorization flow
  // Manages client registration and token storage
}
```

### Key Components

1. **MCPOAuthProvider**: Implements the SDK's `OAuthClientProvider` interface
2. **Popup-based authorization**: Opens OAuth server in popup window
3. **Message passing**: Popup communicates auth code back to parent window
4. **Automatic retry**: Connection automatically retries after OAuth completion

### OAuth Flow

1. **Initial connection attempt**: Fails with `UnauthorizedError` (expected)
2. **SDK triggers OAuth**: Calls `redirectToAuthorization()` which opens popup
3. **User authorizes**: Completes OAuth flow in popup window
4. **Authorization code received**: Popup sends auth code to parent via `postMessage`
5. **Token exchange**: OAuth provider immediately calls SDK's `auth()` with the code
6. **Tokens stored**: SDK calls `saveTokens()` with access/refresh tokens
7. **Connection retry**: OAuth completion triggers automatic connection retry
8. **Success**: Connection succeeds with valid tokens

## What We Got Wrong Initially

### Mistake 1: Manual OAuth Flow Management

**Wrong approach**: We initially tried to manually manage the entire OAuth flow outside of the SDK:
- Manually opening authorization URLs
- Manually exchanging authorization codes for tokens
- Trying to inject tokens into the transport after the fact

**Why it was wrong**: The MCP SDK already has a complete OAuth implementation. Fighting against it created timing issues and complexity.

**Correct approach**: Implement the `OAuthClientProvider` interface and let the SDK handle the OAuth flow orchestration.

### Mistake 2: Waiting for Authorization in `redirectToAuthorization`

**Wrong approach**: Making `redirectToAuthorization()` wait for the popup to complete:
```typescript
async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
  const popup = window.open(authorizationUrl);
  // Wait for popup to complete and return auth code
  return new Promise((resolve, reject) => {
    // Listen for popup messages...
  });
}
```

**Why it was wrong**: The SDK's `auth()` function expects `redirectToAuthorization()` to return immediately after opening the authorization URL. The authorization code processing happens in a separate call.

**Correct approach**: Return immediately from `redirectToAuthorization()` and process the authorization code asynchronously when received from the popup.

### Mistake 3: Not Understanding the Two-Step OAuth Flow

**Wrong approach**: Thinking the SDK's `auth()` function is called once and handles everything.

**Why it was wrong**: The OAuth flow actually involves multiple interactions:
1. First call to `auth()`: Starts authorization flow, calls `redirectToAuthorization()`
2. User completes authorization in popup
3. Authorization code received via popup message
4. Second call to `auth()` with the authorization code: Exchanges code for tokens

**Correct approach**: Handle authorization code reception asynchronously and immediately call `auth()` again with the code to complete token exchange.

### Mistake 4: Wrong Error Handling Strategy

**Wrong approach**: Treating initial `UnauthorizedError` as a real failure and showing error alerts.

**Why it was wrong**: For OAuth servers, the initial connection attempt is *expected* to fail with `UnauthorizedError`. This triggers the OAuth flow.

**Correct approach**: Suppress `UnauthorizedError` for OAuth servers and let the OAuth flow handle authentication automatically.

## Key Implementation Details

### Client Registration Per Server

Client information is stored per server URL (not per connection) to avoid unnecessary re-registrations:
```typescript
// Generate consistent key for server
private getServerKey(): string {
  const url = new URL(this.serverUrl);
  return btoa(`${url.hostname}${url.pathname}`).replace(/[+/=]/g, '');
}
```

### Predictable Redirect URI

Uses a single redirect URI with state-based session identification:
- Redirect URI: `${origin}/oauth/mcp/callback`
- State parameter: `${connectionId}.${randomString}`

This avoids the "unregistered redirect_uri" error that occurs with dynamic URIs.

### Automatic Connection Retry

After OAuth completion, the connection automatically retries:
```typescript
private async handleOAuthSuccess(): Promise<void> {
  // Reset connection state and retry with new tokens
  this.connection.status = 'connecting';
  await this.connect();
}
```

## Best Practices Learned

1. **Follow the SDK patterns**: Don't fight against the SDK's built-in OAuth system
2. **Handle expected failures gracefully**: OAuth servers will return 401 on first connection
3. **Use consistent redirect URIs**: Avoid dynamic URIs that require pre-registration
4. **Store client info per server**: Minimize unnecessary client registrations
5. **Process auth codes immediately**: Don't store them for later processing
6. **Implement proper error suppression**: Distinguish between expected OAuth errors and real failures

## Future Improvements

- Add token refresh handling for long-lived connections
- Implement proper error recovery for failed OAuth flows
- Add support for different OAuth grant types (currently only authorization code)
- Consider adding OAuth scope configuration options