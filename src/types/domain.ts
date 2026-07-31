export const processing_status = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  LINKED_MANUALLY: "LINKED_MANUALLY",
} as const;

export type ProcessingStatus = (typeof processing_status)[keyof typeof processing_status];

export const notification_type = {
  EMAIL_PROCESSED: "EMAIL_PROCESSED",
  EMAIL_REVIEW_REQUIRED: "EMAIL_REVIEW_REQUIRED",
  EMAIL_FAILED: "EMAIL_FAILED",
  REMINDER: "REMINDER",
  SYSTEM: "SYSTEM",
} as const;

export type NotificationType = (typeof notification_type)[keyof typeof notification_type];

export const item_type = {
  FLIGHT: "FLIGHT",
  HOTEL: "HOTEL",
  TRANSPORT: "TRANSPORT",
  ACTIVITY: "ACTIVITY",
  DINING: "DINING",
  GENERIC_BOOKING: "GENERIC_BOOKING",
  NOTE: "NOTE",
} as const;

export type ItemType = (typeof item_type)[keyof typeof item_type];

export const trip_status = {
  PLANNING: "PLANNING",
  BOOKED: "BOOKED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

export type TripStatus = (typeof trip_status)[keyof typeof trip_status];

export const itemTypeOptions = [
  { value: item_type.FLIGHT, label: "Flight" },
  { value: item_type.HOTEL, label: "Hotel" },
  { value: item_type.TRANSPORT, label: "Transport" },
  { value: item_type.ACTIVITY, label: "Activity/ticket" },
  { value: item_type.DINING, label: "Dining" },
  { value: item_type.GENERIC_BOOKING, label: "Generic booking" },
  { value: item_type.NOTE, label: "Note" },
] as const;

export const tripStatusOptions = [
  { value: trip_status.PLANNING, label: "Planning" },
  { value: trip_status.BOOKED, label: "Booked" },
  { value: trip_status.ACTIVE, label: "Active" },
  { value: trip_status.COMPLETED, label: "Completed" },
  { value: trip_status.CANCELLED, label: "Cancelled" },
] as const;

const tripStatusLabels: Record<string, string> = {
  PLANNING: "Planning",
  BOOKED: "Booked",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const itemTypeValues = new Set<string>(Object.values(item_type));
const tripStatusValues = new Set<string>(Object.values(trip_status));

const processingStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Processed",
  NEEDS_REVIEW: "Needs review",
  DUPLICATE: "Duplicate",
  FAILED: "Failed",
  LINKED_MANUALLY: "Linked manually",
};

const notificationStatusLabels: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

const notificationTypeLabels: Record<string, string> = {
  EMAIL_PROCESSED: "Email processed",
  EMAIL_REVIEW_REQUIRED: "Email needs review",
  EMAIL_FAILED: "Email failed",
  REMINDER: "Reminder",
  SYSTEM: "System",
};

const itemTypeLabels: Record<string, string> = {
  FLIGHT: "Flight",
  HOTEL: "Hotel",
  TRANSPORT: "Transport",
  ACTIVITY: "Activity/ticket",
  DINING: "Dining",
  GENERIC_BOOKING: "Generic booking",
  NOTE: "Note",
};

export function formatTripStatus(value: string | null | undefined) {
  return formatLabel(value, tripStatusLabels);
}

export function formatProcessingStatus(value: string | null | undefined) {
  return formatLabel(value, processingStatusLabels);
}

export function formatNotificationStatus(value: string | null | undefined) {
  return formatLabel(value, notificationStatusLabels);
}

export function formatNotificationType(value: string | null | undefined) {
  return formatLabel(value, notificationTypeLabels);
}

export function formatItemType(value: string | null | undefined) {
  return formatLabel(value, itemTypeLabels);
}

export function parseItemType(value: string | null | undefined): ItemType {
  return value && itemTypeValues.has(value) ? (value as ItemType) : item_type.GENERIC_BOOKING;
}

export function parseTripStatus(value: string | null | undefined): TripStatus {
  return value && tripStatusValues.has(value) ? (value as TripStatus) : trip_status.PLANNING;
}

function formatLabel(value: string | null | undefined, labels: Record<string, string>) {
  if (!value) return "Unknown";
  return labels[value] || value.toLowerCase().replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}

export function serialize_json(value: unknown) {
  return value === undefined ? undefined : JSON.stringify(value);
}

export function deserialize_json<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
