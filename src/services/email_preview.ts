import { readFile } from "node:fs/promises";
import { simpleParser } from "mailparser";

export async function parseStoredEmail(rawPath: string) {
  const raw = await readFile(rawPath).catch(() => null);
  if (!raw) {
    return {
      html: undefined,
      text: "",
      hasHtml: false,
      missing: true,
    };
  }

  const parsed = await simpleParser(raw);
  const html = typeof parsed.html === "string" ? parsed.html : undefined;
  const text = parsed.text || "";

  return {
    html,
    text,
    hasHtml: Boolean(html?.trim()),
    missing: false,
  };
}
