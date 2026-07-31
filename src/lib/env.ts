import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("file:./dev.db"),
  REDIS_URL: z.string().default("mock"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_DIR: z.string().default("./storage"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function allowedTelegramChatIds() {
  return new Set(
    env.TELEGRAM_ALLOWED_CHAT_IDS.split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
}
