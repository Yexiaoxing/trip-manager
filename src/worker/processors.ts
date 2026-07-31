import { Worker } from "bullmq";
import { prisma } from "@/src/lib/prisma";
import { childLogger } from "@/src/lib/logger";
import { drainLocalQueue, type LocalQueueName } from "@/src/lib/local_queue";
import { calendarQueue, connection, notificationQueue, useLocalQueue } from "@/src/lib/queue";
import { extractTripFromEmail } from "@/src/integrations/openai_extractor";
import { sendTelegramToApprovedChats } from "@/src/integrations/telegram";
import { syncCalendarItem } from "@/src/integrations/google_calendar";
import { applyExtraction } from "@/src/services/trip_extraction";
import { createEmailProcessedNotification } from "@/src/services/notifications";

const localQueueNames: LocalQueueName[] = ["email", "notification", "reminder", "calendar"];
const log = childLogger({ module: "worker" });

export async function processEmailJob(data: { emailId: string }) {
  log.info({ emailId: data.emailId }, "Email processing started");
  const email = await prisma.emailArtifact.update({
    where: { id: data.emailId },
    data: { status: "PROCESSING" },
  });
  try {
    const result = await extractTripFromEmail({
      subject: email.subject,
      fromAddress: email.fromAddress,
      text: email.textPreview || "",
    });
    const applied = await applyExtraction(data.emailId, result);
    const notification = await createEmailProcessedNotification({ emailId: data.emailId, status: applied.status });
    await notificationQueue.add("send-telegram-notification", { notificationId: notification.id });

    for (const item of applied.items) {
      await calendarQueue.add("sync-calendar-item", { itemId: item.id });
    }

    log.info(
      { emailId: data.emailId, tripId: applied.trip?.id || null, itemCount: applied.items.length, status: applied.status },
      "Email processing completed",
    );
    return { tripId: applied.trip?.id || null, itemCount: applied.items.length, status: applied.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ emailId: data.emailId, error: message }, "Email processing failed");
    await prisma.emailArtifact.update({
      where: { id: data.emailId },
      data: { status: "FAILED", error: message },
    });
    const notification = await createEmailProcessedNotification({ emailId: data.emailId, status: "FAILED" });
    await notificationQueue.add("send-telegram-notification", { notificationId: notification.id });
    throw error;
  }
}

export async function processNotificationJob(data: { notificationId: string }) {
  log.info({ notificationId: data.notificationId }, "Notification sending started");
  const notification = await prisma.notification.findUnique({ where: { id: data.notificationId } });
  if (!notification) {
    log.info({ notificationId: data.notificationId, reason: "missing" }, "Notification skipped");
    return { skipped: "missing notification" };
  }
  try {
    const result = await sendTelegramToApprovedChats(notification.message);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: result.skipped ? "SKIPPED" : "SENT", sentAt: result.skipped ? null : new Date() },
    });
    log.info(
      { notificationId: notification.id, status: result.skipped ? "SKIPPED" : "SENT", sent: result.sent },
      "Notification completed",
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ notificationId: notification.id, error: message }, "Notification failed");
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED", error: message },
    });
    throw error;
  }
}

export async function processReminderJob() {
  log.info("Reminder dispatch started");
  const due = await prisma.reminder.findMany({
    where: { sentAt: null, remindAt: { lte: new Date() } },
    include: { item: { include: { trip: true } } },
    take: 50,
  });
  for (const reminder of due) {
    const notification = await prisma.notification.create({
      data: {
        type: "REMINDER",
        message: `Reminder: ${reminder.item.trip.title}\n${reminder.item.title}`,
      },
    });
    await notificationQueue.add("send-telegram-notification", { notificationId: notification.id });
    await prisma.reminder.update({ where: { id: reminder.id }, data: { sentAt: new Date() } });
  }
  log.info({ count: due.length }, "Reminder dispatch completed");
  return { count: due.length };
}

export function startWorkers() {
  if (useLocalQueue) {
    log.info("Starting local queue workers");
    startLocalQueueWorkers();
    return [];
  }

  if (!connection) throw new Error("Redis connection is required when REDIS_URL is not mock");
  log.info("Starting BullMQ workers");

  const workers = [
    new Worker(
      "email",
      async (job) => {
        if (job.name === "process-email") {
          return processEmailJob(job.data as { emailId: string });
        }
      },
      { connection },
    ),
    new Worker(
      "notification",
      async (job) => processNotificationJob(job.data as { notificationId: string }),
      { connection },
    ),
    new Worker(
      "reminder",
      async () => processReminderJob(),
      { connection },
    ),
    new Worker(
      "calendar",
      async (job) => syncCalendarItem((job.data as { itemId: string }).itemId),
      { connection },
    ),
  ];

  for (const worker of workers) {
    worker.on("ready", () => log.info({ queue: worker.name }, "BullMQ worker ready"));
    worker.on("active", (job) => log.info({ queue: worker.name, job: job.name, jobId: job.id }, "BullMQ job active"));
    worker.on("completed", (job) => log.info({ queue: worker.name, job: job.name, jobId: job.id }, "BullMQ job completed"));
    worker.on("failed", (job, error) => {
      log.error({ queue: worker.name, job: job?.name || "unknown", jobId: job?.id || "unknown", error: error.message }, "BullMQ job failed");
    });
    worker.on("error", (error) => log.error({ queue: worker.name, error: error.message }, "BullMQ worker error"));
  }

  return workers;
}

function startLocalQueueWorkers() {
  const processQueue = async (queue: LocalQueueName) => {
    await drainLocalQueue(queue, async (job) => {
      if (queue === "email" && job.name === "process-email") {
        return processEmailJob(job.data as { emailId: string });
      }
      if (queue === "notification" && job.name === "send-telegram-notification") {
        return processNotificationJob(job.data as { notificationId: string });
      }
      if (queue === "reminder" && job.name === "dispatch-due-reminders") {
        return processReminderJob();
      }
      if (queue === "calendar" && job.name === "sync-calendar-item") {
        return syncCalendarItem((job.data as { itemId: string }).itemId);
      }
      throw new Error(`Unknown local queue job: ${queue}/${job.name}`);
    });
  };

  setInterval(() => {
    void Promise.all(localQueueNames.map(processQueue));
  }, 1000);

  void Promise.all(localQueueNames.map(processQueue));
}

export async function scheduleRepeatingJobs() {
  return undefined;
}
