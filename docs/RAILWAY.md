# Railway

Create project with services:

1. Postgres plugin
2. Cloudflare R2 bucket — image storage via the S3 API; see `docs/R2.md`
3. `api` — root `/`, build `pnpm exec nx build api`, start `node apps/api/dist/main.js` (adjust to Nx output)
4. `web` — `nx build web`, Next start, `NEXT_PUBLIC_API_URL`
5. `admin` — `nx build admin`

Env on api: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `WEB_ORIGIN`, `ADMIN_ORIGIN`.

CORS must list both frontend public URLs. R2 credentials belong in the API service environment: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY. Configure bucket CORS separately for both frontend public URLs; see `docs/R2.md`.

## Vocabulary library release (fresh database)

This release expects a fresh deployment database. The new migration deliberately refuses to run when legacy `words` rows exist; it never resets a database automatically. Provision/reset the target database through the deployment workflow before applying the migration chain. Do not apply the new application binaries against the old schema.

Run `pnpm exec prisma generate --schema=apps/api/prisma/schema.prisma` during build and `pnpm exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma` in the release phase, before starting the application. The migration initializes grades 1–5; `pnpm prisma:seed` is also idempotent and only initializes those grades. No sample vocabulary is seeded.

Create/import vocabulary and units in Admin, then set opening dates. Unscheduled units are locked. Dates entered in Admin use Asia/Ho_Chi_Minh and are stored in UTC. No scheduling worker is required. R2 credentials and bucket CORS remain required for image uploads.

Verification for this change is limited to production builds of API, Admin and Web. Database migrations, deployment, import, upload and browser behavior have not been executed as verification.
