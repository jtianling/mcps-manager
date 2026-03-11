import { homedir } from "node:os";
import { join } from "node:path";

const BASE_DIR = join(homedir(), ".mcps-manager");

export const paths = {
  baseDir: BASE_DIR,
  serversDir: join(BASE_DIR, "servers"),
  configFile: join(BASE_DIR, "config.json"),
  serverFile: (name: string): string => join(BASE_DIR, "servers", `${name}.json`),
} as const;
