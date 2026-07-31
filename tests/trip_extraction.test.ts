import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyExtraction } from "@/src/services/trip_extraction";

const tx = {
  trip: { create: vi.fn(), findMany: vi.fn() },
  extractionRun: { create: vi.fn() },
  itineraryItem: { create: vi.fn() },
  extractionRunItem: { create: vi.fn() },
  reminder: { create: vi.fn() },
  emailArtifact: { update: vi.fn() },
};

vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn((callback) => callback(tx)),
  },
}));

describe("applyExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.extractionRun.create.mockResolvedValue({ id: "run-1" });
    tx.trip.findMany.mockResolvedValue([]);
    tx.trip.create.mockResolvedValue({ id: "trip-1", title: "Tokyo" });
    tx.itineraryItem.create.mockResolvedValue({ id: "item-1", type: "HOTEL", startsAt: null });
    tx.emailArtifact.update.mockResolvedValue({ id: "email-1" });
  });

  it("does not create a trip when extraction needs review", async () => {
    const result = await applyExtraction("email-1", {
      trip: { title: "Unknown booking" },
      confidence: 0.2,
      reviewRequired: true,
      items: [{ type: "GENERIC_BOOKING", title: "Unknown", confidence: 0.2 }],
      notes: "Missing dates",
    });

    expect(tx.trip.create).not.toHaveBeenCalled();
    expect(tx.itineraryItem.create).not.toHaveBeenCalled();
    expect(tx.emailArtifact.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { status: "NEEDS_REVIEW", tripId: null, error: "Missing dates" },
    });
    expect(result).toMatchObject({ trip: null, items: [], status: "NEEDS_REVIEW" });
  });

  it("creates trip and items for confident extraction", async () => {
    const result = await applyExtraction("email-1", {
      trip: { title: "Tokyo", destination: "Tokyo" },
      confidence: 0.9,
      reviewRequired: false,
      items: [{ type: "HOTEL", title: "Hotel", confidence: 0.9 }],
    });

    expect(tx.trip.create).toHaveBeenCalledOnce();
    expect(tx.itineraryItem.create).toHaveBeenCalledOnce();
    expect(tx.emailArtifact.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { status: "COMPLETED", tripId: "trip-1", error: undefined },
    });
    expect(result).toMatchObject({ trip: { id: "trip-1" }, status: "COMPLETED" });
  });

  it("links confident extraction to a matching existing trip", async () => {
    tx.trip.findMany.mockResolvedValue([
      {
        id: "existing-trip",
        title: "Tokyo summer trip",
        destination: "Tokyo",
        startsAt: new Date("2026-08-13T16:00:00.000Z"),
        endsAt: new Date("2026-08-20T15:59:59.999Z"),
      },
    ]);

    const result = await applyExtraction("email-1", {
      trip: {
        title: "Tokyo hotel",
        destination: "Tokyo",
        startsAt: "2026-08-14T00:00:00.000Z",
        endsAt: "2026-08-16T23:59:59.999Z",
      },
      confidence: 0.9,
      reviewRequired: false,
      items: [{ type: "HOTEL", title: "Hotel", confidence: 0.9 }],
    });

    expect(tx.trip.create).not.toHaveBeenCalled();
    expect(tx.itineraryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tripId: "existing-trip" }),
    });
    expect(tx.emailArtifact.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { status: "COMPLETED", tripId: "existing-trip", error: undefined },
    });
    expect(result).toMatchObject({ trip: { id: "existing-trip" }, status: "COMPLETED" });
  });
});
