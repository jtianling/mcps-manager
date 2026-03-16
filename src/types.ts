export interface StdioConfig {
  readonly transport: "stdio";
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export interface HttpConfig {
  readonly transport: "http";
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

export type DefaultConfig = StdioConfig | HttpConfig;

export type AgentId =
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "opencode"
  | "antigravity"
  | "openclaw";

export interface ServerDefinition {
  readonly name: string;
  readonly source: string;
  readonly default: DefaultConfig;
  readonly overrides: Readonly<Partial<Record<AgentId, Partial<DefaultConfig>>>>;
}

export interface GlobalConfig {
  readonly glm: {
    readonly apiKey: string;
    readonly endpoint: string;
  };
  readonly webReader: {
    readonly apiKey: string;
    readonly url: string;
  };
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  readonly configPath: (projectDir: string) => string;
  readonly isGlobal: boolean;
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
