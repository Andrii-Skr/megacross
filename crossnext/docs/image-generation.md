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
