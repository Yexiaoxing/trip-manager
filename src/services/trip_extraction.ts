import { prisma } from "@/src/lib/prisma";
import { env } from "@/src/lib/env";
import { childLogger } from "@/src/lib/logger";
import type { ExtractionResult } from "@/src/types/extraction";
import { processing_status, serialize_json, type ItemType } from "@/src/types/domain";
import { defaultReminderTimes } from "./reminders";

const AUTO_CREATE_CONFIDENCE = 0.72;
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const log = childLogger({ module: "trip_extraction" });

export async function applyExtraction(emailId: string, result: ExtractionResult) {
  const status =
    result.reviewRequired || result.confidence < AUTO_CREATE_CONFIDENCE
      ? processing_status.NEEDS_REVIEW
      : processing_status.COMPLETED;

  return prisma.$transaction(async (tx) => {
    const run = await tx.extractionRun.create({
      data: {
        emailId,
        model: env.OPENAI_MODEL,
        status,
        confidence: result.confidence,
        result: serialize_json(result),
        completedAt: new Date(),
      },
    });

    if (status === processing_status.NEEDS_REVIEW) {
      await tx.emailArtifact.update({
        where: { id: emailId },
        data: { status, tripId: null, error: reviewNote(result) },
      });

      return { trip: null, run, items: [], status };
    }

    const tripStartsAt = parseDate(result.trip.startsAt);
    const tripEndsAt = parseDate(result.trip.endsAt);
    const match = await findMatchingTrip(tx, {
      title: result.trip.title,
      destination: result.trip.destination,
      startsAt: tripStartsAt,
      endsAt: tripEndsAt,
    });
    const trip =
      match?.trip ??
      (await tx.trip.create({
        data: {
          title: result.trip.title,
          destination: result.trip.destination,
          startsAt: tripStartsAt,
          endsAt: tripEndsAt,
          status: "BOOKED",
        },
      }));

    if (match) {
      log.info({ emailId, tripId: trip.id, score: match.score, title: trip.title }, "Matched extracted email to existing trip");
    } else {
      log.info({ emailId, tripId: trip.id, title: trip.title }, "Created trip from extracted email");
    }

    const createdItems = [];
    for (const extracted of result.items) {
      const item = await tx.itineraryItem.create({
        data: {
          tripId: trip.id,
          type: extracted.type as ItemType,
          title: extracted.title,
          provider: extracted.provider,
          confirmation: extracted.confirmation,
          startsAt: parseDate(extracted.startsAt),
          endsAt: parseDate(extracted.endsAt),
          timezone: extracted.timezone,
          locationName: extracted.locationName,
          address: extracted.address,
          notes: extracted.notes,
          raw: serialize_json(extracted),
        },
      });

      await tx.extractionRunItem.create({
        data: {
          extractionRunId: run.id,
          itemId: item.id,
          action: "created",
          confidence: extracted.confidence,
        },
      });

      for (const remindAt of defaultReminderTimes({ type: item.type as ItemType, startsAt: item.startsAt })) {
        if (remindAt > new Date()) {
          await tx.reminder.create({ data: { itemId: item.id, remindAt } });
        }
      }

      createdItems.push(item);
    }

    await tx.emailArtifact.update({
      where: { id: emailId },
      data: { status, tripId: trip.id, error: result.notes },
    });

    return { trip, run, items: createdItems, status };
  });
}

function reviewNote(result: ExtractionResult) {
  return result.notes || "Extraction needs manual review before creating a trip.";
}

async function findMatchingTrip(
  tx: TransactionClient,
  extracted: { title: string; destination?: string; startsAt?: Date; endsAt?: Date },
) {
  const candidates = await tx.trip.findMany({
    where: { status: { not: "CANCELLED" } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const ranked = candidates
    .map((trip) => ({ trip, score: scoreTripMatch(trip, extracted) }))
    .sort((a, b) => b.score - a.score);

  log.info(
    {
      candidateCount: ranked.length,
      extractedTitle: extracted.title,
      extractedDestination: extracted.destination,
      extractedStart: extracted.startsAt?.toISOString(),
    },
    "Scored candidate trips for extracted email",
  );
  for (const candidate of ranked.slice(0, 5)) {
    log.info({ tripId: candidate.trip.id, score: candidate.score, title: candidate.trip.title }, "Trip match candidate score");
  }

  const best = ranked[0];
  return best && best.score >= 4 ? best : null;
}

function scoreTripMatch(
  trip: { title: string; destination: string | null; startsAt: Date | null; endsAt: Date | null },
  extracted: { title: string; destination?: string; startsAt?: Date; endsAt?: Date },
) {
  let score = 0;

  if (datesOverlap(trip.startsAt, trip.endsAt, extracted.startsAt, extracted.endsAt)) {
    score += 4;
  }

  if (sameMeaningfulText(trip.destination, extracted.destination)) {
    score += 3;
  }

  if (tokenOverlapScore(trip.title, extracted.title) >= 0.5) {
    score += 2;
  }

  return score;
}

function datesOverlap(existingStart: Date | null, existingEnd: Date | null, extractedStart?: Date, extractedEnd?: Date) {
  if (!existingStart || !extractedStart) return false;
  const existingRangeEnd = existingEnd || existingStart;
  const extractedRangeEnd = extractedEnd || extractedStart;
  return existingStart <= extractedRangeEnd && extractedStart <= existingRangeEnd;
}

function sameMeaningfulText(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  return normalizeText(left) === normalizeText(right);
}

function tokenOverlapScore(left: string, right: string) {
  const leftTokens = new Set(normalizeText(left).split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(normalizeText(right).split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) matches += 1;
  }
  return matches / Math.min(leftTokens.size, rightTokens.size);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
