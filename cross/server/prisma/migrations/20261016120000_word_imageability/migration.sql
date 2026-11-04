-- All existing words start unmarked, including words with stored images.
ALTER TABLE "word_v" ADD COLUMN "isImageable" BOOLEAN NOT NULL DEFAULT false;
