# Railway

Create project with services:

1. Postgres plugin
2. Railway Storage Bucket — private image storage via the S3 API (Cloudflare R2 is also supported; see `docs/R2.md`)
3. `api` — root `/`, build `pnpm exec nx build api`, start `node apps/api/dist/main.js` (adjust to Nx output)
4. `web` — `nx build web`, Next start, `NEXT_PUBLIC_API_URL`
5. `admin` — `nx build admin`

Env on api: `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `WEB_ORIGIN`, `ADMIN_ORIGIN`.

CORS on the API must list both frontend public URLs.

## Image storage

The existing vocabulary and student-avatar flows support Railway through `BUCKET_*`. Add these variables to the root `.env` for local development, or to the API service environment when deploying:

```dotenv
BUCKET_ENDPOINT=https://t3.storageapi.dev
BUCKET_REGION=auto
BUCKET_NAME=<S3 bucket name from the Credentials tab>
BUCKET_ACCESS_KEY_ID=<access key id>
BUCKET_SECRET_ACCESS_KEY=<secret access key>
BUCKET_FORCE_PATH_STYLE=false
```

Use the exact endpoint from the bucket's Credentials tab. Railway normally uses virtual-hosted URLs (`https://<bucket>.t3.storageapi.dev/...`); older buckets may require `BUCKET_FORCE_PATH_STYLE=true`. See [Railway Storage Buckets](https://docs.railway.com/storage-buckets).

Keep all `R2_*` values empty when selecting Railway: a nonempty R2 setting selects the complete R2 configuration instead. Credentials stay server-side and must never be committed or placed in `NEXT_PUBLIC_*`. Restart the API after changing `.env`; deployed services need the same configuration in Railway Variables.

Configure bucket CORS separately for the Web and Admin origins. The S3 CORS JSON in `config/cloudflare/r2-cors.local.json` also works with Railway's `PutBucketCors` operation. It allows local origins `http://localhost:3000` and `http://localhost:3001`; add the deployed frontend origins before production use.

Admin images use `POST /api/admin/uploads/presign`; avatars use `POST /api/student/uploads/presign`. The browser then PUTs the image to the signed URL with the returned `Content-Type`, without application cookies or `X-App-Request`, and saves the object key through the existing word/profile endpoint. `/api/media?key=...` returns a signed GET URL for saved media. The bucket stays private; no schema change is needed.

## Vocabulary library release (fresh database)

This release expects a fresh deployment database. The new migration deliberately refuses to run when legacy `words` rows exist; it never resets a database automatically. Provision/reset the target database through the deployment workflow before applying the migration chain. Do not apply the new application binaries against the old schema.

Run `pnpm exec prisma generate --schema=apps/api/prisma/schema.prisma` during build and `pnpm exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma` in the release phase, before starting the application. The migration initializes grades 1–5; `pnpm prisma:seed` is also idempotent and only initializes those grades. No sample vocabulary is seeded.

Create/import vocabulary and units in Admin, then set opening dates. Unscheduled units are locked. Dates entered in Admin use Asia/Ho_Chi_Minh and are stored in UTC. No scheduling worker is required. Storage credentials and bucket CORS remain required for image uploads.

Verification for this change is limited to production builds of API, Admin and Web. Database migrations, deployment, import, upload and browser behavior have not been executed as verification.
