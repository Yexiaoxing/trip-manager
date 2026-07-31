import { Send } from "lucide-react";
import * as stylex from "@stylexjs/stylex";
import { ingestEmailFromText } from "@/app/actions";
import { SubmitButton } from "@/src/components/submit_button";
import { base_styles } from "@/src/lib/styles";

export default function EmailIngestPage() {
  return (
    <main {...stylex.props(base_styles.page)}>
      <div {...stylex.props(base_styles.page_header)}>
        <div>
          <h1 {...stylex.props(base_styles.title)}>Test email ingest</h1>
          <p {...stylex.props(base_styles.muted)}>Paste a raw forwarded email to queue extraction and notification.</p>
        </div>
      </div>

      <form {...stylex.props(base_styles.panel, base_styles.form, base_styles.fill_form)} action={ingestEmailFromText}>
        <textarea {...stylex.props(base_styles.field, base_styles.textarea, base_styles.textarea_fill)} name="rawEmail" placeholder="Raw .eml content" required />
        <SubmitButton pendingLabel="Queueing..." variant="secondary"><Send size={16} />Queue email</SubmitButton>
      </form>
    </main>
  );
}
