import "@/src/lib/load_env";

async function main() {
  const [{ startTelegramPolling }, { env }, { logger }, { useLocalQueue }, { scheduleRepeatingJobs, startWorkers }] = await Promise.all([
    import("@/src/integrations/telegram"),
    import("@/src/lib/env"),
    import("@/src/lib/logger"),
    import("@/src/lib/queue"),
    import("./processors"),
  ]);

  logger.info({ queue: useLocalQueue ? "local" : "redis", databaseUrl: env.DATABASE_URL }, "Worker booting");
  startWorkers();
  await scheduleRepeatingJobs();
  logger.info({ enabled: Boolean(env.TELEGRAM_BOT_TOKEN) }, "Telegram polling status");
  await startTelegramPolling();
  logger.info({ openaiBaseUrl: env.OPENAI_BASE_URL }, "Trip manager worker started");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
