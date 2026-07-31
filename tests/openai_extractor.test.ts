import { describe, expect, it } from "vitest";
import { normalizeExtractionResult } from "@/src/integrations/openai_extractor";

describe("normalizeExtractionResult", () => {
  it("normalizes trip dates to full day boundaries", () => {
    const result = normalizeExtractionResult({
      trip: {
        title: "Hotel stay",
        startsAt: "2026-08-14T14:00:00+08:00",
        endsAt: "2026-08-16T12:00:00+08:00",
      },
      confidence: 0.9,
      reviewRequired: false,
      items: [
        {
          type: "HOTEL",
          title: "Hotel",
          startsAt: "2026-08-14T14:00:00+08:00",
          endsAt: "2026-08-16T12:00:00+08:00",
          confidence: 0.9,
        },
      ],
    });

    expect(result.trip.startsAt).toBe("2026-08-13T16:00:00.000Z");
    expect(result.trip.endsAt).toBe("2026-08-16T15:59:59.999Z");
    expect(result.items[0].startsAt).toBe("2026-08-14T06:00:00.000Z");
    expect(result.items[0].endsAt).toBe("2026-08-16T04:00:00.000Z");
    expect(result.reviewRequired).toBe(false);
  });

  it("marks extraction for review when model returns invalid date strings", () => {
    const result = normalizeExtractionResult({
      trip: {
        title: "Paris booking",
        startsAt: "tomorrow morning",
        endsAt: "not sure",
      },
      confidence: 0.9,
      reviewRequired: false,
      items: [
        {
          type: "HOTEL",
          title: "Hotel",
          startsAt: "2026/07/23",
          endsAt: "checkout someday",
          confidence: 0.9,
        },
      ],
    });

    expect(result.reviewRequired).toBe(true);
    expect(result.trip.startsAt).toBeUndefined();
    expect(result.trip.endsAt).toBeUndefined();
    expect(result.items[0].startsAt).toBe(new Date("2026/07/23").toISOString());
    expect(result.items[0].endsAt).toBeUndefined();
    expect(result.notes).toContain("invalid");
  });
});
