# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV TZ=UTC
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

FROM base AS build-base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

FROM build-base AS install-inputs
COPY cross/server/package.json ./package.json
COPY cross/server/pnpm-lock.yaml ./pnpm-lock.yaml
COPY cross/server/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY packages/cross-clues /packages/cross-clues
COPY packages/cross-format /packages/cross-format

FROM build-base AS native-builder
ARG TARGETARCH
ENV PATH=/root/.cargo/bin:${PATH}
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable \
  && rm -rf /var/lib/apt/lists/*
COPY --from=install-inputs /app/ ./
COPY --from=install-inputs /packages /packages
RUN --mount=type=cache,id=cross-pnpm-${TARGETARCH},target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile
COPY cross/server/native/dlx-solver ./native/dlx-solver
COPY cross/server/native/template-generator ./native/template-generator
COPY cross/server/scripts/build-template-native.mjs ./scripts/
RUN --mount=type=cache,id=cross-cargo-registry-${TARGETARCH},target=/root/.cargo/registry,sharing=locked \
  --mount=type=cache,id=cross-dlx-target-${TARGETARCH},target=/app/native/dlx-solver/target,sharing=locked \
  --mount=type=cache,id=cross-template-target-${TARGETARCH},target=/app/native/template-generator/target,sharing=locked \
  pnpm exec napi build --release --cwd native/dlx-solver -- --locked \
  && test -f /app/native/dlx-solver/dlx_solver.node \
  && node scripts/build-template-native.mjs \
  && test -f /app/native/template-generator/template_generator.node

FROM install-inputs AS runtime-deps
ARG TARGETARCH
RUN --mount=type=cache,id=cross-pnpm-${TARGETARCH},target=/root/.local/share/pnpm/store \
  pnpm install --prod --frozen-lockfile
COPY cross/server/prisma ./prisma
COPY cross/server/prisma.config.ts ./
RUN DATABASE_URL=postgresql://prisma:prisma@localhost:5432/prisma?schema=public pnpm prisma generate

FROM base AS runner
ENV NODE_ENV=production PORT=3001
RUN apt-get update && apt-get install -y --no-install-recommends epstool ghostscript inkscape fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY --from=runtime-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=runtime-deps --chown=node:node /app/generated ./generated
COPY --from=runtime-deps /packages /packages
COPY --chown=node:node cross/server/. .
COPY --chmod=755 cross/server/entrypoint.sh ./entrypoint.sh
COPY --from=native-builder /app/native/dlx-solver/dlx_solver.node ./native/dlx-solver/
COPY --from=native-builder /app/native/template-generator/template_generator.node ./native/template-generator/
RUN mkdir -p /app/var/crosswords/sample /app/var/crosswords/out \
  && chown -R node:node /app/var
USER node
RUN node -e "require('./native/dlx-solver/dlx_solver.node'); const native = require('./native/template-generator/template_generator.node'); if (typeof native.generateTemplate !== 'function') throw new Error('Rust template generator is unavailable')"
EXPOSE 3001
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node","node_modules/tsx/dist/cli.mjs","src/index.ts"]
