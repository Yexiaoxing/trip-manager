import type { Metadata } from "next";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { base_styles } from "@/src/lib/styles";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trip Manager",
  description: "Self-hosted trip itinerary manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div {...stylex.props(base_styles.shell)}>
          <header {...stylex.props(base_styles.topbar)}>
            <Link {...stylex.props(base_styles.brand)} href="/">Trip Manager</Link>
            <nav {...stylex.props(base_styles.nav)}>
              <Link {...stylex.props(base_styles.nav_link)} href="/">Trips</Link>
              <Link {...stylex.props(base_styles.nav_link)} href="/trips/new">New trip</Link>
              <Link {...stylex.props(base_styles.nav_link)} href="/emails/ingest">Ingest email</Link>
              <Link {...stylex.props(base_styles.nav_link)} href="/settings">Settings</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
