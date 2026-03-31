# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV TZ=UTC
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=cross-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production PORT=3001
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public pnpm prisma generate \
  && chmod +x /app/entrypoint.sh \
  && mkdir -p /app/var/crosswords/sample /app/var/crosswords/out \
  && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["pnpm","start"]
