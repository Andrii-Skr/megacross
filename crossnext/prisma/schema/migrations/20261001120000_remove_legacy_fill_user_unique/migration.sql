-- The settings row is scoped to a user and an issue. A legacy one-column
-- uniqueness rule can remain on upgraded databases and reject another issue.
DO $$
DECLARE
  user_id_column SMALLINT;
  legacy_constraint RECORD;
  legacy_index RECORD;
BEGIN
  SELECT attnum INTO user_id_column
  FROM pg_attribute
  WHERE attrelid = 'public.scanword_fill_settings'::regclass
    AND attname = 'userId'
    AND NOT attisdropped;

  FOR legacy_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.scanword_fill_settings'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[user_id_column]::SMALLINT[]
  LOOP
    EXECUTE format('ALTER TABLE public.scanword_fill_settings DROP CONSTRAINT %I', legacy_constraint.conname);
  END LOOP;

  FOR legacy_index IN
    SELECT index_relation.relname
    FROM pg_index index_info
    JOIN pg_class index_relation ON index_relation.oid = index_info.indexrelid
    WHERE index_info.indrelid = 'public.scanword_fill_settings'::regclass
      AND index_info.indisunique
      AND index_info.indnkeyatts = 1
      AND index_info.indkey[0] = user_id_column
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint constraint_info
        WHERE constraint_info.conindid = index_info.indexrelid
      )
  LOOP
    EXECUTE format('DROP INDEX public.%I', legacy_index.relname);
  END LOOP;
END $$;
