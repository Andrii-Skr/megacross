# Tracking generated word images

`word_v.imageGeneratedAt` records when images were successfully generated for a word. A null value means the word has not been marked generated. This is separate from `isImageable`, which means the word can be illustrated, and from the presence of uploaded images.

Manual uploads and deletion of images do not change this generation history. An explicitly requested new version can still be generated for an already marked word; the ordinary candidate selection excludes it.

## Select the next batch

From the repository root:

```sh
pnpm --dir cross/server run image-generation:candidates --language ru --limit 100
```

The command writes a new, timestamped JSON candidate manifest under `output/imagegen/` and prints its path. Use `--out <path.json>` for a specific new file; existing files are never overwritten. Selection requires `isImageable = true`, `imageGeneratedAt IS NULL`, an active word in the selected language, and an active, non-expired definition. Each candidate includes all active, non-expired definitions in the selected language for choosing the intended sense. Read and compare the complete set before preparing a prompt.

This command only selects candidates: it does not reserve words, generate images, or set completion dates. Before starting the next generation, use this selector rather than reusing an old candidate file.

## Mark a completed batch

Generation must save `generatedAt` for each item and relative file paths in `files` for every key declared in the manifest's `variants`. After every image in the batch has been generated successfully:

```sh
pnpm --dir cross/server run image-generation:mark --manifest ../../output/imagegen/pilot-100/manifest.json
pnpm --dir cross/server run image-generation:mark --manifest ../../output/imagegen/pilot-100/manifest.json --apply
```

Paths supplied to the CLI are relative to `cross/server` when invoked with `pnpm --dir cross/server`.

The first command previews the changes; `--apply` stores each word's generation date. The command verifies all planned files are present and nonempty and checks word IDs and exact text before updating the database in a transaction. Missing files, incomplete items and changed words abort the batch. Import into the editor is not required to record successful generation.

Repeated marking is safe: existing dates are preserved. Incomplete or failed generations must not be marked. Completed batches should retain their manifests as a record of prompts, chosen definitions, files and generation dates.

The initial pilot of 100 words has been marked and is excluded from subsequent candidate selections.

`scanword_word_images.needsReview` is a non-null boolean (default `false`) for each stored image. `true` means that the image has been imported but still needs manual visual review. The dictionary word images API returns this flag. Generation history and review state are independent.

## Transfer image metadata to another database

When source and destination word IDs match, export one SQL file containing both image metadata and all positive `word_v` image flags (including words without stored images) from the local `crossnext` directory:

```sh
pnpm images:export --out ../output/imagegen/word-images-export.sql
```

Both datasets are read from the same repeatable-read, read-only source snapshot. The command refuses to overwrite an existing output file. It loads `.env.local` over `.env`, while explicitly supplied process environment variables take precedence. The export contains dictionary/image metadata, not database credentials or image bytes. `output/imagegen/` is ignored by Git; copy the SQL file to the server separately.

Copy the contents of `var/crosswords/word-images/` to the production image storage, preserving paths and filenames. Apply the current database migrations before importing. Copy the SQL export to `/tmp/word-images-export.sql` on the server, then run this from the production `crossnext` directory with the current Compose configuration:

```sh
docker compose --profile prod exec -T db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' < /tmp/word-images-export.sql
```

The import checks that every exported word ID has exactly the same word text and language in the destination. A mismatch aborts the complete transaction. Image IDs are allocated by the destination database; source image and creator IDs are not copied. Existing `(wordId, sha256)` images remain unchanged and are counted as skipped. Paths, names, review flags, image metadata and timestamps are preserved for newly inserted images. Words become imageable, and an existing production generation date is preserved.

The file uses one transaction for both parts: a failure in either part rolls back all image inserts and word updates. The command prints image counts (`exported_images`, `inserted_images`, `skipped_images`) and word flag counts (`exported_words`, `updated_words`). Repeating the import is safe. This transfers the image library and its word flags: local scanword drafts and their selected image IDs are not migrated. SQL import cannot check the application server's files; copy the image directory before using the imported images.

### Transfer only word image flags (optional)

The combined export above already includes these flags. For a separate flags-only update, run from `crossnext`:

```sh
pnpm images:export-word-flags --out ../output/imagegen/word-image-flags-export.sql
```

Copy this SQL file to the production server and apply it with the same `psql` command, using its filename. It exports every word with `isImageable=true` or a non-null `imageGeneratedAt`. Import validates word text and language, adds positive imageability markings, and fills only missing generation dates with the original source dates. It does not clear production flags, overwrite existing dates, or substitute the current date for an unknown generation date. It can run before or after the image metadata import; repeating it is safe. The output reports exported and actually updated word counts.
