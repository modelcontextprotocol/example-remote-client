# Security Design Document: MCP Remote Client

## Executive Summary

The MCP Remote Client is an example open-source web application that demonstrates how to build a client for the Model Context Protocol (MCP). It is designed as a standalone, statically-served application without a backend server, intended for educational and reference purposes rather than production use. The application enables users to connect to MCP servers and inference providers (like OpenRouter) to interact with AI models and tools.

## Application Architecture

### Deployment Model
- **Static Web Application**: Deployed as static HTML/JS/CSS files
- **No Backend Server**: All processing occurs client-side in the browser
- **No Data Exfiltration**: No user data is sent to external analytics or backend services
- **Local-First Design**: All data persistence uses browser localStorage

### Core Components

1. **MCP Connection Manager**: Handles connections to MCP servers via SSE or HTTP streaming
2. **Inference Provider System**: Manages connections to AI inference services (OpenRouter)
3. **Conversation Manager**: Stores and manages conversation history locally
4. **OAuth Manager**: Handles OAuth 2.0 + PKCE flows for authentication

## Authentication and Authorization

### OAuth 2.0 Implementation

#### MCP Server Authentication
- **OAuth 2.0 with PKCE**: Implements authorization code flow with Proof Key for Code Exchange
- **State Parameter**: Includes connection ID prefix (`mcp:${connectionId}`) for callback routing
- **Code Verifier**: Generated using crypto.getRandomValues() with SHA-256 challenge
- **Token Storage**: Access tokens stored in localStorage at `mcp_oauth_tokens_${connectionId}`
- **Client Registration**: OAuth client information cached per server URL to minimize re-registration

#### Inference Provider Authentication
- **Dual Authentication**: Supports both API keys and OAuth flows
- **OpenRouter OAuth**: Similar PKCE implementation with `inference:` state prefix
- **Token Persistence**: Tokens stored in localStorage with automatic loading on app start
- **No Refresh Tokens**: Current implementation does not support token refresh

### API Key Management
- **Local Storage**: API keys stored in browser localStorage
- **No Transmission**: Keys are never sent to third-party services beyond the intended providers
- **User-Controlled**: Users manually input and manage their API keys

## Data Storage and Privacy

### Storage Architecture
- **localStorage**: Primary persistence mechanism for all application data
- **No Encryption**: Data stored in plaintext (security trade-off for example application)
- **Browser Sandbox**: Relies on browser same-origin policy for isolation

### Data Types Stored
1. **Conversation History**: Complete message history including AI responses
2. **OAuth Tokens**: Access tokens for MCP servers and inference providers
3. **API Keys**: User-provided API keys for inference services
4. **Connection Configurations**: MCP server URLs and settings
5. **OAuth Client Registrations**: Cached OAuth client credentials

## External Service Integration

### MCP Server Connections
- **Transport Methods**: SSE (Server-Sent Events) and Streamable HTTP
- **CORS Dependency**: Requires proper CORS headers from MCP servers
- **Connection Isolation**: Each server connection runs independently
- **Error Handling**: Fallback from HTTP streaming to SSE on connection failure

### Inference Provider Integration
- **OpenRouter**: Primary supported provider with OAuth and API key authentication
- **Tool Calling**: Native support for function/tool calling with parameter validation
- **Message Format**: Standard OpenAI-compatible message format

## Security Controls

### Input Validation
- **URL Validation**: MCP server URLs validated before connection attempts
- **Tool Parameter Validation**: Function parameters validated against defined schemas
- **Message Sanitization**: React's built-in XSS protection for rendering

### OAuth Security
- **PKCE Implementation**: Proper code verifier/challenge generation
- **State Validation**: State parameter checked for OAuth callback verification
- **Popup Windows**: OAuth flows use popup windows to maintain app state
- **Origin Checking**: postMessage origin validation for popup communication

### Transport Security
- **HTTPS Enforcement**: Relies on browser security for HTTPS connections
- **No Certificate Pinning**: Standard browser certificate validation
- **WebSocket Security**: Uses secure WebSocket connections for SSE

## Known Security Considerations

### Client-Side Storage Risks
- **localStorage Exposure**: All data accessible to JavaScript code
- **XSS Vulnerability**: Stored tokens/keys exposed if XSS attack succeeds
- **No Encryption**: Sensitive data stored in plaintext

### Authentication Risks
- **Token Persistence**: No automatic token expiration or rotation
- **Public Client**: OAuth uses public client flow (no client secret)
- **Popup Blocking**: OAuth flow fails if popups are blocked

### Code Execution Risks
- **eval() Usage**: Mathematical expression evaluation uses eval() with regex filtering
- **Tool Execution**: Executes tools based on MCP server responses
- **No Sandboxing**: Tool responses rendered directly in UI

## Security Boundaries

### Trust Boundaries
1. **Browser Sandbox**: Primary security boundary
2. **Same-Origin Policy**: Prevents cross-origin data access
3. **User Consent**: Users explicitly add MCP servers and API keys

### Data Flow
```
User Input -> React App -> localStorage
           -> OAuth Provider -> External Service
           -> MCP Server -> Tool Execution
```

## Incident Response Considerations

### Logging and Monitoring
- **Console Logging**: Errors logged to browser console
- **No Audit Trail**: No persistent security event logging
- **User-Visible Errors**: Error messages displayed directly to users

### Data Cleanup
- **Manual Cleanup**: Users must manually clear localStorage
- **Logout Function**: Clears authentication tokens but not conversation history
- **No Automatic Expiry**: Data persists indefinitely

## Compliance and Privacy

### Data Residency
- **Client-Side Only**: All data remains in user's browser
- **No Data Collection**: No analytics or telemetry
- **User Control**: Full user control over data persistence

### GDPR Considerations
- **No Personal Data Processing**: Application doesn't process data server-side
- **Right to Erasure**: Users can clear localStorage at any time
- **Data Portability**: Conversations stored in standard JSON format

## Security Recommendations for Production Use

While this is an example application not intended for production, organizations adapting this code should consider:

1. **Encrypt localStorage**: Implement client-side encryption for sensitive data
2. **Replace eval()**: Use a safe expression parser library
3. **Add CSP Headers**: Implement Content Security Policy
4. **Token Rotation**: Implement automatic token refresh and rotation
5. **Audit Logging**: Add security event logging
6. **Input Sanitization**: Additional validation beyond React defaults
7. **Rate Limiting**: Prevent abuse of OAuth flows
8. **Secure Token Storage**: Consider Web Crypto API for token encryption

## Conclusion

The MCP Remote Client demonstrates a functional implementation of the Model Context Protocol with OAuth authentication and local data persistence. As an example application, it prioritizes simplicity and clarity over production-grade security controls. The local-first architecture eliminates many traditional web application security concerns but introduces client-side storage risks that users should understand.