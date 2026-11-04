CrossNext – Modern Next.js app scaffold with NextAuth, Prisma, Tailwind, shadcn/ui, TanStack Query, RHF+Zod, next-intl, Biome, Vitest and Playwright.

Quickstart

- Node.js: `>=20.19.0` is required for Prisma 7 commands.
- Install deps:
  - pnpm: corepack enable && pnpm i
  - set up DB: docker compose up -d db
  - migrate: pnpm prisma:migrate
  - generate client: pnpm prisma:generate
  - seed admin: pnpm ts-node prisma/seed.ts or pnpm exec tsx prisma/seed.ts
- Run dev: pnpm dev
- Build: pnpm build && pnpm start

ENV

- Copy .env.example to .env and adjust values.
- Required (runtime): DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL.
- Required (seeding only): ADMIN_LOGIN, ADMIN_PASSWORD.
- Optional: ADMIN_EMAIL (used to set email for the seeded admin user).
- Cross service: configure the same `CROSS_API_SECRET` in both applications, or use the same `NEXTAUTH_SECRET` as a fallback. Production Compose shares the existing `nextauth_secret` Docker secret with Cross automatically.
- Set `CROSS_API_URL` to the server-side Cross address (locally `http://127.0.0.1:3001`; in Compose `http://cross:3001`). The browser uses authenticated `/api/cross/...` routes on the Next.js origin, including event streams and archive downloads. No public Cross URL is required.
- Cross accepts only service-authenticated requests, except `GET /api/healthz`. Production Compose exposes port 3001 only inside the Docker network. Rebuild and deploy both applications together when upgrading from direct browser access.

Migrations & Seeding

- Create DB (Docker): docker compose up -d db
- Apply migrations: pnpm prisma:migrate
- Generate Prisma Client: pnpm prisma:generate
- Seed admin: pnpm ts-node prisma/seed.ts

Testing

- Unit: pnpm test
- E2E: start the app then pnpm test:e2e
- Standalone artifacts: after `pnpm build`, run `MEGACROSS_CHECK_STANDALONE=1 pnpm exec vitest run tests/integration/standalone-output.test.ts` to check that preview arrows and Sharp are present and project source/tests are excluded.
- PostgreSQL regressions: set `MEGACROSS_REVIEW_TEST_DATABASE_URL` to a disposable PostgreSQL database with the current Prisma schema, then run `pnpm exec vitest run tests/integration/dictionary-moderation-postgres.test.ts`. Without that variable the integration suite is skipped. Fixtures use a unique language and are cleaned up after the run.

Scripts

- Lint: pnpm lint / pnpm lint:fix
- Format: pnpm format / pnpm format:fix

Notes

- RBAC enforced in API routes using NextAuth session role.
- Credentials auth uses bcrypt with cost 12.
- Security headers set in next.config.ts (CSP, HSTS, Referrer-Policy).

Docs

- User guide (RU): docs/user-guide.md
- AI providers: docs/ai-providers.md
- Legacy sync: docs/legacy-sync.md
