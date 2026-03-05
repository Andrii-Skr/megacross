CREATE TABLE IF NOT EXISTS "edition_word_hot_state" (
  "editionId" INTEGER NOT NULL,
  "wordId" BIGINT NOT NULL,
  "isBanned" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "edition_word_hot_state_pkey" PRIMARY KEY ("editionId", "wordId"),
  CONSTRAINT "edition_word_hot_state_editionId_fkey"
    FOREIGN KEY ("editionId") REFERENCES "editions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "edition_word_hot_state_wordId_fkey"
    FOREIGN KEY ("wordId") REFERENCES "word_v"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "edition_word_hot_state_editionId_isBanned_idx"
  ON "edition_word_hot_state"("editionId", "isBanned");

CREATE INDEX IF NOT EXISTS "edition_word_hot_state_wordId_idx"
  ON "edition_word_hot_state"("wordId");
