# Vocabulary Workbook Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a linked Excel curriculum template and an admin workflow that previews and atomically imports units, categories, and vocabulary without losing existing edits or student history.

**Architecture:** A static versioned `.xlsx` is the teacher-facing contract. An admin-only NestJS endpoint parses the three source tabs, revalidates against the database for both preview and commit, and never trusts formula caches. Prisma stores the new part-of-speech field; the existing admin and student screens expose it.

**Tech Stack:** pnpm/Nx, NestJS, Prisma/PostgreSQL, Next.js, ExcelJS for server-side parsing, bundled `@oai/artifact-tool` for workbook authoring.

**Spec:** `docs/superpowers/specs/2026-09-27-vocabulary-import-design.md`

## Global Constraints

- Workbook v1 has `Huong dan`, `Units`, `Categories`, and `Words` tabs, in that order. Each input tab has two or three editable sample rows, counted as import data if retained.
- `Units`, `Categories`, and `Words` permit at most 50, 100, and 2,000 source rows respectively; extra rows are errors.
- A word is one `[a-z]{1,12}` lemma per unit; `meaning_vi`, `part_of_speech`, and at least one category are required for imported words.
- Import creates missing units with four activities, never changes existing units/categories/words, and never changes manual locks or progress.
- Images, audio files, and the game's randomly generated extra letter are outside import.
- Preview writes nothing. Commit revalidates and is all-or-nothing. Spreadsheet formulas in editable source cells are invalid.
- Do not create automated test files. Run generation, type/build, workbook inspection, and targeted command-level verification; the user checks the visual admin workflow.

## Review Focus

- A workbook saved without recalculation still resolves unit/category keys from source tabs; check parser behavior in Task 3.
- A second import skips existing words without overwriting meaning, POS, media, or attempts; check Task 3.
- Duplicate or conflicting unit/category definitions report sheet, row, field, and code before any commit; check Task 3.
- An invalid row after valid rows prevents every write; check transaction handling in Task 3.
- Sample rows are real source rows; preview must count them so a teacher can remove or replace unwanted examples before commit.

---

### Task 1: Persist and display part of speech

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_word_part_of_speech/migration.sql`
- Modify: `apps/api/src/admin/admin-content.controller.ts`
- Modify: `apps/api/src/learning/learning.controller.ts`
- Modify: `apps/web/src/lib/learning.ts`
- Modify: `apps/web/src/app/wordbook/page.tsx`
- Modify: `apps/admin/src/app/content/page.tsx`
- Modify: `docs/DATA.md`

**Interfaces:** `Word.partOfSpeech: string | null`; API create/update accepts `partOfSpeech?: string | null`; wordbook response adds `partOfSpeech` without changing game/review rules.

- [ ] Add nullable `partOfSpeech` (`part_of_speech`) to `Word`. Run `pnpm exec prisma migrate dev --name word_part_of_speech --schema apps/api/prisma/schema.prisma` against the configured development DB, inspect the generated SQL for destructive statements, then run `pnpm prisma:generate`.
- [ ] Validate create/update values against the spec's ten stable codes; trim/normalize nullable input without changing existing words. Expose an editable POS control beside meaning in admin.
- [ ] Include POS in the authenticated wordbook response/type and show its Vietnamese label on word cards only when present.
- [ ] Run API/admin/web build checks after the migration; leave existing word rows and their nullable POS untouched.

### Task 2: Create the linked workbook

**Files:**

- Create: `apps/admin/public/templates/vocabulary-import-v1.xlsx`
- Modify: `docs/TECH.md` (template location and version contract)

**Interfaces:** `Huong dan!B2 = vocabulary-import-v1`. `Units` columns A:E are `grade_level, unit_number, unit_title, group_mode, unit_code`; `Categories` A:B are `category_code, category_title_vi`; `Words` A:K are `unit_code, grade_level, unit_title, lemma, meaning_vi, part_of_speech, category_1, category_2, category_3, category_4, category_titles`. Sample rows are part of these source ranges.

- [ ] Use bundled `@oai/artifact-tool` to author the `.xlsx`, with Vietnamese guidance, stable header IDs, and two or three sample rows in each input tab.
- [ ] Put `unit_code` formulas on `Units`, `INDEX/MATCH` lookup formulas in `Words`' derived columns, dropdowns for unit/category/POS/group mode, distinct input/calculated styles, and frozen headers. Provision formulas and validation for the exact capacities above. Protect formula columns if supported by the authoring path; verify actual protection before claiming it.
- [ ] Export to the admin public template path; inspect the workbook's sheet names, cells, formulas, validations, and sample rows with the spreadsheet tooling. Render representative regions on all tabs and inspect legibility. Make source rows beyond capacity visibly out of scope rather than leaving silently unvalidated input areas.

### Task 3: Parse, preview, and commit the import

**Files:**

- Modify: `apps/api/package.json`, `pnpm-lock.yaml` (add `exceljs` through pnpm)
- Create: `apps/api/src/admin/word-import.controller.ts`
- Create: `apps/api/src/admin/word-import.service.ts`
- Create: `apps/api/src/admin/word-import.parser.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `docs/TECH.md`

