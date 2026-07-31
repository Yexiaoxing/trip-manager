import { prisma } from "./prisma";
import { childLogger } from "./logger";

export type LocalQueueName = "email" | "notification" | "reminder" | "calendar";

export type LocalQueueProcessor = (job: { id: string; name: string; data: unknown }) => Promise<unknown>;
const log = childLogger({ module: "local_queue" });

export class LocalQueue {
  constructor(private readonly queue: LocalQueueName) {}

  async add(name: string, data: unknown) {
    const job = await prisma.localQueueJob.create({
      data: {
        queue: this.queue,
        name,
        data: JSON.stringify(data),
      },
    });
    log.info({ queue: this.queue, job: name, jobId: job.id }, "Local queue job enqueued");
    return job;
  }
}

export async function drainLocalQueue(queue: LocalQueueName, processor: LocalQueueProcessor) {
  let processed = 0;

  while (true) {
    const nextJob = await prisma.localQueueJob.findFirst({
      where: { queue, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    if (!nextJob) return processed;

    const claimed = await prisma.localQueueJob.updateMany({
      where: { id: nextJob.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      log.info({ queue, job: nextJob.name, jobId: nextJob.id }, "Local queue job started");
      await processor({
        id: nextJob.id,
        name: nextJob.name,
        data: JSON.parse(nextJob.data),
      });
      await prisma.localQueueJob.update({
        where: { id: nextJob.id },
        data: { status: "COMPLETED", processedAt: new Date(), error: null },
      });
      log.info({ queue, job: nextJob.name, jobId: nextJob.id }, "Local queue job completed");
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.localQueueJob.update({
        where: { id: nextJob.id },
        data: { status: "FAILED", error: message, processedAt: new Date() },
      });
      log.error({ queue, job: nextJob.name, jobId: nextJob.id, error: message }, "Local queue job failed");
    }
  }
}
