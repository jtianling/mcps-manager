import type { ServerDefinition } from "../types.js";
import { removeMember } from "../utils/bundle-store.js";
import {
  readServerDefinition,
  removeServerDefinition,
  serverExists,
} from "../utils/server-store.js";

export interface UninstallDeps {
  readonly serverExists: (name: string) => boolean;
  readonly readServerDefinition: (
    name: string,
  ) => Promise<ServerDefinition | undefined>;
  readonly removeServerDefinition: (name: string) => Promise<boolean>;
  readonly removeMember: (bundleId: string, serverName: string) => Promise<void>;
  readonly print: (line: string) => void;
  readonly error: (line: string) => void;
  readonly setExitCode: (code: number) => void;
}

export async function uninstallCommand(name: string): Promise<void> {
  await runUninstall(name, {
    serverExists,
    readServerDefinition,
    removeServerDefinition,
    removeMember,
    print: (line) => console.log(line),
    error: (line) => console.error(line),
    setExitCode: (code) => {
      process.exitCode = code;
    },
  });
}

export async function runUninstall(
  name: string,
  deps: UninstallDeps,
): Promise<void> {
  if (!deps.serverExists(name)) {
    deps.error(`Error: Server "${name}" does not exist in central repository.`);
    deps.setExitCode(1);
    return;
  }

  const definition = await deps.readServerDefinition(name);
  await deps.removeServerDefinition(name);
  if (definition?.bundleId) {
    await deps.removeMember(definition.bundleId, name);
  }
  deps.print(`Server "${name}" removed from central repository.`);
}
