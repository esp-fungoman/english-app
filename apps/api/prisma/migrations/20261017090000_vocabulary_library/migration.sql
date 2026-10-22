-- Fresh-database release only: legacy word rows must be empty before this migration.
-- No reset or deletion is performed by this migration.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM words) THEN
    RAISE EXCEPTION 'Vocabulary library requires a fresh database. Reset the deployment database explicitly before migrating.';
  END IF;
END $$;
ALTER TABLE units ADD COLUMN opens_at TIMESTAMP(3);
ALTER TABLE words RENAME TO unit_words;
ALTER TABLE unit_words RENAME CONSTRAINT words_pkey TO unit_words_pkey;
ALTER TABLE word_categories RENAME TO unit_word_categories;
ALTER TABLE unit_word_categories RENAME COLUMN word_id TO unit_word_id;
ALTER TABLE unit_word_categories RENAME CONSTRAINT word_categories_pkey TO unit_word_categories_pkey;
ALTER TABLE unit_word_categories RENAME CONSTRAINT word_categories_word_id_fkey TO unit_word_categories_unit_word_id_fkey;
ALTER TABLE unit_word_categories RENAME CONSTRAINT word_categories_category_id_fkey TO unit_word_categories_category_id_fkey;
ALTER TABLE unit_words RENAME CONSTRAINT words_unit_id_fkey TO unit_words_unit_id_fkey;
ALTER TABLE unit_words DROP COLUMN lemma, DROP COLUMN meaning_vi, DROP COLUMN part_of_speech, DROP COLUMN image_key, DROP COLUMN audio_key, DROP COLUMN extra_letter;
ALTER TABLE unit_words ADD COLUMN word_id TEXT NOT NULL, ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE words (
  id TEXT NOT NULL PRIMARY KEY, lemma TEXT NOT NULL, meaning_vi TEXT, meaning_key TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL, initial TEXT NOT NULL, part_of_speech TEXT, image_key TEXT, audio_key TEXT
);
CREATE UNIQUE INDEX words_lemma_meaning_key_key ON words(lemma, meaning_key);
CREATE INDEX words_initial_lemma_id_idx ON words(initial, lemma, id);
CREATE UNIQUE INDEX unit_words_unit_id_word_id_key ON unit_words(unit_id, word_id);
CREATE INDEX unit_words_word_id_active_idx ON unit_words(word_id, active);
ALTER TABLE unit_words ADD CONSTRAINT unit_words_word_id_fkey FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE word_categories (
  word_id TEXT NOT NULL, category_id TEXT NOT NULL,
  CONSTRAINT word_categories_pkey PRIMARY KEY (word_id, category_id),
  CONSTRAINT word_categories_word_id_fkey FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT word_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO grades(id, level, title) VALUES ('grade-1',1,'Khối 1'),('grade-2',2,'Khối 2'),('grade-3',3,'Khối 3'),('grade-4',4,'Khối 4'),('grade-5',5,'Khối 5') ON CONFLICT (level) DO NOTHING;
