import { describe, expect, it } from "vitest";
import { defaultReminderTimes } from "@/src/services/reminders";

describe("defaultReminderTimes", () => {
  it("creates flight reminders 24h and 3h before departure", () => {
    const startsAt = new Date("2026-08-10T12:00:00.000Z");
    const reminders = defaultReminderTimes({ type: "FLIGHT", startsAt });

    expect(reminders.map((date) => date.toISOString())).toEqual([
      "2026-08-09T12:00:00.000Z",
      "2026-08-10T09:00:00.000Z",
    ]);
  });

  it("returns no reminders when an item has no start date", () => {
    expect(defaultReminderTimes({ type: "HOTEL", startsAt: null })).toEqual([]);
  });
});