**Interfaces:** `POST /api/admin/word-import?mode=preview|commit` accepts multipart `file`. Both modes return `{ templateVersion, committed, counts: { unitsCreated, categoriesCreated, wordsCreated, wordsSkipped }, errors: Array<{ sheet, row, field, code, message }>, warnings: string[] }`. Preview is HTTP 200 even with row errors; commit with errors returns 422 and writes nothing.

- [ ] Add `exceljs` to the API package. Implement `parseVocabularyWorkbook(buffer: Buffer)` to verify `Huong dan!B2`, exact source headers, `.xlsx` type/size, row caps, and input cell types; reject formulas in editable cells and ignore derived columns.
- [ ] Normalize each unit, category, and word source row. Require one-to-four distinct category codes, `meaning_vi` length 1-120, valid POS/lemma, and unique source keys; resolve unit codes from `Units` rows, not formula caches. Blank `group_mode` means `single` only for a new unit and leaves an existing unit's mode unchanged.
- [ ] Implement `WordImportService.preview(parsed)` using batched DB reads and row-numbered conflict reports. Do not mutate data; calculate prospective counts and a warning for board mode without viable grouping content.
- [ ] Implement `WordImportService.commit(parsed)` to revalidate inside a serializable Prisma transaction, create missing units with all four activities, create missing categories, link new words, and skip existing words. Roll back on any validation or concurrency failure, returning a structured conflict response. Preserve locks, teacher edits, attempts, and media.
- [ ] Add `WordImportController` guarded by `AdminGuard`, `FileInterceptor('file')`, explicit MIME/ZIP and 2 MiB upload limit, and `mode` validation. Return structured report/error payloads the admin can render.
- [ ] Run API build and targeted non-file command-level probes for missing formula caches, duplicate keys, unknown references, invalid final row, and re-import. Verify DB counts remain unchanged on a failed commit. Do not create test files.

### Task 4: Admin import workflow and handoff

**Files:**

- Modify: `apps/admin/src/app/content/page.tsx`
- Modify: `apps/admin/src/app/global.css`
- Modify: `docs/PRODUCT.md`, `docs/UX.md`, `docs/TECH.md`, `docs/DATA.md`

**Interfaces:** Admin offers template download, file selection, Preview, row errors/warnings, and Confirm import only when preview has no errors. After commit, refresh affected unit/word data; do not conflate preview counts with committed counts.

- [ ] Add a focused import section near curriculum content. Support loading, wrong-file, preview-error, ready-to-import, committing, and success states with clear Vietnamese copy. Show row/sheet/field for each error and counts for creates/skips.
- [ ] Reset preview when the selected file changes. Send the same file again for commit; display server revalidation errors and never assume the earlier preview remains valid.
- [ ] Refresh admin grades/expanded words after a successful import. Keep existing lock/group-mode/meaning controls functional and avoid unrelated redesign.
- [ ] Update product/data/technical/UX docs for the workbook, POS, and manual image follow-up. Run `pnpm exec nx build api`, `pnpm exec nx build admin`, `pnpm exec nx build web`, and Prettier checks on edited text files; report any environment or runtime behavior not verified.

## Handoff

Deliver the workbook as an absolute file link and identify the admin URL. State exactly which checks ran. Do not claim Excel/OneDrive behavior or the admin upload interaction was manually verified unless that interaction was actually performed.
