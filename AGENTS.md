# Trip Manager Session Notes

## Project Shape
- This is a greenfield Next.js App Router application for a self-hosted trip manager.
- Runtime services are Postgres, Redis, the Next.js web app, and a BullMQ worker.
- Production deployment is represented by `docker-compose.yml`; the web port binds to `127.0.0.1:3000` by default.

## Current Requirements Captured
- Email ingestion uses Resend inbound email through `app/api/resend/webhook/route.ts`.
- After each email is processed, the worker creates a Telegram notification job summarizing the extraction result.
- Trip extraction uses an OpenAI-compatible endpoint configured by `OPENAI_BASE_URL`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- Google Calendar sync is one-way from itinerary items to a configured calendar.
- Telegram uses Bot API long polling and only sends to `TELEGRAM_ALLOWED_CHAT_IDS`.

## Coding Conventions
- Authored source filenames should use snake_case, except framework-required files such as `app/page.tsx`, `app/layout.tsx`, `next.config.ts`, and `package.json`.
- UI styling should use StyleX via `@stylexjs/stylex`; do not add global CSS or `className` styling for app UI.
- Shared StyleX styles currently live in `src/lib/styles.ts`.
- Keep integration adapters under `src/integrations` and business services under `src/services`.

## Verification Commands
- `pnpm test`
- `pnpm build`
- `docker compose up --build`

## Notes
- The StyleX docs URL could not be fetched in-session because network access was restricted/interrupted, so setup uses the installed StyleX Next.js/Babel packages and local type shim.
- The Resend SDK version installed here does not expose a webhook verifier. The project imports the Resend SDK in `src/integrations/resend.ts` and performs compatible signature verification locally using Resend/Svix webhook headers.
