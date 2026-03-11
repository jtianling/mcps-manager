import type { GlobalConfig } from "../types.js";
import { fetchWebContent } from "./web-reader.js";
import { ANALYSIS_SYSTEM_PROMPT } from "./system-prompt.js";

interface GlmMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | null;
  readonly tool_calls?: readonly GlmToolCall[];
  readonly tool_call_id?: string;
}

interface GlmToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

interface GlmResponse {
  readonly choices: readonly {
    readonly message: GlmMessage;
    readonly finish_reason: string;
  }[];
}

const WEB_READER_TOOL = {
  type: "function" as const,
  function: {
    name: "webReader",
    description: "Fetch and read the content of a web page given its URL",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL of the web page to read",
        },
      },
      required: ["url"],
    },
  },
};

export interface AnalysisResult {
  readonly name: string;
  readonly default: {
    readonly transport: "stdio" | "http";
    readonly command?: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly url?: string;
    readonly headers?: Readonly<Record<string, string>>;
  };
  readonly overrides: Readonly<Record<string, unknown>>;
  readonly requiredEnvVars: readonly string[];
}

async function callGlm(
  config: GlobalConfig,
  messages: GlmMessage[],
): Promise<GlmResponse> {
  const response = await fetch(config.glm.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.glm.apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-5",
      messages,
      tools: [WEB_READER_TOOL],
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `GLM5 API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as GlmResponse;
}

export async function analyzeWithGlm(
  config: GlobalConfig,
  userMessage: string,
): Promise<AnalysisResult> {
  const messages: GlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const MAX_ROUNDS = 10;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await callGlm(config, messages);
    const choice = response.choices.at(0);
    if (!choice) {
      throw new Error("GLM5 returned empty response");
    }

    const assistantMessage = choice.message;
    messages.push({
      role: "assistant",
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return parseAnalysisResult(assistantMessage.content ?? "");
    }

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.function.name === "webReader") {
        const args = JSON.parse(toolCall.function.arguments) as {
          url: string;
        };
        let toolResult: string;
        try {
          toolResult = await fetchWebContent(config, args.url);
        } catch (error) {
          toolResult = `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`;
        }
        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: toolCall.id,
        });
      }
    }
  }

  throw new Error("GLM5 analysis exceeded maximum rounds");
}

function parseAnalysisResult(content: string): AnalysisResult {
  const cleaned = content
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Cannot extract JSON from GLM5 response: ${cleaned.slice(0, 200)}`);
  }

  const result = JSON.parse(jsonMatch[0]) as AnalysisResult;
  if (!result.name || !result.default) {
    throw new Error("Invalid analysis result: missing name or default config");
  }

  return result;
}

export function buildUserMessage(input: string): string {
  if (isGitHubRepo(input)) {
    const url = `https://github.com/${input}`;
    return `Please analyze the MCP server at ${url}. Start by reading the README at ${url}/blob/main/README.md`;
  }
  return `Please analyze the MCP server documentation at: ${input}`;
}

export function isGitHubRepo(input: string): boolean {
  if (input.startsWith("http") || input.startsWith("@")) {
    return false;
  }
  const parts = input.split("/");
  return parts.length === 2 && parts.every((p) => p.length > 0);
}

export function isValidInput(
  input: string,
): { valid: true } | { valid: false; reason: string } {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return { valid: true };
  }
  if (isGitHubRepo(input)) {
    return { valid: true };
  }
  return {
    valid: false,
    reason:
      'Invalid input format. Provide a URL (https://...) or GitHub owner/repo (e.g., "anthropics/mcp-brave-search")',
  };
}
