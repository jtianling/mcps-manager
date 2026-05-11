import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { paths } from "./paths.js";

export interface BundleInfo {
  readonly url: string;
  readonly members: readonly string[];
  readonly selectionMode: "all";
  readonly installedAt: string;
  readonly updatedAt: string;
}

export interface BundleUpsertInfo {
  readonly url: string;
  readonly members: readonly string[];
  readonly selectionMode: "all";
}

export interface BundlesDocument {
  readonly version: "1";
  readonly bundles: Readonly<Record<string, BundleInfo>>;
}

export async function readBundles(): Promise<BundlesDocument> {
  if (!existsSync(paths.bundlesFile)) {
    return { version: "1", bundles: {} };
  }

  const raw = await readFile(paths.bundlesFile, "utf-8");
  try {
    const parsed = JSON.parse(raw) as BundlesDocument;
    if (parsed.version !== "1" || typeof parsed.bundles !== "object") {
      throw new Error("invalid bundles.json structure");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse bundles.json. Delete or repair ${paths.bundlesFile}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function readBundle(id: string): Promise<BundleInfo | undefined> {
  const doc = await readBundles();
  return doc.bundles[id];
}

export async function upsertBundle(
  id: string,
  info: BundleUpsertInfo,
): Promise<void> {
  const doc = await readBundles();
  const now = new Date().toISOString();
  const existing = doc.bundles[id];
  await writeBundles({
    version: "1",
    bundles: {
      ...doc.bundles,
      [id]: {
        url: info.url,
        members: [...info.members],
        selectionMode: info.selectionMode,
        installedAt: existing?.installedAt ?? now,
        updatedAt: now,
      },
    },
  });
}

export async function removeMember(
  id: string,
  serverName: string,
): Promise<void> {
  const doc = await readBundles();
  const existing = doc.bundles[id];
  if (!existing) return;

  const members = existing.members.filter((member) => member !== serverName);
  const bundles = { ...doc.bundles };
  if (members.length === 0) {
    delete bundles[id];
  } else {
    bundles[id] = {
      ...existing,
      members,
      updatedAt: new Date().toISOString(),
    };
  }
  await writeBundles({ version: "1", bundles });
}

async function writeBundles(doc: BundlesDocument): Promise<void> {
  if (!existsSync(paths.baseDir)) {
    await mkdir(paths.baseDir, { recursive: true });
    await chmod(paths.baseDir, 0o700);
  }

  const tmpFile = `${paths.bundlesFile}.${process.pid}.${Date.now()}.${randomBytes(4).toString("hex")}.tmp`;
  await mkdir(dirname(paths.bundlesFile), { recursive: true });
  await writeFile(tmpFile, JSON.stringify(doc, null, 2), "utf-8");
  await rename(tmpFile, paths.bundlesFile);
  await chmod(paths.bundlesFile, 0o600);
}
