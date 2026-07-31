import OpenAI from "openai";
import { env } from "@/src/lib/env";
import { extractionResultSchema, type ExtractionResult } from "@/src/types/extraction";

const systemPrompt = `Extract travel booking details from confirmation emails.
Return JSON only with this shape: trip { title, destination, startsAt, endsAt }, confidence, reviewRequired, items[].
Use ISO 8601 datetimes when dates are known. Supported item types are FLIGHT, HOTEL, TRANSPORT, ACTIVITY, DINING, GENERIC_BOOKING, NOTE.
Prefer GENERIC_BOOKING for OTA confirmations that do not fit a more specific type. Mark reviewRequired true if dates, traveler-relevant details, or the booking type are uncertain.`;

export async function extractTripFromEmail(input: {
  subject?: string | null;
  fromAddress?: string | null;
  text: string;
}): Promise<ExtractionResult> {
  if (!env.OPENAI_API_KEY) {
    return fallbackExtraction(input);
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const response = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          subject: input.subject,
          fromAddress: input.fromAddress,
          body: input.text.slice(0, 24000),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("Extractor returned an empty response");
  }

  return normalizeExtractionResult(extractionResultSchema.parse(JSON.parse(content)));
}

export function normalizeExtractionResult(result: ExtractionResult): ExtractionResult {
  const notes = [result.notes].filter(Boolean) as string[];
  let invalidDateFound = false;

  const tripStartsAt = normalizeTripDateString(result.trip.startsAt, "start");
  const tripEndsAt = normalizeTripDateString(result.trip.endsAt, "end");
  invalidDateFound ||= Boolean(result.trip.startsAt && !tripStartsAt);
  invalidDateFound ||= Boolean(result.trip.endsAt && !tripEndsAt);

  const items = result.items.map((item) => {
    const startsAt = normalizeDateString(item.startsAt);
    const endsAt = normalizeDateString(item.endsAt);
    invalidDateFound ||= Boolean(item.startsAt && !startsAt);
    invalidDateFound ||= Boolean(item.endsAt && !endsAt);
    return {
      ...item,
      startsAt,
      endsAt,
    };
  });

  if (invalidDateFound) {
    notes.push("Some extracted dates were invalid and need manual review.");
  }

  return {
    ...result,
    trip: {
      ...result.trip,
      startsAt: tripStartsAt,
      endsAt: tripEndsAt,
    },
    items,
    reviewRequired: result.reviewRequired || invalidDateFound,
    notes: notes.length ? notes.join(" ") : undefined,
  };
}

function normalizeDateString(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeTripDateString(value: string | undefined, boundary: "start" | "end") {
  if (!value) return undefined;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!dateMatch) return normalizeDateString(value);

  const [, yearValue, monthValue, dayValue] = dateMatch;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const time = boundary === "start" ? [0, 0, 0, 0] : [23, 59, 59, 999];
  const offsetMinutes = offsetMinutesFromDateString(value);

  if (offsetMinutes == null) {
    return new Date(year, month - 1, day, time[0], time[1], time[2], time[3]).toISOString();
  }

  const utcMs = Date.UTC(year, month - 1, day, time[0], time[1], time[2], time[3]) - offsetMinutes * 60_000;
  return new Date(utcMs).toISOString();
}

function offsetMinutesFromDateString(value: string) {
  if (value.endsWith("Z")) return 0;

  const match = /([+-])(\d{2}):?(\d{2})$/.exec(value);
  if (!match) return null;

  const [, sign, hours, minutes] = match;
  const offset = Number(hours) * 60 + Number(minutes);
  return sign === "+" ? offset : -offset;
}

function fallbackExtraction(input: {
  subject?: string | null;
  fromAddress?: string | null;
  text: string;
}): ExtractionResult {
  return {
    trip: {
      title: input.subject?.replace(/^fwd?:\s*/i, "") || "Unreviewed trip confirmation",
    },
    confidence: 0.2,
    reviewRequired: true,
    items: [
      {
        type: "GENERIC_BOOKING",
        title: input.subject || "Forwarded confirmation",
        provider: input.fromAddress || undefined,
        notes: input.text.slice(0, 1000),
        confidence: 0.2,
      },
    ],
    notes: "OPENAI_API_KEY is not configured; created a review item from email metadata.",
  };
}
