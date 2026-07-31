import { addHours, addDays } from "date-fns";
import type { ItemType } from "@/src/types/domain";

export function defaultReminderTimes(item: { type: ItemType; startsAt: Date | null }) {
  if (!item.startsAt) return [];

  switch (item.type) {
    case "FLIGHT":
      return [addDays(item.startsAt, -1), addHours(item.startsAt, -3)];
    case "HOTEL":
      return [addDays(item.startsAt, -1), addHours(item.startsAt, -6)];
    case "ACTIVITY":
    case "TRANSPORT":
      return [addDays(item.startsAt, -1), addHours(item.startsAt, -2)];
    default:
      return [addDays(item.startsAt, -1)];
  }
}
