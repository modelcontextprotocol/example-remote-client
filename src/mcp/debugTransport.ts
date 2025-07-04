import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.d.ts";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";


/**
 * Debug transport for MCP that logs messages to the console.
 * This is useful for debugging purposes and does not implement any actual transport logic.
 */
export class DebugTransport implements Transport {

    // Allow observability of the transport lifecycle
    onclose_?: () => void;
    onerror_?: (error: Error) => void;
    onreceivemessage_?: (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void;
    onsendmessage_?: (message: JSONRPCMessage, options?: TransportSendOptions) => Promise<void>;

    private innerTransport: Transport;
    constructor(innerTransport: Transport) {
        this.innerTransport = innerTransport;
        this.innerTransport.onclose = () => {
            if (this.onclose_) {
                this.onclose_();
            }
            if (this.onclose) {
                this.onclose();
            }
        };
        this.innerTransport.onerror = (error: Error) => {
            if (this.onerror_) {
                this.onerror_(error);
            }
            if (this.onerror) {
                this.onerror(error);
            }
        }
        this.innerTransport.onmessage = (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => {
            if (this.onreceivemessage_) {
                this.onreceivemessage_(message, extra);
            }
            if (this.onmessage) {
                this.onmessage(message, extra);
            }
        }
    }
    async start(): Promise<void> {
        await this.innerTransport.start();
    }
    async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
        if (this.onsendmessage_) {
            await this.onsendmessage_(message, options);
        }
        await this.innerTransport.send(message, options);
    }
    async close(): Promise<void> {
        await this.innerTransport.close();
    }

    // These are taken over by the MCP client
    onclose?: () => void;
    onerror?: (error: Error) => void;
    onmessage?: (message: JSONRPCMessage, extra?: { authInfo?: AuthInfo }) => void;
}