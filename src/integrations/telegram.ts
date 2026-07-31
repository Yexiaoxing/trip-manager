import { Telegraf } from "telegraf";
import { allowedTelegramChatIds, env } from "@/src/lib/env";
import { prisma } from "@/src/lib/prisma";

export function telegramEnabled() {
  return Boolean(env.TELEGRAM_BOT_TOKEN);
}

export function createTelegramBot() {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  return new Telegraf(env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegramToApprovedChats(message: string) {
  const allowed = allowedTelegramChatIds();
  if (!env.TELEGRAM_BOT_TOKEN || allowed.size === 0) {
    return { sent: 0, skipped: true };
  }

  const bot = createTelegramBot();
  if (!bot) return { sent: 0, skipped: true };

  let sent = 0;
  for (const chatId of allowed) {
    await bot.telegram.sendMessage(chatId, message);
    await prisma.telegramChat.upsert({
      where: { chatId },
      create: { chatId, approved: true },
      update: { approved: true },
    });
    sent += 1;
  }
  return { sent, skipped: false };
}

export async function startTelegramPolling() {
  const bot = createTelegramBot();
  if (!bot) return;

  bot.start(async (ctx) => {
    const chatId = String(ctx.chat.id);
    const approved = allowedTelegramChatIds().has(chatId);
    await prisma.telegramChat.upsert({
      where: { chatId },
      create: { chatId, approved, label: ctx.from?.username },
      update: { approved, label: ctx.from?.username },
    });
    await ctx.reply(approved ? "Trip manager connected." : "Chat is not approved for this bot.");
  });

  bot.command("today", async (ctx) => {
    if (!allowedTelegramChatIds().has(String(ctx.chat.id))) return;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const items = await prisma.itineraryItem.findMany({
      where: { startsAt: { gte: now, lte: tomorrow } },
      include: { trip: true },
      orderBy: { startsAt: "asc" },
      take: 10,
    });
    await ctx.reply(
      items.length
        ? items.map((item) => `${item.trip.title}: ${item.title}`).join("\n")
        : "No itinerary items in the next 24 hours.",
    );
  });

  bot.command("next", async (ctx) => {
    if (!allowedTelegramChatIds().has(String(ctx.chat.id))) return;
    const item = await prisma.itineraryItem.findFirst({
      where: { startsAt: { gte: new Date() } },
      include: { trip: true },
      orderBy: { startsAt: "asc" },
    });
    await ctx.reply(item ? `${item.trip.title}: ${item.title}` : "No upcoming itinerary items.");
  });

  await bot.launch();
}
