// Agents whose config layers merge per server key (Kimi Code) need a declared
// entry to mask an inherited one — omitting the server is not the same as
// switching it off. Adapters without the concept ignore this field.
export interface StdioConfig {
  readonly transport: "stdio";
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly enabled?: boolean;
}

export interface HttpConfig {
  readonly transport: "http";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly bearerTokenEnvVar?: string;
  readonly enabled?: boolean;
}

export type DefaultConfig = StdioConfig | HttpConfig;

export type AgentId =
  | "claude-code"
  | "codex"
  | "cursor"
  | "gemini-cli"
  | "opencode"
  | "antigravity"
  | "openclaw"
  | "hermes-agent"
  | "kimi-code";

export interface ServerDefinition {
  readonly name: string;
  readonly source: string;
  readonly repoName?: string;
  readonly bundleId?: string;
  readonly default: DefaultConfig;
  readonly overrides: Readonly<Partial<Record<AgentId, Partial<DefaultConfig>>>>;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  readonly configPath: (projectDir: string) => string;
  readonly isGlobal: boolean;
  readonly globalDir?: () => string;
  read(projectDir: string): Promise<Record<string, unknown>>;
  write(
    projectDir: string,
    serverName: string,
    config: DefaultConfig,
  ): Promise<void>;
  remove(projectDir: string, serverName: string): Promise<void>;
  has(projectDir: string, serverName: string): Promise<boolean>;
  toAgentFormat(config: DefaultConfig): Record<string, unknown>;
  fromAgentFormat(
    name: string,
    raw: Record<string, unknown>,
  ): DefaultConfig | undefined;
}
