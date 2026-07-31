import { notFound } from "next/navigation";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { createItineraryItem, createReminder, deleteReminder, deleteTrip, updateItineraryItem, updateReminder, updateTrip } from "@/app/actions";
import { SubmitButton } from "@/src/components/submit_button";
import { prisma } from "@/src/lib/prisma";
import { base_styles } from "@/src/lib/styles";
import { formatItemType, formatProcessingStatus, formatTripStatus, itemTypeOptions, tripStatusOptions } from "@/src/types/domain";

export const dynamic = "force-dynamic";

type TripTab = "details" | "timeline" | "reminders" | "add-item" | "emails";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ editItem?: string; editReminder?: string; tab?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = normalizeTab(resolvedSearchParams?.tab);
  const editingItemId = resolvedSearchParams?.editItem;
  const editingReminderId = resolvedSearchParams?.editReminder;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      items: { orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }], include: { reminders: true, calendarEvent: true } },
      emails: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!trip) notFound();

  const addItemAction = createItineraryItem.bind(null, trip.id);
  const createReminderAction = createReminder.bind(null, trip.id);
  const deleteTripAction = deleteTrip.bind(null, trip.id);
  const updateTripAction = updateTrip.bind(null, trip.id);
  const reminders = trip.items.flatMap((item) => item.reminders.map((reminder) => ({ ...reminder, item })));

  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>{trip.title}</h1>
          <p {...stylex.props(base_styles.muted)}>{trip.destination || "No destination"} · {formatTripStatus(trip.status)}</p>
        </div>
      </div>

      <nav {...stylex.props(base_styles.tabs)} aria-label="Trip sections">
        <Link {...stylex.props(base_styles.tab, tab === "details" && base_styles.tab_active)} href={`/trips/${trip.id}?tab=details`}>Details</Link>
        <Link {...stylex.props(base_styles.tab, tab === "timeline" && base_styles.tab_active)} href={`/trips/${trip.id}?tab=timeline`}>Timeline</Link>
        <Link {...stylex.props(base_styles.tab, tab === "reminders" && base_styles.tab_active)} href={`/trips/${trip.id}?tab=reminders`}>Reminders</Link>
        <Link {...stylex.props(base_styles.tab, tab === "add-item" && base_styles.tab_active)} href={`/trips/${trip.id}?tab=add-item`}>Add item</Link>
        <Link {...stylex.props(base_styles.tab, tab === "emails" && base_styles.tab_active)} href={`/trips/${trip.id}?tab=emails`}>Emails</Link>
      </nav>

      {tab === "details" && (
        <>
          <form {...stylex.props(base_styles.panel, base_styles.form)} action={updateTripAction}>
            <h2 {...stylex.props(base_styles.heading)}>Trip details</h2>
            <input {...stylex.props(base_styles.field)} name="title" defaultValue={trip.title} placeholder="Trip title" required />
            <input {...stylex.props(base_styles.field)} name="destination" defaultValue={trip.destination || ""} placeholder="Destination" />
            <input {...stylex.props(base_styles.field)} name="startsAt" type="date" defaultValue={formatDateLocal(trip.startsAt)} />
            <input {...stylex.props(base_styles.field)} name="endsAt" type="date" defaultValue={formatDateLocal(trip.endsAt)} />
            <select {...stylex.props(base_styles.field, base_styles.select)} name="status" defaultValue={trip.status}>
              {tripStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <textarea {...stylex.props(base_styles.field, base_styles.textarea)} name="notes" defaultValue={trip.notes || ""} placeholder="Notes" />
            <SubmitButton pendingLabel="Saving...">Save changes</SubmitButton>
          </form>

          <form {...stylex.props(base_styles.panel, base_styles.form, base_styles.danger_panel)} action={deleteTripAction}>
            <h2 {...stylex.props(base_styles.heading)}>Delete trip</h2>
            <p {...stylex.props(base_styles.muted)}>Remove this trip and its itinerary items. Source emails stay available for review.</p>
            <SubmitButton confirmMessage="Delete this trip? This cannot be undone." pendingLabel="Deleting..." variant="danger">Delete trip</SubmitButton>
          </form>
        </>
      )}

      {tab === "timeline" && (
        <div {...stylex.props(base_styles.panel)}>
          <h2 {...stylex.props(base_styles.heading)}>Timeline</h2>
          <div {...stylex.props(base_styles.timeline)}>
            {trip.items.map((item) => (
              editingItemId === item.id ? (
                <form {...stylex.props(base_styles.timeline_item, base_styles.form)} key={item.id} action={updateItineraryItem.bind(null, trip.id, item.id)}>
                  <div {...stylex.props(base_styles.row)}>
                    <strong>{item.title}</strong>
                    <Link {...stylex.props(base_styles.nav_link)} href={`/trips/${trip.id}?tab=timeline`}>Cancel</Link>
                  </div>
                  <select {...stylex.props(base_styles.field, base_styles.select)} name="type" defaultValue={item.type}>
                    {itemTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <input {...stylex.props(base_styles.field)} name="title" defaultValue={item.title} placeholder="Title" required />
                  <input {...stylex.props(base_styles.field)} name="provider" defaultValue={item.provider || ""} placeholder="Provider" />
                  <input {...stylex.props(base_styles.field)} name="confirmation" defaultValue={item.confirmation || ""} placeholder="Confirmation number" />
                  <input {...stylex.props(base_styles.field)} name="startsAt" type="datetime-local" defaultValue={formatDateTimeLocal(item.startsAt)} />
                  <input {...stylex.props(base_styles.field)} name="endsAt" type="datetime-local" defaultValue={formatDateTimeLocal(item.endsAt)} />
                  <input {...stylex.props(base_styles.field)} name="locationName" defaultValue={item.locationName || ""} placeholder="Location" />
                  <input {...stylex.props(base_styles.field)} name="address" defaultValue={item.address || ""} placeholder="Address" />
                  <textarea {...stylex.props(base_styles.field)} name="notes" defaultValue={item.notes || ""} placeholder="Notes" />
                  <SubmitButton pendingLabel="Saving...">Save item</SubmitButton>
                </form>
              ) : (
                <Link {...stylex.props(base_styles.timeline_item, base_styles.link_block)} key={item.id} href={`/trips/${trip.id}?tab=timeline&editItem=${item.id}`}>
                  <div {...stylex.props(base_styles.row, base_styles.wrap_row)}>
                    <strong>{item.title}</strong>
                    <span {...stylex.props(base_styles.badge)}>{formatItemType(item.type)}</span>
                  </div>
                  <div {...stylex.props(base_styles.detail_grid)}>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>When</span>
                      <span>{formatDate(item.startsAt)}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Location</span>
                      <span>{item.locationName || item.address || "Not set"}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Provider</span>
                      <span>{item.provider || "Not set"}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Confirmation</span>
                      <span>{item.confirmation || "Not set"}</span>
                    </div>
                  </div>
                  {item.address && item.locationName && <p {...stylex.props(base_styles.muted)}>{item.address}</p>}
                  {item.notes && <p>{item.notes}</p>}
                  <p {...stylex.props(base_styles.muted)}>{item.calendarEvent ? "Calendar synced" : "Not synced to calendar"}</p>
                  <p {...stylex.props(base_styles.muted)}>{item.reminders.length ? `${item.reminders.length} reminder${item.reminders.length === 1 ? "" : "s"} scheduled` : "No reminders scheduled"}</p>
                </Link>
              )
            ))}
            {!trip.items.length && <p {...stylex.props(base_styles.muted)}>No itinerary items yet.</p>}
          </div>
        </div>
      )}

      {tab === "reminders" && (
        <section {...stylex.props(base_styles.panel)}>
          <h2 {...stylex.props(base_styles.heading)}>Reminders</h2>
          <div {...stylex.props(base_styles.timeline)}>
            {reminders.map((reminder) => (
              editingReminderId === reminder.id ? (
                <div {...stylex.props(base_styles.timeline_item)} key={reminder.id}>
                  <div {...stylex.props(base_styles.row, base_styles.wrap_row)}>
                    <strong>{reminder.item.title}</strong>
                    <Link {...stylex.props(base_styles.nav_link)} href={`/trips/${trip.id}?tab=reminders`}>Cancel</Link>
                  </div>
                  <form {...stylex.props(base_styles.form)} action={updateReminder.bind(null, trip.id, reminder.id)}>
                    <div {...stylex.props(base_styles.detail_grid)}>
                      <label>
                        <span {...stylex.props(base_styles.detail_label)}>Reminder time</span>
                        <input {...stylex.props(base_styles.field)} name="remindAt" type="datetime-local" defaultValue={formatDateTimeLocal(reminder.remindAt)} required />
                      </label>
                      <label>
                        <span {...stylex.props(base_styles.detail_label)}>Channel</span>
                        <select {...stylex.props(base_styles.field, base_styles.select)} name="channel" defaultValue={reminder.channel}>
                          <option value="telegram">Telegram</option>
                        </select>
                      </label>
                      <div>
                        <span {...stylex.props(base_styles.detail_label)}>Item time</span>
                        <span>{formatDate(reminder.item.startsAt)}</span>
                      </div>
                      <div>
                        <span {...stylex.props(base_styles.detail_label)}>Sent</span>
                        <span>{reminder.sentAt ? formatDate(reminder.sentAt) : "Not sent"}</span>
                      </div>
                    </div>
                    <SubmitButton pendingLabel="Saving...">Save reminder</SubmitButton>
                  </form>
                  <form {...stylex.props(base_styles.form)} action={deleteReminder.bind(null, trip.id, reminder.id)}>
                    <SubmitButton confirmMessage="Delete this reminder?" pendingLabel="Deleting..." variant="danger">Delete reminder</SubmitButton>
                  </form>
                </div>
              ) : (
                <Link {...stylex.props(base_styles.timeline_item, base_styles.link_block)} key={reminder.id} href={`/trips/${trip.id}?tab=reminders&editReminder=${reminder.id}`}>
                  <div {...stylex.props(base_styles.row, base_styles.wrap_row)}>
                    <strong>{reminder.item.title}</strong>
                    <span {...stylex.props(base_styles.badge)}>{reminder.sentAt ? "Sent" : "Pending"}</span>
                  </div>
                  <div {...stylex.props(base_styles.detail_grid)}>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Reminder time</span>
                      <span>{formatDate(reminder.remindAt)}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Channel</span>
                      <span>{reminder.channel}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Item time</span>
                      <span>{formatDate(reminder.item.startsAt)}</span>
                    </div>
                    <div>
                      <span {...stylex.props(base_styles.detail_label)}>Sent</span>
                      <span>{reminder.sentAt ? formatDate(reminder.sentAt) : "Not sent"}</span>
                    </div>
                  </div>
                </Link>
              )
            ))}
            {!reminders.length && <p {...stylex.props(base_styles.muted)}>No reminders scheduled.</p>}
          </div>

          <form {...stylex.props(base_styles.panel, base_styles.form, base_styles.section_gap)} action={createReminderAction}>
            <h2 {...stylex.props(base_styles.heading)}>Add reminder</h2>
            <select {...stylex.props(base_styles.field, base_styles.select)} name="itemId" required>
              <option value="" disabled>Select itinerary item</option>
              {trip.items.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <input {...stylex.props(base_styles.field)} name="remindAt" type="datetime-local" required />
            <select {...stylex.props(base_styles.field, base_styles.select)} name="channel" defaultValue="telegram">
              <option value="telegram">Telegram</option>
            </select>
            <SubmitButton pendingLabel="Adding...">Add reminder</SubmitButton>
          </form>
        </section>
      )}

      {tab === "add-item" && (
        <form {...stylex.props(base_styles.panel, base_styles.form)} action={addItemAction}>
          <h2 {...stylex.props(base_styles.heading)}>Add item</h2>
          <select {...stylex.props(base_styles.field, base_styles.select)} name="type" defaultValue="GENERIC_BOOKING">
            {itemTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input {...stylex.props(base_styles.field)} name="title" placeholder="Title" required />
          <input {...stylex.props(base_styles.field)} name="provider" placeholder="Provider" />
          <input {...stylex.props(base_styles.field)} name="confirmation" placeholder="Confirmation number" />
          <input {...stylex.props(base_styles.field)} name="startsAt" type="datetime-local" />
          <input {...stylex.props(base_styles.field)} name="endsAt" type="datetime-local" />
          <input {...stylex.props(base_styles.field)} name="locationName" placeholder="Location" />
          <input {...stylex.props(base_styles.field)} name="address" placeholder="Address" />
          <textarea {...stylex.props(base_styles.field, base_styles.textarea)} name="notes" placeholder="Notes" />
          <SubmitButton pendingLabel="Adding...">Add item</SubmitButton>
        </form>
      )}

      {tab === "emails" && (
        <section {...stylex.props(base_styles.panel)}>
          <h2 {...stylex.props(base_styles.heading)}>Source emails</h2>
          <div {...stylex.props(base_styles.timeline)}>
            {trip.emails.map((email) => (
              <Link {...stylex.props(base_styles.timeline_item, base_styles.link_block)} key={email.id} href={`/emails/${email.id}`}>
                <strong>{email.subject || "(no subject)"}</strong>
                <p {...stylex.props(base_styles.muted)}>{formatProcessingStatus(email.status)} · {email.fromAddress || "unknown"}</p>
              </Link>
            ))}
            {!trip.emails.length && <p {...stylex.props(base_styles.muted)}>No source emails linked.</p>}
          </div>
        </section>
      )}
    </main>
  );
}

function normalizeTab(tab?: string): TripTab {
  return tab === "timeline" || tab === "reminders" || tab === "add-item" || tab === "emails" ? tab : "details";
}

function formatDate(date: Date | null) {
  if (!date) return "Date unknown";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDateTimeLocal(date: Date | null) {
  if (!date) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function formatDateLocal(date: Date | null) {
  if (!date) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}
