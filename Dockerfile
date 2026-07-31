FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://trip:trip@postgres:5432/trip_manager?schema=public pnpm prisma:generate:postgres
RUN DATABASE_URL=postgresql://trip:trip@postgres:5432/trip_manager?schema=public pnpm exec next build

FROM base AS runner
RUN corepack enable
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["pnpm", "start"]
