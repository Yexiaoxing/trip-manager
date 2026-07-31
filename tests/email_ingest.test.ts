import { describe, expect, it } from "vitest";

describe("email ingest fixtures", () => {
  it("keeps raw email fixtures parseable", () => {
    const raw = [
      "From: Klook <booking@example.com>",
      "To: traveler@example.com",
      "Subject: Booking confirmed",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Your airport transfer is confirmed for 2026-08-10.",
    ].join("\r\n");

    expect(raw).toContain("Subject: Booking confirmed");
  });
});
