import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";

export function sha256(input: Buffer | string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function writeArtifact(relativePath: string, content: Buffer | string) {
  const fullPath = path.join(env.STORAGE_DIR, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content);
  return fullPath;
}

export function artifactPath(...parts: string[]) {
  return path.join(env.STORAGE_DIR, ...parts);
}
