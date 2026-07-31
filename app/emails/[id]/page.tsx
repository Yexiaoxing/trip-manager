import Link from "next/link";
import { notFound } from "next/navigation";
import * as stylex from "@stylexjs/stylex";
import { linkEmailToTrip, reprocessEmail } from "@/app/actions";
import { SubmitButton } from "@/src/components/submit_button";
import { prisma } from "@/src/lib/prisma";
import { base_styles } from "@/src/lib/styles";
import { parseStoredEmail } from "@/src/services/email_preview";
import { formatProcessingStatus } from "@/src/types/domain";

export const dynamic = "force-dynamic";

export default async function EmailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await prisma.emailArtifact.findUnique({
    where: { id },
    include: { trip: true, attachments: true },
  });

  if (!email) notFound();

  const [preview, trips] = await Promise.all([
    parseStoredEmail(email.rawPath),
    prisma.trip.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, destination: true } }),
  ]);
  const showReviewActions = email.status === "NEEDS_REVIEW" || !email.tripId;
  const reprocessDisabled = email.status === "PENDING" || email.status === "PROCESSING";
  const linkAction = linkEmailToTrip.bind(null, email.id);
  const reprocessAction = reprocessEmail.bind(null, email.id);

  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>{email.subject || "(no subject)"}</h1>
          <p {...stylex.props(base_styles.muted)}>{email.fromAddress || "unknown sender"} · {formatProcessingStatus(email.status)}</p>
        </div>
      </div>

      <section {...stylex.props(base_styles.panel, base_styles.section_gap)}>
        <h2 {...stylex.props(base_styles.heading)}>Email details</h2>
        <div {...stylex.props(base_styles.timeline)}>
          <div {...stylex.props(base_styles.timeline_item)}>
            <strong>Received</strong>
            <p {...stylex.props(base_styles.muted)}>{email.receivedAt ? formatDate(email.receivedAt) : "Date unknown"}</p>
          </div>
          <div {...stylex.props(base_styles.timeline_item)}>
            <strong>Trip</strong>
            <p {...stylex.props(base_styles.muted)}>
              {email.trip ? <Link href={`/trips/${email.trip.id}?tab=emails`}>{email.trip.title}</Link> : "Not linked"}
            </p>
          </div>
          <div {...stylex.props(base_styles.timeline_item)}>
            <strong>Attachments</strong>
            <p {...stylex.props(base_styles.muted)}>{email.attachments.length}</p>
          </div>
        </div>
      </section>

      {showReviewActions && (
        <section {...stylex.props(base_styles.panel, base_styles.section_gap)}>
          <h2 {...stylex.props(base_styles.heading)}>Review actions</h2>
          <div {...stylex.props(base_styles.grid)}>
            <form {...stylex.props(base_styles.form)} action={reprocessAction}>
              <p {...stylex.props(base_styles.muted)}>Run extraction on this email again.</p>
              <SubmitButton disabled={reprocessDisabled} disabledLabel="Waiting for processing" pendingLabel="Queueing...">Reprocess email</SubmitButton>
            </form>

            <form {...stylex.props(base_styles.form)} action={linkAction}>
              <p {...stylex.props(base_styles.muted)}>Attach this email to an existing trip.</p>
              <select {...stylex.props(base_styles.field, base_styles.select)} name="tripId" defaultValue={email.tripId || ""} required>
                <option value="" disabled>Select trip</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>{trip.title}{trip.destination ? ` - ${trip.destination}` : ""}</option>
                ))}
              </select>
              <SubmitButton pendingLabel="Linking...">Link to trip</SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section {...stylex.props(base_styles.panel, base_styles.section_gap)}>
        <h2 {...stylex.props(base_styles.heading)}>{preview.hasHtml ? "HTML preview" : "Text preview"}</h2>
        {preview.missing ? (
          <p {...stylex.props(base_styles.muted)}>Stored email file is missing.</p>
        ) : preview.hasHtml ? (
          <iframe {...stylex.props(base_styles.preview_frame)} sandbox="" srcDoc={preview.html} title="Email HTML preview" />
        ) : (
          <pre {...stylex.props(base_styles.pre)}>{preview.text || email.textPreview || "No preview available."}</pre>
        )}
      </section>
    </main>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
