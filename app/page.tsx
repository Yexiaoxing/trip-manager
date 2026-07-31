import Link from "next/link";
import { MailPlus, Plane, Plus } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import { prisma } from "@/src/lib/prisma";
import { base_styles } from "@/src/lib/styles";
import { formatItemType, formatProcessingStatus, formatTripStatus } from "@/src/types/domain";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [trips, emails] = await Promise.all([
    prisma.trip.findMany({
      include: { items: { orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }], take: 4 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.emailArtifact.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>Trips</h1>
          <p {...stylex.props(base_styles.muted)}>Manage itineraries, confirmations, reminders, and calendar sync.</p>
        </div>
        <div {...stylex.props(base_styles.row, base_styles.wrap_row)}>
          <Link {...stylex.props(base_styles.button)} href="/trips/new"><Plus size={16} />New trip</Link>
          <Link {...stylex.props(base_styles.button, base_styles.button_secondary)} href="/emails/ingest"><MailPlus size={16} />Test email ingest</Link>
        </div>
      </div>

      <section {...stylex.props(base_styles.grid, base_styles.section_gap)}>
        {trips.map((trip) => (
          <Link {...stylex.props(base_styles.card)} key={trip.id} href={`/trips/${trip.id}`}>
            <div>
              <div {...stylex.props(base_styles.row)}>
                <h3 {...stylex.props(base_styles.subheading)}>{trip.title}</h3>
                <span {...stylex.props(base_styles.badge)}>{formatTripStatus(trip.status)}</span>
              </div>
              <p {...stylex.props(base_styles.muted)}>{trip.destination || "No destination"}</p>
              <p {...stylex.props(base_styles.muted)}>{formatTripRange(trip.startsAt, trip.endsAt)}</p>
              <p><Plane size={15} /> {trip.items.length} itinerary items</p>
              <div {...stylex.props(base_styles.timeline)}>
                {trip.items.map((item) => (
                  <p {...stylex.props(base_styles.muted)} key={item.id}>
                    {formatItemType(item.type)}: {item.title}{item.startsAt ? ` · ${formatShortDate(item.startsAt)}` : ""}
                  </p>
                ))}
                {!trip.items.length && <p {...stylex.props(base_styles.muted)}>No itinerary items yet.</p>}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section {...stylex.props(base_styles.panel, base_styles.section_gap)}>
        <h2 {...stylex.props(base_styles.heading)}>Recent emails</h2>
        <div {...stylex.props(base_styles.timeline)}>
          {emails.map((email) => (
            <Link {...stylex.props(base_styles.timeline_item, base_styles.link_block)} key={email.id} href={`/emails/${email.id}`}>
              <strong>{email.subject || "(no subject)"}</strong>
              <p {...stylex.props(base_styles.muted)}>{formatProcessingStatus(email.status)} · {email.fromAddress || "unknown sender"}</p>
            </Link>
          ))}
          {!emails.length && <p {...stylex.props(base_styles.muted)}>No emails processed yet.</p>}
        </div>
      </section>
    </main>
  );
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function formatTripRange(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return "Dates not set";
  const formatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  if (startsAt && endsAt) return `${formatter.format(startsAt)} to ${formatter.format(endsAt)}`;
  return formatter.format(startsAt || endsAt!);
}
