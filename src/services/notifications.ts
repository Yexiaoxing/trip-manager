import { prisma } from "@/src/lib/prisma";
import { notification_type, processing_status, type ProcessingStatus } from "@/src/types/domain";

export async function createEmailProcessedNotification(input: {
  emailId: string;
  status: ProcessingStatus;
}) {
  const email = await prisma.emailArtifact.findUnique({
    where: { id: input.emailId },
    include: {
      trip: { include: { items: { orderBy: { startsAt: "asc" } } } },
      extractionRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!email) throw new Error(`Email ${input.emailId} not found`);

  const trip = email.trip;
  const type =
    input.status === processing_status.COMPLETED
      ? notification_type.EMAIL_PROCESSED
      : input.status === processing_status.NEEDS_REVIEW
        ? notification_type.EMAIL_REVIEW_REQUIRED
        : notification_type.EMAIL_FAILED;

  const itemLines = trip?.items.slice(0, 6).map((item) => {
    const when = item.startsAt ? item.startsAt.toISOString().slice(0, 16).replace("T", " ") : "date unknown";
    return `- ${item.type}: ${item.title} (${when})`;
  });

  const message = [
    input.status === processing_status.COMPLETED ? "Email processed" : "Email needs review",
    `Subject: ${email.subject || "(no subject)"}`,
    `From: ${email.fromAddress || "unknown"}`,
    trip ? `Trip: ${trip.title}` : "Trip: not created",
    itemLines?.length ? `Items:\n${itemLines.join("\n")}` : "Items: none",
    email.error ? `Note: ${email.error}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");

  return prisma.notification.create({
    data: {
      type,
      status: "PENDING",
      emailId: email.id,
      message,
    },
  });
}
