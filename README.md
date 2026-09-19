# Triathlon Gal-On

Results-tracking and timing app for the Gal-On community triathlon. Bilingual (Hebrew/English), built with Next.js, Prisma, and SQLite.

## Who uses it

- **Public**: register for the race, view the live schedule and auto-ranked results — no login required.
- **Timekeepers**: log in and work a "station" (Check-In, or Start / Swim / Bike / Run timing), stamping times with one tap as competitors pass. Can't overwrite an already-stamped time (only a short "undo" window for a misclick) — except at the Start station, where a heat that was sent off by mistake or has to be run again can be reset with **Cancel start**.
- **Admins**: everything a timekeeper can do, plus open/close registration, run the group-formation lottery, generate the schedule, activate the competition, create/edit heats, combine heats from different categories into a single start, race two children's age brackets as one category, manually correct any time, and manage staff accounts.

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
   - Finish-line cards are colour-coded per category (`CATEGORY_COLOR_CLASS` in `src/lib/constants.ts`, tints in `globals.css`), and a chip row filters the list by category — chips toggle, so a volunteer can cover one race or several at once (an empty selection means the whole field). The selection is remembered per device, and a banner says how many waiting competitors it's hiding.
9. `/results` ranks competitors live within their category (fastest total time first) as soon as both a start and a finish time exist.
10. If a heat has to be started over — a false start, a missing competitor, anything that goes wrong on the course — **Cancel start** puts it back on the start line. It's on the running-heat card at the Start station, on the admin's Heats board, and on the heat's own page. It clears only that heat's clock and the leg times measured against it (those would otherwise rank against a start that never happened); the heat, its roster and every registration are left untouched, and the start-line timekeeper simply confirms the roster and taps **Start Now** again.
11. If a time was mis-stamped, an admin can correct it directly on the heat's page (`/staff/manage/heats/[heatId]`).

Heats can also be created and populated manually from `/staff/manage` if you'd rather not use self-registration + lottery for a given category.

### After the race — substitutions, approval & publishing

Results are provisional until an admin says otherwise. `/results` only opens to
the public once the admin has **both** approved the timekeepers' numbers and set
them visible (`resultsPubliclyVisible` in `src/lib/season.ts`, shared by the
results API, the admin's review panel and the home page so all three agree on
what "published" means).

The Scores tab (`src/components/manage/ScoresPanel.tsx`) is where that review
happens, and everything a result is made of is editable there, before anything
reaches the public:

- **who raced** — a competitor's name, or a relay's swim / bike / run leg on its
  own (see the stand-in note below);
- **the leg times** — swim, bike and finish, tapped and corrected against the
  camera or the manual record;
- **the heat's start time**, in the strip above each field's table. A total is a
  finish minus its heat's start, so this is the other half of correcting a time;
  it belongs to the heat rather than to one competitor, and it follows a
  combined start across every heat that left on the same gun;
