# Legacy FSH photo-area corpus

These are unmodified copies of templates from `legacy mysql/shablons_15x21` and
`legacy mysql/shablons_23x31`. The test in
`tests/unit/scanword-photo-corpus.test.ts` records the expected photo owner
(slot ID) and zero-based rectangle for each template.

The sample includes:

- no photo area (`41683`, `41686`);
- paired text definitions beside two photos (`41687`–`41690`);
- two `4×4` areas, including the five reported failures (`41688`, `41689`,
  `41692`, `41700`, `41702`);
- `4×5`, `5×4`, `5×5`, `6×4`, `4×3`, `3×4`, and `7×9` areas;
- areas on edges, in the middle, and beside connected clue cells;
- grids of both `15×21` and `23×31` cells.

Run the corpus with `pnpm exec vitest run tests/unit/scanword-photo-corpus.test.ts`
from `crossnext`. It also runs in the normal `pnpm test` suite.

The corpus checks photo ownership and bounds for every file. It additionally
checks layouts with filled definitions for the five reported failures. During
collection, filled-definition layouts for `42040`, `42902`, and `44454` did not
match their photo bounds; that separate behavior is not asserted as correct.
