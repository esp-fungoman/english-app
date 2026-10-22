# Security for the pilot

## Authentication

Exactly one admin is configured by `ADMIN_USERNAME` / `ADMIN_PASSWORD`. No admin registration, roles, session database, or account-management UI is introduced. `admin_session` is HMAC-signed using `ADMIN_SESSION_SECRET` plus the current credentials; it expires after eight hours. The old `admin_ok=1` cookie never authenticates. Changing credentials or the secret invalidates existing admin cookies.

StudentGuard remains a signature/expiry check that attaches the student ID without querying the database. Student cookies last 30 days. Controllers enforce record ownership, current grade, locked-unit rules and recorded-answer semantics. Logout clears the browser cookie; copied cookies remain valid until expiry or secret rotation.

Cookies are HttpOnly, SameSite=Lax, host-only, Path=/, Secure in production. Use HTTPS Web, Admin and API under the same registrable domain in production. Unrelated hosting-provider domains require a separate cookie/topology design; do not switch to SameSite=None without revisiting CSRF and browser third-party cookie restrictions.

Production requires valid `WEB_ORIGIN`, `ADMIN_ORIGIN`, independent admin/student secrets of at least 32 characters, non-default admin credentials and `REDIS_URL`. Generate secrets with a cryptographically secure generator; never copy example credentials into production. `RATE_LIMIT_SECRET` optionally overrides the admin secret for HMAC-hashed rate-limit identities. No secrets belong in NEXT_PUBLIC variables.

## Requests and errors

API CORS allows only the exact two configured origins (no trailing slash). Every unsafe request requires `X-App-Request: 1` and the correct Origin: admin routes use ADMIN_ORIGIN, student/game routes WEB_ORIGIN. This includes login, register, logout, heartbeat and multipart import. CLI callers must send these headers and still authenticate normally. Header/Origin checks are CSRF protection, not authentication. Direct R2 PUTs omit application cookies and headers.

JSON is limited to 256 KiB. Input nesting, array counts and string lengths are bounded. Workbook import accepts one file, 2 MiB compressed, at most 200 ZIP entries and 20 MiB actual uncompressed content; encrypted/invalid archives and ten-second decompression timeouts are rejected before ExcelJS. Existing spreadsheet row/formula validation stays in place.

Errors never return server exception messages or stack traces for 5xx. API responses use no-store. Logs contain generated request IDs, broad route groups, method, status, duration and rate-limit availability events; no query strings, raw request bodies, cookies, credentials or signed URLs. Existing Nest startup logs still identify registered routes.

Helmet and frontend headers provide nosniff, iframe denial, restricted browser features and referrer policy. Strict CSP is intentionally deferred; local Lottie/WASM and blob image previews continue to work.

## Redis and rate limits

Set `REDIS_PASSWORD` and `REDIS_URL` in your local .env. URL-encode special characters in REDIS_URL passwords. Start Redis for the host-run API:

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d redis
```

Base Compose does not publish Redis. The local override binds only 127.0.0.1:6379. A production container API must join `redis_private` and use `redis:6379`; omit the local override. The supplied Compose is not a complete production deployment. Redis uses authentication, AOF/volume, 128 MiB maxmemory, noeviction and a 256 MiB container limit. PostgreSQL's local port binds loopback as well. Redis is only security counters and locks, never the source of student data. A Redis restart can lose recent increments not yet persisted to AOF.

Counts use atomic fixed-window counters with TTL, shared by API processes. Current windows and env overrides:

- `RATE_LIMIT_LOGIN_PAIR=10`: per route family, normalized username and IP, 15 minutes. `RATE_LIMIT_LOGIN_IP=300`: all logins per IP, 15 minutes.
- `RATE_LIMIT_REGISTER_HOUR=30`, `RATE_LIMIT_REGISTER_DAY=100`: per IP.
- `RATE_LIMIT_UPLOAD_STUDENT=10`, `RATE_LIMIT_UPLOAD_ADMIN=120`: signed-URL requests per verified identity, one hour.
- `RATE_LIMIT_IMPORT=5`: per verified admin, one minute; an atomic 120-second lock prevents simultaneous imports. If the client disconnects, retain the lock until its TTL because parsing/transactions may still execute.
- `RATE_LIMIT_USER=300`: all API requests per verified identity per minute.
- `RATE_LIMIT_MEDIA=600`: media requests per IP per minute.
- `RATE_LIMIT_IP=3000`: all requests per IP per minute.

GET/HEAD /api/health does not access Redis. Limits return 429 and Retry-After in seconds. Redis commands/connect time out after 500 ms and do not queue requests or retry indefinitely. During Redis failure, login/register/presign/import return 503; other requests use a bounded 10,000-key in-process TTL map. This degraded limiter is per-process, not distributed. A full map conservatively rejects new identities. Recovery is logged when a Redis operation next succeeds.

`TRUSTED_PROXIES` defaults to none. Set explicit trusted proxy IPs/CIDRs only after verifying the deployment chain; never use a boolean, numeric hop count, or all-address CIDR. Ensure proxies overwrite forwarded headers and prevent direct origin access. Do not trust CF-Connecting-IP from arbitrary clients. Incorrect proxy setup may collapse a classroom into one IP or allow spoofing; verify it on the deployed network before release.

## R2 and media policy

Keep the existing presign → direct PUT → save-key workflow, a private bucket and ten-minute PUT URLs. UI and upload helpers accept JPEG/PNG/WebP/GIF up to 5 MiB. MIME and size are **not** fully enforced against malicious direct uploads; presigned PUTs may be reused until expiry. No completion API, image decoding, upload receipts or new migration is added.

Public `/api/media?key=...` only signs keys currently referenced by Word.imageKey/audioKey. Avatar requests additionally require the owning student's valid signed cookie and a matching saved Student.avatarKey. The avatar namespace is checked first so a vocabulary reference cannot expose an avatar. Unknown/unreferenced keys return 404. Admin vocabulary writes cannot attach avatar keys. Existing referenced legacy non-avatar uploads stay readable; known legacy avatar keys remain accessible only to their owner.

Upload/save errors keep selected files and uploaded keys for retries. Bucket lifecycle cleanup, file-byte validation, image decompression protection, immutable final objects, malware scanning and strict CSP are deferred. Use rate limits and monitor R2 usage; client size limits do not cap storage bills. See R2.md for account credentials and bucket CORS.

## Release and rollback

Ship API and both frontends together because older clients lack X-App-Request. Configure env/Redis before release. No schema migration is needed. Back up configuration; avoid rolling back to the unsigned admin-cookie implementation. Secret rotation intentionally logs users out. Do not bypass security when Redis is unavailable: restore Redis and use the documented degraded behavior.

Verification should cover forged/expired/cross-role cookies; cross-origin and missing-header requests; cross-student ownership; rate-limit concurrency/shared counters and Redis failure/recovery; oversized/malformed XLSX; avatar privacy; all existing student/admin workflows at mobile and desktop widths. Build/typecheck do not prove browser behavior, live R2 access or production proxy correctness. Record only checks actually performed in the delivery summary.