- **who is in the results at all** — take someone out (they didn't race, or
  shouldn't be ranked) or put back anyone scratched at the start line. It writes
  the same `scratched` flag the start line uses, so the two screens can't
  disagree, and it touches nothing else: the competitor keeps their place in the
  heat and any times already recorded.

Rank, total time and status are deliberately *not* typed in — they are worked
out from the times, so a rank can never contradict the clock. Correct a time and
they follow. Anything that belongs to the heat rather than to the result —
adding a competitor who never made it into a heat, moving one between heats,
deleting a row outright — is one tap away: the heat name under each competitor
links to that heat's page.

Editing a name is how a **stand-in** is recorded: someone falls ill on the
morning of the race and a volunteer takes their place, which nobody has time to
write down until the racing is over. Tap the name on the result row — a solo
competitor's name, or a relay's swim / bike / run leg individually — and type
whoever actually raced.

A substitution is not a rename. The roster is the source of truth (the Heats tab
reconciles heat entries against it, see `syncHeatsWithRoster`), so a rename alone
would be quietly undone and the person who never raced would be back on the
result. `substituteCompetitor` in `src/actions/entries.ts` therefore moves the
roster with it: the stand-in takes over the group leg (or the solo place) as a
checked-in registrant, and the competitor who dropped out is unlinked from the
race. Their registration itself is left alone — they signed up, so they stay on
the roster, simply unplaced. From there the swap carries through to the public
results, the CSV/Excel downloads and the Hall of Fame import on its own, and the
relay's team name is rebuilt from its legs in race order. Times are never touched:
the clock measured the race that was run, whoever ran it.

Publishing is also what puts the year in the **Hall of Fame**. The finished
results are copied into `HistoricalResult` (`importResultsToHof` in
`src/lib/hofImport.ts`), where they join every previous year and are read exactly
the same way — which is the whole point: a visitor sees 2026 the way they see
2023. Corrections made after publishing follow on their own: the handful of
actions that can change a published result call `syncPublishedResultsToHof`,
which re-imports the year and is a no-op while the results are still under
review. The Scores tab keeps a manual re-import button for running a year again
deliberately.

A year is imported per *racing field* rather than per stored category, so age
brackets an admin merged arrive once, under the merged name, ranked as they
actually raced. Re-importing clears every label this year's categories could
have written — the merged names and the individual bracket names alike — so
turning a merge on or off between two imports can't leave a stale copy behind;
rows an admin added by hand under another label are untouched.

The **leg splits** travel with the results (`swimSeconds` / `bikeSeconds` /
`runSeconds` on `HistoricalResult`): the swim measured from the heat's start,
then each leg from the one before it, which is the same reading as the results
CSV's split columns. They are nullable because they are often unknown — the
2018–2023 sheets record finishing times only, and a race can be timed at the
finish line alone — so every screen that offers them checks first. `/results`
and each year of the Hall of Fame's full listing carry a **Show split times**
button, shown only where there is something behind it; the finishing time stays
the whole row until it is pressed.

Two things make re-importing safe on a year that is already closed. The importer
falls back to that year's `CompetitionArchive` snapshot when the live tables are
empty, rebuilding the same rows with the same ranking function — which is how a
closed year picks up a column the Hall of Fame gained afterwards. And an import
that finds nothing at all to write changes nothing: clearing a year and putting
nothing back would turn a mistimed re-run into the silent loss of a whole
competition.

Once the results are published the **home page turns around**. Until then it
counts down to the race — save the date, register now. Afterwards it becomes the
way back to it: the name of the event, this year's results, the Hall of Fame, and
a "stay tuned" note where the date used to be, since next year's hasn't been set.
The year on the results link comes from the race's own start time, not from
today, so it still reads "2026 Results" when the village opens the page the
following January.

### Closing a competition

When the year is done the admin presses **Close the competition** (Scores tab,
available once the results are published). `closeCompetition` in
`src/actions/competition.ts`:

1. re-imports the results to the Hall of Fame, so the public record matches the
   season down to the last late correction;
2. copies the whole season — the roster, the relay groups, every heat with its
   entries and recorded leg times, the category line-up, the contacts, the info
   pages and the settings as they stood — into a `CompetitionArchive` row;
3. empties the operational tables and resets `EventSettings`, so the management
   screens start the next competition clean;
4. records the year in `EventSettings.closedYear`.

**Nothing is deleted from the database** — that is what the archive is for. A
mistake found afterwards is corrected in SQL: the results in `HistoricalResult`
(an ordinary table), everything else in the archive row's JSON snapshot. There
is deliberately no screen for editing a closed year.

The archive is a JSON snapshot rather than a set of mirror tables on purpose:
nothing in the app reads it, so mirror tables would only drift away from the live
schema they copy. It is also why no query anywhere needed an "archived" filter —
the operational tables simply go back to empty, which is the state every screen
already handles.

What closing does **not** touch: the categories (the same line-up races next
year, so only this year's age-bracket merges are undone), staff accounts, the
contact directory, the trail descriptions and the Hall of Fame. The competition
info page is unpublished, since it describes a competition that is over.

`closedYear` is what the public site reads once a season is archived. The home
page keeps its post-race face and points "2026 Results" at
`/hall-of-fame#year-2026` instead of the live results page, which now has nothing
to rank and says so with a link to the same place. **Opening registration clears
`closedYear`** — that is the moment the next competition begins, and the home
page goes back to counting down.

### Combined starts — filling the pool from two categories at once

Categories that only drew three or four competitors would each take a whole turn of the pool with most lanes empty. On the admin's Heats board (`/staff/manage`, Heats tab) an admin — and only an admin — can tick heats from **different categories** and **combine them into one start**. Heats sharing a start carry the same `Heat.waveId`, and from then on:

- the Start station shows them as **one card** with every roster on it and a single **GO**, so all of them take the same gun time (a wave can never end up with two different start times: start, quick-undo, cancel-start and an admin's manual start-time correction all apply to the whole wave);
- the schedule gives the wave **one slot**, lasting as long as the slowest category in it, and tells competitors which other races share their start;
- **nothing about results changes** — a heat still belongs to exactly one category, so every competitor is ranked only within their own category. Combining is purely about who is in the water together.

### Placing competitors without the schedule generator

`generateSchedule` packs a whole field at once, which is right before the event and wrong after it: an admin who has arranged the running order by hand loses it to a rebuild. Anyone who registers after the heats are built therefore has no way to reach a heat — the gap that makes the Registration tab's group count exceed what the Heats board shows.

The Heats tab lists them under **Registered but not in a heat** (`waitingForHeats` in `src/lib/placement.ts`), and `src/actions/placement.ts` places them: `placeWaitingCompetitors` fills the spare lanes of existing heats and then appends heats for the rest, `placeInHeat` puts one team or competitor into a chosen heat, and `addHeatToField` makes somewhere to put them. All three only ever *add* — no existing heat or entry is moved, renamed or deleted — and they share the pool-capacity guard, so overfilling still takes a confirmation.

Placement helpers live in `src/lib/placement.ts` and are shared with `generateSchedule`, so a heat entry is created identically whichever route places it. A competitor whose name already appears in a heat of the same field is flagged rather than placed automatically, so a bulk press can't enter someone twice.

### Racing two age brackets as one category

Different from a combined start: that puts two categories in the water together but keeps their rankings apart. **Merging** makes them one race — one field, one ranked list, one podium.

On the admin's Heats tab, **Race two age brackets as one category** offers exactly the pairs that may be joined. A merge is deliberately narrow: only categories of the same race differing by age bracket, which `MERGE_FAMILY` in `src/lib/constants.ts` spells out (children's singles 6-9 with 9-12, children's relays 6-9 with 9-12). Professional and intermediate are skill levels rather than age bands, and singles and relays are different races, so neither can be merged — the action refuses. Admin-only, like combining starts.

The absorbed bracket points at the one that keeps the racing via `Category.mergedIntoId`, and from then on the pair is packed into shared heats, scheduled as one slot (taking the slower bracket's pool time), and ranked as a single list. The merged field is named by dropping the age range from the bracket names, so "Children – Singles 6-9" + "Children – Singles 9-12" races as "Children – Singles".

Every screen that shows the *race* follows the merge: the public competitors list, the schedule, the check-in station, the start line, results, the admin's scores review and the heats/results CSVs. The two screens that deliberately keep the real brackets are **registration** (the bracket is derived from age, so it has to stay) and the admin's **Registration roster** (where an admin manages who is in which bracket); the competitors CSV shows both, as `Category` and `Races as`.

**Registration is untouched** — a 7-year-old still registers under 6-9 — which is what makes a merge reversible by clearing one field. Splitting back restores two independent rankings with nobody re-registering. Both are refused once anything has been timed, since they re-rank results.

Neither merging nor splitting deletes a heat. Heats stay exactly as they are — the schedule generator's or an admin's own hand-built running order — because every screen reads a heat through the field its category races in, so heats still filed under an absorbed bracket appear under the merged field. Only auto-generated `Heat N` names are renumbered (so a merged field doesn't show two "Heat 1"s); a heat named by hand keeps its name. An admin who *does* want the brackets repacked into shared heats can run the schedule generator afterwards, and one who organises heats manually can simply move competitors between them.

### The pool's lane count

`HEAT_CAPACITY` (8) is a physical limit, not a rule the app enforces behind the user's back. The lottery packs heats at 8, and **every** way of putting someone into a heat afterwards — dragging on the Heats board, either "move to" menu, adding a name at the start line or on the heat page, and combining heats into one start — checks it the same way (`src/lib/heats.ts`): if the placement would put more than 8 in the water at once it is refused and reported, and the caller confirms before retrying with `force`. So a 9th swimmer is always possible (a shared lane, a heat of likely no-shows) and never accidental. Scratched competitors don't count — they aren't taking a lane — and for a combined start the count spans the whole wave, not the single heat.

A heat deliberately filled past 8 is treated like a started or combined one: `generateSchedule` won't repack that category, so re-running the lottery no longer throws the arrangement away.

Combining is capped the same way; going over it takes an explicit confirmation. Heats that have already been sent off can't be combined, a combined start can be split apart again at any time (rosters and times untouched), and re-running the lottery preserves the arrangement — latecomers go into a fresh heat rather than enlarging a wave the admin has already sized.

## Admin downloads

Every admin list can be taken away from `/staff/manage`, either as one Excel workbook or as individual CSVs:

- **All lists (Excel)** — on the Registration and Scores tabs. One `.xlsx` with a sheet each for Competitors, Teams, Heats, Results, Contacts and Hall of Fame. Header rows are bold and frozen and columns are pre-sized.
- **Per-list CSVs** — at the foot of each tab: competitor list and relay teams (Registration), heat list (Heats and Schedule), results (Scores), contacts (Staff), hall of fame (Hall of Fame).

The competitor list carries a **Heat** column showing where each person has been placed, or `not placed` if they haven't been — so after arranging heats by hand (with or without the schedule generator) the download doubles as the check that nobody was missed. Relay members get their team's heat.

Both formats come from the same row builders in `src/lib/exports.ts`, so a column added once shows up in the CSV and the workbook together. The relay-teams list is built from the groups themselves rather than from heats, so team sheets can be printed while groups are still being arranged, before the lottery has run.

The `.xlsx` is written by `src/lib/xlsx.ts` — a small dependency-free writer (an xlsx is a ZIP of XML parts), which keeps a spreadsheet library out of the bundle. CSVs are UTF-8 with a BOM so Excel opens Hebrew correctly.

## Notes

- Role/type/leg fields are stored as plain strings constrained by `src/lib/constants.ts` (kept simple rather than DB enums).
- `public/logo.svg` is a close recreation of the community's logo (chat-attached images aren't accessible as files to this tooling) — swap in the original artwork there for pixel-perfect branding.
