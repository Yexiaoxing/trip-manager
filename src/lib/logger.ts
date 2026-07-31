import pino from "pino";

export const logger = pino({
  enabled: process.env.NODE_ENV !== "test",
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
