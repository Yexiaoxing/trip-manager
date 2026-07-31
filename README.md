# Trip Manager

Self-hosted trip manager for itineraries, Resend inbound email processing, OpenAI-compatible extraction, Telegram notifications, and one-way Google Calendar sync.

## Run Locally

```bash
cp .env.example .env
pnpm install
pnpm prisma:migrate
pnpm dev
```

Run the worker in another terminal:

```bash
pnpm worker
```

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The web app binds to `127.0.0.1:3000` by default. Expose `/api/resend/webhook` through your reverse proxy for Resend inbound email while keeping the UI private.
