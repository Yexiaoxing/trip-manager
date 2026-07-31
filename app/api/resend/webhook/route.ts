import { NextRequest, NextResponse } from "next/server";
import { emailQueue } from "@/src/lib/queue";
import { ingestResendEmail } from "@/src/integrations/email_ingest";
import { create_resend_client, verify_resend_webhook } from "@/src/integrations/resend";

export async function POST(request: NextRequest) {
  const body = await request.text();
  let payload: unknown;

  try {
    create_resend_client();
    payload = verify_resend_webhook({
      body,
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid webhook" },
      { status: 401 },
    );
  }

  const result = await ingestResendEmail(payload);
  if (!result.duplicate) {
    await emailQueue.add("process-email", { emailId: result.email.id });
  }

  return NextResponse.json({ ok: true, duplicate: result.duplicate, emailId: result.email.id });
}
