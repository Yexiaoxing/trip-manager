import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import { LocalQueue, type LocalQueueName } from "./local_queue";

export const useLocalQueue = env.REDIS_URL === "mock";

export const connection = useLocalQueue
  ? null
  : new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

function createQueue(queue: LocalQueueName) {
  if (useLocalQueue) return new LocalQueue(queue);
  if (!connection) throw new Error("Redis connection is required when REDIS_URL is not mock");
  return new Queue(queue, { connection });
}

export const emailQueue = createQueue("email");
export const notificationQueue = createQueue("notification");
export const reminderQueue = createQueue("reminder");
export const calendarQueue = createQueue("calendar");

export type EmailJobName = "process-email";
export type NotificationJobName = "send-telegram-notification";
export type ReminderJobName = "dispatch-due-reminders";
export type CalendarJobName = "sync-calendar-item";
