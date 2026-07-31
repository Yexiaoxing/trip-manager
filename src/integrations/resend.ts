import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { env } from "@/src/lib/env";

export function create_resend_client() {
  return new Resend(env.RESEND_API_KEY || "re_undefined");
}

export function verify_resend_webhook(input: {
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return JSON.parse(input.body);
  }

  if (!input.id || !input.timestamp || !input.signature) {
    throw new Error("Missing Resend webhook signature headers");
  }

  const secret = env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, "");
  const secretBytes = Buffer.from(secret, "base64");
  const signedPayload = `${input.id}.${input.timestamp}.${input.body}`;
  const expected = createHmac("sha256", secretBytes).update(signedPayload).digest();

  const signatures = input.signature
    .split(" ")
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

  const valid = signatures.some((signature) => {
    const actual = Buffer.from(signature, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });

  if (!valid) {
    throw new Error("Invalid Resend webhook signature");
  }

  return JSON.parse(input.body);
}
