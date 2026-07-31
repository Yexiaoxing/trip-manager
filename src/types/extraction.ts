import { z } from "zod";

export const extractedItemSchema = z.object({
  type: z.enum(["FLIGHT", "HOTEL", "TRANSPORT", "ACTIVITY", "DINING", "GENERIC_BOOKING", "NOTE"]),
  title: z.string().min(1),
  provider: z.string().optional(),
  confirmation: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  timezone: z.string().optional(),
  locationName: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const extractionResultSchema = z.object({
  trip: z.object({
    title: z.string().min(1),
    destination: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  }),
  confidence: z.number().min(0).max(1).default(0.5),
  reviewRequired: z.boolean().default(false),
  items: z.array(extractedItemSchema).default([]),
  notes: z.string().optional(),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;
