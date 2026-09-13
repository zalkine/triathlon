# Triathlon Gal-On

Results-tracking and timing app for the Gal-On community triathlon. Bilingual (Hebrew/English), built with Next.js, Prisma, and SQLite.

## Who uses it

- **Public**: register for the race, view the live schedule and auto-ranked results — no login required.
- **Timekeepers**: log in and work a "station" (Check-In, or Start / Swim / Bike / Run timing), stamping times with one tap as competitors pass. Can't overwrite an already-stamped time (only a short "undo" window for a misclick) — except at the Start station, where a heat that was sent off by mistake or has to be run again can be reset with **Cancel start**.
- **Admins**: everything a timekeeper can do, plus open/close registration, run the group-formation lottery, generate the schedule, activate the competition, create/edit heats, manually correct any time, and manage staff accounts.

## Categories

Eight timed triathlon categories (defined in `src/lib/constants.ts`): Professional / Intermediate / Children 6–9 / Children 9–12, each as **Singles** (one person does the whole triathlon) or **Groups** (a 3-person relay: one swimmer, one biker, one runner). During registration the category is derived automatically from the participant's age, chosen skill level, and solo/relay choice.

Alongside them is the **Toddlers Run** (מרוץ קטנטנים) — a short fun run that only collects sign-ups. It's listed in `REGISTRATION_ONLY_CATEGORY_KEYS` in `src/lib/constants.ts`, which keeps it out of every race-day feature: no age is asked at registration, and it gets no check-in, no lottery, no heats, no schedule slot, no timing station and no ranked results. Its registrants show up on the public competitors list and in the admin's Registration roster (editable and exportable like any other), and nowhere else. To add another registration-only race later, add a category definition and put its key in that list.

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
4. **Deploy.** On each deploy Vercel runs `prisma migrate deploy && prisma db seed && next build`, which applies the schema and seeds the categories + your admin account (idempotent — re-deploying never wipes data or resets a changed admin password; a newly added category is simply inserted alongside the existing registrations).
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
   - The swim and bike stations drop a competitor off the list once stamped. The **finish line** instead keeps everyone on screen: a stamped competitor stays in place and turns grey with their recorded time, so the list never reshuffles under the timekeeper's thumb and they can see who they've already taken (a short undo window still applies).
   - The finish list is ordered by category (race order) and then A–Z by the name shown on the card — the runner's name for a relay — using the viewer's locale collation, so Hebrew sorts as Hebrew. The order never depends on who has been stamped.
   - Finish-line cards are colour-coded per category (`CATEGORY_COLOR_CLASS` in `src/lib/constants.ts`, tints in `globals.css`), and a chip row filters the list by category — chips toggle, so a volunteer can cover one race or several at once (an empty selection means the whole field). The selection is remembered per device, and a banner says how many waiting competitors it's hiding.
9. `/results` ranks competitors live within their category (fastest total time first) as soon as both a start and a finish time exist.
10. If a heat has to be started over — a false start, a missing competitor, anything that goes wrong on the course — **Cancel start** puts it back on the start line. It's on the running-heat card at the Start station, on the admin's Heats board, and on the heat's own page. It clears only that heat's clock and the leg times measured against it (those would otherwise rank against a start that never happened); the heat, its roster and every registration are left untouched, and the start-line timekeeper simply confirms the roster and taps **Start Now** again.
11. If a time was mis-stamped, an admin can correct it directly on the heat's page (`/staff/manage/heats/[heatId]`).

Heats can also be created and populated manually from `/staff/manage` if you'd rather not use self-registration + lottery for a given category.

## Notes

- Role/type/leg fields are stored as plain strings constrained by `src/lib/constants.ts` (kept simple rather than DB enums).
- `public/logo.svg` is a close recreation of the community's logo (chat-attached images aren't accessible as files to this tooling) — swap in the original artwork there for pixel-perfect branding.
