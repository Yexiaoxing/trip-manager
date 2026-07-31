import { auth, calendar, calendar_v3 } from "@googleapis/calendar";
import { env } from "@/src/lib/env";
import { prisma } from "@/src/lib/prisma";
import { deserialize_json } from "@/src/types/domain";

export async function syncCalendarItem(itemId: string) {
  const item = await prisma.itineraryItem.findUnique({ where: { id: itemId }, include: { trip: true } });
  if (!item || !item.startsAt || !env.GOOGLE_CALENDAR_ID) return { skipped: true };

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return { skipped: true, reason: "Google OAuth credentials are not configured" };
  }

  // Token storage and OAuth callback are intentionally represented in settings for v1.
  const tokenSetting = await prisma.appSetting.findUnique({ where: { key: "google_tokens" } });
  if (!tokenSetting) return { skipped: true, reason: "Google Calendar is not connected" };

  const oauth2Client = new auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
  oauth2Client.setCredentials(deserialize_json<object>(tokenSetting.value) || {});
  const calendarClient = calendar({ version: "v3", auth: oauth2Client });

  const body: calendar_v3.Schema$Event = {
    summary: `${item.trip.title}: ${item.title}`,
    location: item.address || item.locationName || undefined,
    description: item.notes || undefined,
    start: { dateTime: item.startsAt.toISOString(), timeZone: item.timezone || undefined },
    end: { dateTime: (item.endsAt || item.startsAt).toISOString(), timeZone: item.timezone || undefined },
  };

  const existing = await prisma.calendarSyncRecord.findUnique({ where: { itemId } });
  if (existing) {
    const updated = await calendarClient.events.update({
      calendarId: existing.googleCalendarId,
      eventId: existing.googleEventId,
      requestBody: body,
    });
    await prisma.calendarSyncRecord.update({ where: { id: existing.id }, data: { syncedAt: new Date(), lastError: null } });
    return { eventId: updated.data.id };
  }

  const created = await calendarClient.events.insert({
    calendarId: env.GOOGLE_CALENDAR_ID,
    requestBody: body,
  });

  if (created.data.id) {
    await prisma.calendarSyncRecord.create({
      data: {
        itemId,
        googleCalendarId: env.GOOGLE_CALENDAR_ID,
        googleEventId: created.data.id,
      },
    });
  }

  return { eventId: created.data.id };
}
