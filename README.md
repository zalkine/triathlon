# Triathlon Gal-On

Results-tracking and timing app for the Gal-On community triathlon. Bilingual (Hebrew/English), built with Next.js, Prisma, and SQLite.

## Who uses it

- **Public**: view live, auto-ranked results at `/results` — no login required.
- **Timekeepers**: log in and work a "station" (Start / Swim / Bike / Run), stamping times with one tap as competitors pass. Can't overwrite an already-stamped time (only a short "undo" window for a misclick).
- **Admins**: everything a timekeeper can do, plus create heats, add/remove competitors and teams, manually correct any time, and manage staff accounts.

## Getting started

```bash
npm install
cp .env.example .env   # then edit AUTH_SECRET / SEED_ADMIN_PASSWORD
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open http://localhost:3000 — it redirects to `/he` (Hebrew) by default; switch to English via the header toggle.

The seed script creates the 8 competition categories and one `ADMIN` account (`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` from `.env`, default `admin` / `changeme`). **Change the seeded admin password** (via `/staff/users` after first login, or by re-seeding with a new `SEED_ADMIN_PASSWORD`) before running a real event.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path (default `file:./dev.db`) |
| `AUTH_SECRET` | Secret used to sign staff session tokens — use a long random string in production |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | Initial admin account created by `prisma db seed` |

## Race-day flow

1. An admin creates a **heat** per category (`/staff/manage/heats/new`) and adds the registered competitors/teams to it.
2. Timekeepers log in and each picks their **station** (`/staff/stations`): one person works the Start line, one the pool/swim exit, one the bike-in, one the finish line.
3. When a heat is ready to go, the Start-station timekeeper taps "Start Now" — this stamps the heat's start time.
4. As competitors pass each station, that station's timekeeper searches for the name and taps to stamp the time.
5. `/results` ranks competitors live within their category as soon as both a start and a finish time exist.
6. If a time was mis-stamped, an admin can correct it directly on the heat's page (`/staff/manage/heats/[heatId]`).

## Notes

- The Prisma schema targets SQLite, which has no native enum support — role/type/leg fields are plain strings constrained by `src/lib/constants.ts`.
- `public/logo.svg` is a close recreation of the community's logo (chat-attached images aren't accessible as files to this tooling) — swap in the original artwork there for pixel-perfect branding.
