"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/prisma";
import { emailQueue } from "@/src/lib/queue";
import { ingestRawEmail } from "@/src/integrations/email_ingest";
import { parseItemType, parseTripStatus } from "@/src/types/domain";

export async function createTrip(formData: FormData) {
  const trip = await prisma.trip.create({
    data: {
      title: String(formData.get("title") || "Untitled trip"),
      destination: optionalString(formData.get("destination")),
      startsAt: optionalTripDate(formData.get("startsAt"), "start"),
      endsAt: optionalTripDate(formData.get("endsAt"), "end"),
      notes: optionalString(formData.get("notes")),
    },
  });
  revalidatePath("/");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, formData: FormData) {
  await prisma.trip.update({
    where: { id: tripId },
    data: {
      title: String(formData.get("title") || "Untitled trip"),
      destination: optionalString(formData.get("destination")),
      startsAt: optionalTripDate(formData.get("startsAt"), "start"),
      endsAt: optionalTripDate(formData.get("endsAt"), "end"),
      status: parseTripStatus(optionalString(formData.get("status"))),
      notes: optionalString(formData.get("notes")),
    },
  });
  revalidatePath("/");
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  await prisma.trip.delete({ where: { id: tripId } });
  revalidatePath("/");
  redirect("/");
}

export async function createItineraryItem(tripId: string, formData: FormData) {
  await prisma.itineraryItem.create({
    data: {
      tripId,
      type: parseItemType(optionalString(formData.get("type"))),
      title: String(formData.get("title") || "Untitled item"),
      provider: optionalString(formData.get("provider")),
      confirmation: optionalString(formData.get("confirmation")),
      startsAt: optionalDate(formData.get("startsAt")),
      endsAt: optionalDate(formData.get("endsAt")),
      locationName: optionalString(formData.get("locationName")),
      address: optionalString(formData.get("address")),
      notes: optionalString(formData.get("notes")),
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function updateItineraryItem(tripId: string, itemId: string, formData: FormData) {
  await prisma.itineraryItem.update({
    where: { id: itemId },
    data: {
      type: parseItemType(optionalString(formData.get("type"))),
      title: String(formData.get("title") || "Untitled item"),
      provider: optionalString(formData.get("provider")),
      confirmation: optionalString(formData.get("confirmation")),
      startsAt: optionalDate(formData.get("startsAt")),
      endsAt: optionalDate(formData.get("endsAt")),
      locationName: optionalString(formData.get("locationName")),
      address: optionalString(formData.get("address")),
      notes: optionalString(formData.get("notes")),
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function createReminder(tripId: string, formData: FormData) {
  const itemId = optionalString(formData.get("itemId"));
  const remindAt = optionalDate(formData.get("remindAt"));
  if (!itemId || !remindAt) return;

  const item = await prisma.itineraryItem.findFirst({ where: { id: itemId, tripId }, select: { id: true } });
  if (!item) return;

  await prisma.reminder.create({
    data: {
      itemId,
      remindAt,
      channel: optionalString(formData.get("channel")) || "telegram",
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function updateReminder(tripId: string, reminderId: string, formData: FormData) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, item: { tripId } },
    select: { id: true },
  });
  if (!reminder) return;

  await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      remindAt: optionalDate(formData.get("remindAt")) || undefined,
      channel: optionalString(formData.get("channel")) || "telegram",
    },
  });
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteReminder(tripId: string, reminderId: string) {
  const reminder = await prisma.reminder.findFirst({
    where: { id: reminderId, item: { tripId } },
    select: { id: true },
  });
  if (!reminder) return;

  await prisma.reminder.delete({ where: { id: reminderId } });
  revalidatePath(`/trips/${tripId}`);
}

export async function ingestEmailFromText(formData: FormData) {
  const rawEmail = String(formData.get("rawEmail") || "");
  if (!rawEmail.trim()) return;
  const result = await ingestRawEmail(rawEmail);
  if (!result.duplicate) {
    await emailQueue.add("process-email", { emailId: result.email.id });
  }
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function reprocessEmail(emailId: string) {
  const email = await prisma.emailArtifact.findUnique({ where: { id: emailId }, select: { status: true } });
  if (!email || email.status === "PENDING" || email.status === "PROCESSING") {
    return;
  }

  await prisma.emailArtifact.update({
    where: { id: emailId },
    data: { status: "PENDING", error: null },
  });
  await emailQueue.add("process-email", { emailId });
  revalidatePath(`/emails/${emailId}`);
  revalidatePath("/");
}

export async function linkEmailToTrip(emailId: string, formData: FormData) {
  const tripId = optionalString(formData.get("tripId"));
  if (!tripId) return;

  await prisma.emailArtifact.update({
    where: { id: emailId },
    data: { tripId, status: "LINKED_MANUALLY", error: null },
  });
  revalidatePath(`/emails/${emailId}`);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = typeof value === "string" ? value.trim() : "";
  return stringValue || undefined;
}

function optionalDate(value: FormDataEntryValue | null) {
  const stringValue = optionalString(value);
  if (!stringValue) return undefined;
  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function optionalTripDate(value: FormDataEntryValue | null, boundary: "start" | "end") {
  const stringValue = optionalString(value);
  if (!stringValue) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stringValue);
  if (!match) return optionalDate(value);

  const [, yearValue, monthValue, dayValue] = match;
  const date = new Date(
    Number(yearValue),
    Number(monthValue) - 1,
    Number(dayValue),
    boundary === "start" ? 0 : 23,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 59,
    boundary === "start" ? 0 : 999,
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
}
