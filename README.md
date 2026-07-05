# Triathlon Gal-On

Results-tracking and timing app for the Gal-On community triathlon. Bilingual (Hebrew/English), built with Next.js, Prisma, and SQLite.

## Who uses it

- **Public**: register for the race, view the live schedule and auto-ranked results — no login required.
- **Timekeepers**: log in and work a "station" (Check-In, or Start / Swim / Bike / Run timing), stamping times with one tap as competitors pass. Can't overwrite an already-stamped time (only a short "undo" window for a misclick).
- **Admins**: everything a timekeeper can do, plus open/close registration, run the group-formation lottery, generate the schedule, activate the competition, create/edit heats, manually correct any time, and manage staff accounts.

## Categories

Eight fixed categories (defined in `src/lib/constants.ts`): Professional / Intermediate / Children 6–9 / Children 9–12, each as **Singles** (one person does the whole triathlon) or **Groups** (a 3-person relay: one swimmer, one biker, one runner). During registration the category is derived automatically from the participant's age, chosen skill level, and solo/relay choice.

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

## End-to-end flow

### Before the event — registration & lottery
1. Participants **register** themselves at `/register`: name, age, whether they're doing the whole triathlon solo or joining a relay group, and — for a relay group — which leg(s) they're willing to swim/bike/run (multiple allowed). The category is derived automatically from age + skill level + solo/group.
2. When registration closes, an admin **closes registration** and runs **"Run Lottery & Generate Schedule"** from the management dashboard (`/staff/manage`). This randomly forms complete swim+bike+run relay teams from the checked-in group registrants, places solo competitors, packs everyone into heats (max 8 per heat — the pool's lane capacity), and computes an estimated start time for every heat in race order.
3. Anyone the lottery couldn't fit into a full team appears under **Unassigned Registrants**, where an admin can drop them onto an existing team's open leg. Admins can re-run the lottery at any time to place people who checked in later (already-placed people are left untouched).

### On race day
4. Participants arrive and a check-in volunteer marks them **arrived** at the Check-In station (`/staff/checkin`) — searchable by name. Only checked-in participants are included when the lottery/schedule runs.
5. The published **schedule** is visible live to everyone at `/schedule`, showing every heat in order with its estimated start time.
6. When everything's ready the admin taps **"Activate Competition"** — this turns the timing stations live for all timekeepers.
7. Timekeepers each pick their **station** (`/staff/stations`): Start line, pool/swim exit, bike-in, finish line. When a heat is called, the Start-station timekeeper announces "on your marks… GO!" and taps **Start Now**, stamping the heat's start time and beginning the clock.
8. As competitors reach each downstream station, that timekeeper searches for the name/team and taps to stamp the time. Finish-line stamps are the ones that determine the overall time.
9. `/results` ranks competitors live within their category (fastest total time first) as soon as both a start and a finish time exist.
10. If a time was mis-stamped, an admin can correct it directly on the heat's page (`/staff/manage/heats/[heatId]`).

Heats can also be created and populated manually from `/staff/manage` if you'd rather not use self-registration + lottery for a given category.

## Notes

- The Prisma schema targets SQLite, which has no native enum support — role/type/leg fields are plain strings constrained by `src/lib/constants.ts`.
- `public/logo.svg` is a close recreation of the community's logo (chat-attached images aren't accessible as files to this tooling) — swap in the original artwork there for pixel-perfect branding.
