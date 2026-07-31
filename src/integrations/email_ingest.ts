import { simpleParser } from "mailparser";
import path from "node:path";
import { prisma } from "@/src/lib/prisma";
import { sha256, writeArtifact } from "@/src/lib/storage";

export async function ingestRawEmail(raw: Buffer | string) {
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const contentHash = sha256(buffer);
  const existing = await prisma.emailArtifact.findUnique({ where: { contentHash } });
  if (existing) {
    return { email: existing, duplicate: true };
  }

  const parsed = await simpleParser(buffer);
  const emailId = crypto.randomUUID();
  const rawPath = await writeArtifact(path.join("emails", `${emailId}.eml`), buffer);
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = parsed.text || html.replace(/<[^>]+>/g, " ") || "";

  const email = await prisma.emailArtifact.create({
    data: {
      id: emailId,
      messageId: parsed.messageId,
      contentHash,
      fromAddress: parsed.from?.text,
      subject: parsed.subject,
      receivedAt: parsed.date,
      rawPath,
      textPreview: text.slice(0, 2000),
      attachments: {
        create: await Promise.all(
          parsed.attachments.map(async (attachment, index) => {
            const filename = attachment.filename || `attachment-${index}`;
            const attachmentPath = await writeArtifact(
              path.join("attachments", emailId, filename),
              attachment.content,
            );
            return {
              filename,
              mimeType: attachment.contentType,
              path: attachmentPath,
              size: attachment.size,
            };
          }),
        ),
      },
    },
  });

  return { email, duplicate: false, text };
}

export async function ingestResendEmail(payload: unknown) {
  const event = normalizeResendPayload(payload);
  const raw = buildRawEmail(event);
  return ingestRawEmail(raw);
}

type NormalizedResendEmail = {
  messageId?: string;
  from?: string;
  to?: string[];
  subject?: string;
  text?: string;
  html?: string;
  createdAt?: string;
};

function normalizeResendPayload(payload: unknown): NormalizedResendEmail {
  const root = payload as Record<string, unknown>;
  const data = (root.data || root.email || root) as Record<string, unknown>;
  return {
    messageId: asString(data.message_id) || asString(data.messageId) || asString(data.id),
    from: asString(data.from) || asAddress(data.from_address),
    to: asStringArray(data.to),
    subject: asString(data.subject),
    text: asString(data.text) || asString(data.text_body),
    html: asString(data.html) || asString(data.html_body),
    createdAt: asString(data.created_at) || asString(data.createdAt),
  };
}

function buildRawEmail(email: NormalizedResendEmail) {
  const headers = [
    email.messageId ? `Message-ID: ${email.messageId}` : undefined,
    email.from ? `From: ${email.from}` : undefined,
    email.to?.length ? `To: ${email.to.join(", ")}` : undefined,
    email.subject ? `Subject: ${email.subject}` : undefined,
    email.createdAt ? `Date: ${new Date(email.createdAt).toUTCString()}` : undefined,
    "Content-Type: text/plain; charset=utf-8",
  ].filter(Boolean);
  const body = email.text || stripHtml(email.html || "") || "";
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asAddress(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const email = asString(record.email);
  const name = asString(record.name);
  return email && name ? `${name} <${email}>` : email;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item : asAddress(item))).filter(Boolean) as string[];
  }
  const stringValue = asString(value);
  return stringValue ? [stringValue] : undefined;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
