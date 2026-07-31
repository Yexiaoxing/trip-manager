import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const loadedSymbol = Symbol.for("trip-manager.env.loaded");
const globalForEnv = globalThis as typeof globalThis & { [loadedSymbol]?: boolean };

if (!globalForEnv[loadedSymbol]) {
  for (const file of [".env.local", ".env"]) {
    loadEnvFile(path.join(process.cwd(), file));
  }
  globalForEnv[loadedSymbol] = true;
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    process.env[key] ??= value;
  }
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
  if (!match) return null;

  const [, key, rawValue] = match;
  return [key, parseEnvValue(rawValue)];
}

function parseEnvValue(rawValue: string) {
  const value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, "");
}
