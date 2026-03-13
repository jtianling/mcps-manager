const ENV_VAR_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*=/;

export function buildEnvArgs(
  env: Readonly<Record<string, string>>,
): string[] {
  return Object.entries(env).map(([key, value]) => `${key}=${value}`);
}

export function parseEnvArgs(args: readonly string[]): {
  readonly env: Record<string, string>;
  readonly commandIndex: number;
} {
  const env: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (ENV_VAR_PATTERN.test(args[i])) {
      const eqIndex = args[i].indexOf("=");
      env[args[i].slice(0, eqIndex)] = args[i].slice(eqIndex + 1);
    } else {
      return { env, commandIndex: i };
    }
  }
  return { env, commandIndex: args.length };
}

export function resolveEnvInArgs(
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): {
  readonly resolvedArgs: string[];
  readonly remainingEnv: Record<string, string>;
} {
  const substitutedKeys = new Set<string>();
  const resolvedArgs = args.map((arg) =>
    arg.replace(/\$\{([^}]+)\}/g, (match, varName: string) => {
      if (varName in env) {
        substitutedKeys.add(varName);
        return env[varName];
      }
      return match;
    }),
  );

  const remainingEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!substitutedKeys.has(key)) {
      remainingEnv[key] = value;
    }
  }

  return { resolvedArgs, remainingEnv };
}
