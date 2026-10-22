# AGENTS

Repo contract. Product details live in `docs/`. Read those before changing curriculum, metrics, or UX.

## Layout

- `apps/web` — student Next.js (mobile and classroom-readable desktop, games)
- `apps/admin` — CMS Next.js
- `apps/api` — NestJS + Prisma
- `libs/shared` — enums / DTOs only
- `docs/` — PRODUCT, TECH, DATA, ACTIVITIES, UX

pnpm + Nx. Do not add npm/yarn lockfiles. Do not add a new app without asking.

```bash
pnpm exec nx serve api
pnpm exec nx serve web
pnpm exec nx serve admin
```

Student auth: username + password with a signed, expiring cookie. Registration requires name and grade; school and class are optional. Admin login is env `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

Student UI must work on both phones and wide desktop/TV displays. Desktop is a genuine responsive layout, not a phone-sized card centered on a decorative stage. Reflow content and enlarge readable type/targets for classroom display while keeping the same student flow and mobile usability. See `docs/UX.md` and `.cursor/rules/web-duo-vibe.mdc`.
