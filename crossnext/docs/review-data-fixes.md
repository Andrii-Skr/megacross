# Issue storage and dictionary restoration

## Deployment

Apply the `20261019093915_word_delete_origin` migration before deploying the updated application. The identical migration is included in both Prisma migration trees because Next.js and Cross share the database. Regenerate both Prisma clients when building from source.

`opred_v.deletedWithWord` records whether a definition was hidden by deleting its parent word. Only previously active definitions receive this flag. Restoring the word restores these definitions and clears the flag. Explicitly deleting or restoring a definition clears its flag.

Existing deleted definitions receive `false`: their historical deletion reason cannot be reconstructed reliably. Restoring a word therefore keeps these ambiguous definitions deleted; restore the intended definitions individually.

## Existing template directories

Canonical directory names retain their old paths, including ordinary numbers and Unicode names such as `42 2026`. If sanitization would change an edition code or issue label, the directory component is now `~` followed by the SHA-256 hash of the original value. The old sanitizer could not produce this prefix, so encoded names cannot collide with canonical legacy names. Uploads, previews, the generator and exports use the same mapping.

Old directories that were shared by colliding labels are left intact. For example, `1/2026` and `2/2026` previously shared `2026`; each now has its own directory. Do not automatically assign the shared directory to either issue. Upload the correct templates for each issue from its original source or backup. Previously stored archive paths remain valid.
