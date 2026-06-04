# Docker cutover notes

Current production topology should stay unchanged during the git migration:

- `crossnext` remains a separate container image and service
- `cross` remains a separate container image and service
- only Docker build contexts should change later so both images can read `packages/cross-clues`

Recommended next step:

1. Build both images from the monorepo root context.
2. Keep separate Dockerfiles:
   - `crossnext/Dockerfile`
   - `cross/server/Dockerfile`
3. In compose, point to:
   - root build context
   - service-specific Dockerfile
4. Copy only required subtrees in each Dockerfile:
   - service directory
   - `packages/cross-clues`

Do not do in the first cutover:

- do not merge `cross` and `crossnext` into one runtime container
- do not turn `cross-clues` into a network service
- do not change runtime shared volume semantics for `/app/var/crosswords`
