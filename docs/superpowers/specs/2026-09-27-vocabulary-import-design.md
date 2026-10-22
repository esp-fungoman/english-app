# Vocabulary workbook import design

## Purpose and decisions

Teachers need to enter curriculum vocabulary collaboratively without knowing database IDs. The deliverable is a versioned `.xlsx` workbook with linked tabs and sample rows, plus an admin upload/preview/commit flow. Excel is the supported authoring format for v1. A team may co-author the file in OneDrive or try Google Sheets conversion, but the importer depends only on source cells, not on spreadsheet-calculated values.

Import may create missing units. Images are uploaded manually after import and are not represented in this workbook. Browser speech remains the default audio source; no audio-file column is required.

## Workbook v1

The workbook has four tabs in this order:

1. `Huong dan`: short Vietnamese instructions, template version, allowed values, and the rule that sample rows are imported if retained.
2. `Units`: editable `grade_level`, `unit_number`, `unit_title`, `group_mode`; calculated `unit_code` (for example, `K1-U01`). A grade must be 1-5; unit numbers must be 1-10; `group_mode` is `single` or `board`, default `single`.
3. `Categories`: editable `category_code` and `category_title_vi`. Codes are stable lowercase ASCII slugs, unique across the workbook and database.
4. `Words`: editable `unit_code`, `lemma`, `meaning_vi`, `part_of_speech`, and `category_1` through `category_4`. The unit and category code cells have dropdowns referring to the preceding tabs. Formula-only columns show the selected unit title and category titles, making a bad or missing reference visible to a teacher. No extra-letter column is imported.

Each input tab starts with two or three editable sample rows: two units, two categories, and `cat`, `dog`, `red`. They are ordinary import data. Teachers replace them or clear their editable cells when not needed; preview counts them if retained. There is no separate examples tab.

Formula and dropdown ranges are provisioned for 50 units, 100 categories, and 2,000 words. Formula-derived columns are visually distinct and protected from accidental edits. Rows beyond these limits are rejected, not silently ignored. Use broadly supported lookup formulas with `ISNA`, `MATCH`, and `INDEX`, avoiding `IFNA` compatibility errors in Excel.

`part_of_speech` uses a controlled list with Vietnamese labels in the guide and stable import codes: `noun`, `verb`, `adjective`, `adverb`, `pronoun`, `preposition`, `determiner`, `conjunction`, `interjection`, `other`. Existing words remain nullable. For v1, each `(unit, lemma)` is a single vocabulary entry; different meanings of the same spelling within one unit require a later sense model.

The existing four games only accept lowercase English letters and words of at most 12 letters. The importer rejects unsupported phrases, punctuation, and accented English spellings instead of creating words the games cannot use. The odd-letter game chooses a random letter absent from the word when the API creates each question, retaining that answer in the session for stable grading and refresh recovery.

## Admin flow and API

Admin content gets a template download and an import area. A teacher uploads a `.xlsx` file and sees a preview of new units, categories, words, existing rows to skip, warnings, and row-numbered errors. No writes occur during preview. A separate Confirm action sends the same file for commit; the server validates it again and imports all new records in one transaction. Any validation error aborts the whole commit.

The import API is admin-authenticated multipart `POST /api/admin/word-import` with `mode=preview|commit`. Both modes require the expected workbook version and parse only the known sheets and columns. They resolve `unit_code` and category codes from `Units` and `Categories` themselves, ignoring cached results of workbook formulas. Unknown references, duplicate keys within the file, inconsistent titles/modes against existing records, and invalid POS/word values are row errors. Spreadsheet formulas in teacher-editable input cells are rejected. File size and row count are bounded; no source row past the template capacity is silently ignored.

On commit, existing grades 1-5 are looked up but never changed. Missing units are created with the four current activities; existing units are not overwritten. Missing categories are created; existing category titles are not overwritten. Existing words with the same unit and lemma are skipped, preserving teacher edits, media keys, and student attempts. An ambiguous existing duplicate is an error, not a guessed match. Imported words have `imageKey` and `audioKey` unset.

Add nullable `partOfSpeech` to `Word`, expose it in admin word editing and the student wordbook, and update data/technical/product documentation. Preview may warn when imported grouping content is insufficient for the configured board mode, but it must not silently change that mode. Import does not change unit manual locks or student progress.

## Verification and scope

Verify the actual exported workbook structure, formulas, dropdowns, and representative lookups in a spreadsheet reader. Verify preview and commit with valid data, invalid references, duplicates, re-import, existing unit/category conflicts, and transaction rollback. Run Prisma generation/migration plus type/build checks. Do not add test files; the user will verify the admin interaction manually.

Direct Google Sheets API import, automatic image matching, and multiple senses of the same word in one unit are out of scope. A later admin image queue can list imported words without images for manual upload.
