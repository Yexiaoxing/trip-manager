FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=1
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://trip:trip@postgres:5432/trip_manager?schema=public pnpm prisma:generate:postgres
RUN DATABASE_URL=postgresql://trip:trip@postgres:5432/trip_manager?schema=public pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app /
EXPOSE 3000
CMD ["pnpm", "start"]
