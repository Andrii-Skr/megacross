# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV TZ=UTC
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS deps
ENV PATH=/root/.cargo/bin:${PATH}
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ curl \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
  && rustc --version \
  && cargo --version \
  && rm -rf /var/lib/apt/lists/*
COPY cross/server/package.json ./package.json
COPY cross/server/pnpm-lock.yaml ./pnpm-lock.yaml
COPY cross/server/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY packages/cross-clues /packages/cross-clues
RUN --mount=type=cache,id=cross-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps AS native-builder
COPY cross/server/. .
COPY packages/cross-clues /packages/cross-clues
RUN --mount=type=cache,id=cross-cargo-registry,target=/root/.cargo/registry \
  --mount=type=cache,id=cross-cargo-git,target=/root/.cargo/git \
  pnpm exec napi build --release --cwd native/dlx-solver \
  && test -f /app/native/dlx-solver/dlx_solver.node

FROM base AS runner
ENV NODE_ENV=production PORT=3001
COPY --from=deps /app/node_modules ./node_modules
COPY cross/server/. .
COPY packages/cross-clues /packages/cross-clues
COPY --from=native-builder /app/native/dlx-solver/dlx_solver.node /app/native/dlx-solver/dlx_solver.node
RUN DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public pnpm prisma generate \
  && chmod +x /app/entrypoint.sh \
  && mkdir -p /app/var/crosswords/sample /app/var/crosswords/out \
  && chown -R node:node /app
USER node
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["pnpm","start"]
