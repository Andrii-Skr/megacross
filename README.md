# megacross monorepo staging

This repository is a staging monorepo that preserves history from:

- `cross`
- `crossnext`
- `words`

It also hosts shared workspace packages under `packages/`.

Current goal:

- keep the existing production topology unchanged
- prepare a safe future switch to root-level Docker build contexts
- move shared code under one git history without breaking current deploys

Notes:

- `var/` is intentionally ignored because it contains runtime data
- shared package `packages/cross-clues` is copied into this repo as workspace code
