import { Plus } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import { createTrip } from "@/app/actions";
import { SubmitButton } from "@/src/components/submit_button";
import { base_styles } from "@/src/lib/styles";

export default function NewTripPage() {
  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>New trip</h1>
          <p {...stylex.props(base_styles.muted)}>Create a trip shell before adding bookings and reminders.</p>
        </div>
      </div>

      <form {...stylex.props(base_styles.panel, base_styles.form)} action={createTrip}>
        <input {...stylex.props(base_styles.field)} name="title" placeholder="Trip title" required />
        <input {...stylex.props(base_styles.field)} name="destination" placeholder="Destination" />
        <input {...stylex.props(base_styles.field)} name="startsAt" type="date" />
        <input {...stylex.props(base_styles.field)} name="endsAt" type="date" />
        <textarea {...stylex.props(base_styles.field, base_styles.textarea)} name="notes" placeholder="Notes" />
        <SubmitButton pendingLabel="Creating..."><Plus size={16} />Create</SubmitButton>
      </form>
    </main>
  );
}
