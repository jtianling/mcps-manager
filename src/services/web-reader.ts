import type { GlobalConfig } from "../types.js";

interface McpResponse {
  readonly jsonrpc: string;
  readonly id: number;
  readonly result?: {
    readonly content?: readonly { readonly type: string; readonly text: string }[];
    readonly isError?: boolean;
  };
  readonly error?: { readonly code: number; readonly message: string };
}

function parseSseResponse(raw: string): McpResponse {
  const lines = raw.split("\n");
  for (const line of lines) {
    if (line.startsWith("data:")) {
      return JSON.parse(line.slice(5)) as McpResponse;
    }
  }
  return JSON.parse(raw) as McpResponse;
}

async function mcpInitialize(
  endpoint: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "mcpsmgr", version: "0.1.0" },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `MCP initialize failed: ${response.status} ${response.statusText}`,
    );
  }

  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) {
    throw new Error("MCP server did not return session ID");
  }

  return sessionId;
}

async function mcpToolCall(
  endpoint: string,
  apiKey: string,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${apiKey}`,
      "Mcp-Session-Id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `MCP tools/call failed: ${response.status} ${response.statusText}`,
    );
  }

  const raw = await response.text();
  const parsed = parseSseResponse(raw);

  if (parsed.error) {
    throw new Error(`MCP error: ${parsed.error.message}`);
  }

  const contents = parsed.result?.content ?? [];
  const full = contents.map((c) => c.text).join("\n");
  const MAX_CONTENT_LENGTH = 30000;
  if (full.length > MAX_CONTENT_LENGTH) {
    return full.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated]";
  }
  return full;
}

let cachedSessionId: string | undefined;

export async function fetchWebContent(
  config: GlobalConfig,
  url: string,
): Promise<string> {
  const endpoint = config.webReader.url;
  const apiKey = config.webReader.apiKey;

  if (!cachedSessionId) {
    cachedSessionId = await mcpInitialize(endpoint, apiKey);
  }

  try {
    return await mcpToolCall(endpoint, apiKey, cachedSessionId, "webReader", {
      url,
      timeout: 20,
    });
  } catch {
    cachedSessionId = await mcpInitialize(endpoint, apiKey);
    return await mcpToolCall(endpoint, apiKey, cachedSessionId, "webReader", {
      url,
      timeout: 20,
    });
  }
}
