# Triathlon Gal-On

Results-tracking and timing app for the Gal-On community triathlon. Bilingual (Hebrew/English), built with Next.js, Prisma, and SQLite.

## Who uses it

- **Public**: register for the race, view the live schedule and auto-ranked results — no login required.
- **Timekeepers**: log in and work a "station" (Check-In, or Start / Swim / Bike / Run timing), stamping times with one tap as competitors pass. Can't overwrite an already-stamped time (only a short "undo" window for a misclick).
- **Admins**: everything a timekeeper can do, plus open/close registration, run the group-formation lottery, generate the schedule, activate the competition, create/edit heats, manually correct any time, and manage staff accounts.

## Categories

Eight fixed categories (defined in `src/lib/constants.ts`): Professional / Intermediate / Children 6–9 / Children 9–12, each as **Singles** (one person does the whole triathlon) or **Groups** (a 3-person relay: one swimmer, one biker, one runner). During registration the category is derived automatically from the participant's age, chosen skill level, and solo/relay choice.

## Deploying to Vercel (recommended)

This app is built to deploy to [Vercel](https://vercel.com) with a hosted Postgres database. No server to manage; it scales fine for ~600 users on the free tier.

1. **Create a Postgres database.** The easiest is Vercel's built-in Postgres (powered by Neon): in your Vercel project, go to **Storage → Create Database → Postgres**. It automatically adds the connection env vars to the project. Alternatively create a free DB at [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com) and copy its connection strings.
2. **Import the repo into Vercel** (New Project → import `zalkine/triathlon`). Vercel auto-detects Next.js; no build settings to change — the `vercel-build` script handles migrations + seeding automatically.
3. **Set these Environment Variables** in the Vercel project (Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Postgres **pooled** connection string (Neon/Vercel provide this) |
   | `DIRECT_URL` | Postgres **direct/unpooled** connection string (used only for migrations). If your provider gives only one URL, use the same value for both. |
   | `AUTH_SECRET` | A long random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `SEED_ADMIN_USERNAME` | e.g. `admin` |
   | `SEED_ADMIN_PASSWORD` | your chosen initial admin password |

   > If you used Vercel's built-in Postgres, it may name the vars `POSTGRES_PRISMA_URL` (pooled) and `POSTGRES_URL_NON_POOLING` (direct). Just set `DATABASE_URL` = the pooled one and `DIRECT_URL` = the non-pooling one.
4. **Deploy.** On each deploy Vercel runs `prisma migrate deploy && prisma db seed && next build`, which applies the schema and seeds the 8 categories + your admin account (idempotent — re-deploying never wipes data or resets a changed admin password).
5. Open your `*.vercel.app` URL. **Log in at `/login` and change the admin password** via Staff Accounts before the event.

## Running locally

Local dev also uses Postgres. Point `.env` at any Postgres (a free Neon dev branch, or a local Docker one: `docker run -e POSTGRES_PASSWORD=pw -p 5432:5432 postgres`).

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL / DIRECT_URL / AUTH_SECRET / SEED_ADMIN_PASSWORD
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open http://localhost:3000 — it redirects to `/he` (Hebrew) by default; switch to English via the header toggle. Default login: `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` from `.env`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres pooled connection string (runtime queries) |
| `DIRECT_URL` | Postgres direct/unpooled connection string (migrations) |
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

- Role/type/leg fields are stored as plain strings constrained by `src/lib/constants.ts` (kept simple rather than DB enums).
- `public/logo.svg` is a close recreation of the community's logo (chat-attached images aren't accessible as files to this tooling) — swap in the original artwork there for pixel-perfect branding.
