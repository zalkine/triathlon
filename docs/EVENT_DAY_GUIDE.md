# Gal-On Triathlon — Event Guide / מדריך אירוע

A step-by-step playbook for running the event with the app. Hebrew button
labels (what volunteers actually see) are shown in **bold Hebrew**.

Public site: `https://triathlon-pink.vercel.app`
Staff log in at: `…/login` → **כניסת צוות**

---

## The three roles

| Role | Hebrew | Who / where | Can do |
|---|---|---|---|
| **Public** | הציבור | Anyone, no login | Register, view competitors / schedule / results |
| **Timekeeper** | מודד/ת | Volunteers at the course | Check people in, start heats, stamp times |
| **Admin** | מנהל/ת | You / organizers | Everything + run lottery, build schedule, activate race, fix times, manage accounts |

Create volunteer accounts in advance: **ניהול תחרות → משתמשי צוות → חשבון חדש**
(Manage Race → Staff Accounts → New account). Give timekeepers the **מודד/ת** role.

---

## Phase 1 — Before the event (registration)

1. **Open registration** (default on). Check it under **ניהול תחרות → בקרת אירוע**;
   the toggle should read **הרשמה: פתוחה**.
2. **Share the public link** with the community. People register themselves at
   **הרשמה** (Register): name, age, solo vs. relay group, and — for a relay —
   which legs (swim/bike/run) they're willing to do. The category is chosen
   automatically from their age + level + solo/group.
3. **Watch sign-ups** any time on the **מתחרים** (Competitors) page — public and
   live. This is where everyone (and you) sees who has registered.

## Phase 2 — Closing registration & forming groups

Do this once sign-ups are done (e.g. the day before, or morning of).

1. **Close registration:** **בקרת אירוע → סגירת הרשמה**.
2. **Check people in first** if you want them included now — see Phase 3 step 1.
   (The lottery/schedule only includes **checked-in** people.)
3. **Run the lottery + build the schedule:**
   **בקרת אירוע → הרצת הגרלה ויצירת לוח זמנים**.
   - Relay teams are formed at random (one swimmer + one biker + one runner).
   - Solo competitors are placed directly.
   - Everyone is split into heats (max 8 per heat) and given an estimated start time.
4. **Fix leftovers:** anyone the lottery couldn't complete a team for appears under
   **נרשמים ללא שיבוץ** (Unassigned). Drop them onto a team's open leg there.
5. You can **re-run the lottery** any time — it only places people not yet assigned,
   so it's safe to run again after more people check in.

> Prefer to build heats by hand instead? Use **ניהול תחרות → מקצה חדש**
> (New Heat) and add competitors manually.

### Only three or four people in a category? Start two categories together

A heat of three swimmers leaves five empty lanes and still costs a full turn of
the pool. **ניהול תחרות → מקצים** (Manage Race → Heats) lets an admin — and only
an admin — combine heats from **different categories** into one **זינוק משולב**
(combined start):

1. Tick the heats you want to send off together (they can be in any category).
2. Tap **אחדו לזינוק אחד** (Combine into one start).

From then on those heats are one wave: the start line sees a single card with
everyone on it and one **GO**, so they all enter the water on the same gun. The
app warns you if the combined field is bigger than the pool's 8 lanes, but lets
you go ahead if you know some of them won't be there.

What does *not* change: each competitor stays in their own category and is
ranked only against their own category, so a 6–9 child is never ranked against a
professional. The schedule tells everyone which races share their start, and the
heats can be split apart again at any time with **פיצול** (Split) — no times or
rosters are touched.

> Re-running the lottery won't undo a combination you've made. New arrivals are
> put into a fresh heat rather than squeezed into a combined wave, so a wave you
> sized never grows behind your back.

### Only a handful of children in each age bracket?

Combining *starts* (above) puts two races in the pool together but still ranks
them separately. If you'd rather the children **compete as one race** — one
ranking, one podium — merge the age brackets instead:

**ניהול תחרות → מקצים** → *איחוד שתי קבוצות גיל לקטגוריה אחת* → **אחדו לקטגוריה אחת**.

Children's singles 6-9 and 9-12 then race as one "ילדים - יחידים" category:
shared heats, a single ranked list, one set of places. The same is offered for
the children's relay brackets.

Only these pairs can be joined — the same race differing by age alone. You can't
merge a relay into a solo race, and you can't merge מקצוענים with עממי (those
are skill levels, not ages, so it would rank a beginner against a trained
athlete). The app simply won't offer it.

Nobody re-registers: everyone stays in the age bracket they signed up under,
which is why **פיצול חזרה** (Split back) undoes it at any time.

**Your heats are safe.** Merging and splitting never delete a heat — whatever
you have arranged by hand stays exactly as it is, and heats you named yourself
keep their names. Merging only changes who is ranked against whom, so you can
merge before or after organising the heats. Afterwards you can drag everyone
into a single heat, or leave them in two and give them a **combined start**.
Once any heat has been started, neither merging nor splitting is allowed.

### Nine in one heat?

Yes — the 8 is the number of lanes, not a rule the app forces on you. Drag a
ninth competitor into a full heat (or add one by name) and you'll be asked to
confirm: *"that puts 9 in the pool at once, more than the 8 lanes — go ahead
anyway?"* Say yes and it's done, which is what you want when two children will
share a lane or half the heat hasn't turned up.

The same question is asked wherever competitors are placed — the Heats board,
the heat's own page, and the start line — and it counts a combined start as one
pool, so 4 + 5 across a combined wave asks too. Anyone marked as not here
(scratched) isn't counted; they aren't taking a lane.

Once you've confirmed a heat of nine, **re-running the lottery leaves it alone** —
that category is no longer repacked, so your arrangement stands.

### Someone registered after you built the heats?

A team or competitor who signs up once the heats exist has nowhere to appear on
its own — this is the usual reason the number of קבוצות on the Registration tab
is higher than the number showing in the מקצים.

The Heats tab shows them in an orange box, **רשומים אך לא משובצים למקצה**
(registered but not in a heat), listing each one with its legs. From there:

- **שבצו את כל הממתינים למקצים** — fills the spare lanes in the heats you already
  have, then adds heats for whoever is left.
- Or place them one at a time with **שבצו למקצה…**, choosing the heat yourself.

Neither moves, renames or rebuilds anything you have already arranged, so it is
safe to press at any point. You do **not** need to run
**הרצת הגרלה ויצירת לוח זמנים** for this — that button rebuilds the whole running
order, which is exactly what you don't want once you have arranged it by hand.

> If someone of the same name is already in a heat (typed in by hand at the start
> line, say), they're flagged rather than placed automatically, so nobody ends up
> in the race twice. Place those yourself after checking.

### Printing and downloading the lists

Everything the admin sees can be downloaded from **ניהול תחרות**:

- **כל הרשימות (Excel)** — on the Registration (📝) and Scores (🏅) tabs. One
  Excel file with a sheet per list: משתתפים, קבוצות שליחים, מקצים, תוצאות, אנשי
  קשר and the Hall of Fame. This is the one to grab for printing.
- Individual **CSV** files sit at the foot of each tab if you only want one list.

Hebrew names come through correctly in Excel in both formats. None of this needs
the lottery to have been run: if you build the heats yourself, the משתתפים sheet
has a **Heat** column showing where each person ended up — or `not placed` if
they were missed — and the מקצים sheet lists the heats exactly as you arranged
them. The relay-teams list likewise reads the teams themselves, so team sheets
can be printed while groups are still being put together.

## Phase 3 — Race day

### 1. Check-in (at the gathering area) — timekeeper or admin
- Open **רישום הגעה** (Check-In). Search each arriving person by name and tap
  their card to mark **נרשם/ה הגעה** (arrived). Tap again to undo.

### 2. Publish the schedule
- Once check-in is basically done, run **הרצת הגרלה ויצירת לוח זמנים** (again if
  needed) so late check-ins get placed. Everyone can see start times live on the
  public **לוח זמנים** (Schedule) page.

### 3. Start the competition — ADMIN
- When you're ready to begin, tap **בקרת אירוע → הפעלת התחרות** (Activate
  Competition). **This unlocks the timing stations for all timekeepers.**
  (Until you do this, timekeepers see a "not active yet" message — that's normal.)

### 4. Timekeepers take their stations
Each timekeeper logs in and picks their spot from **עמדות תזמון** (Timing Stations):

| Station | Hebrew | Where | What they do |
|---|---|---|---|
| Start | **התחלה** | Start line (with the microphone) | On "GO!", tap **התחל עכשיו** for the heat → the clock starts |
| Swim | **סיום שחייה** | Pool exit | Tap each swimmer as they finish the swim |
| Bike | **סיום רכיבה** | Bike-in | Tap each competitor as they finish the bike |
| Run / Finish | **ריצה / קו סיום** | Finish line | Tap each competitor as they cross — **this sets the final time** |

At each station: type part of a name in the search box, then tap the person's
big button to stamp their time **at that moment**. A short **בטל** (Undo) appears
for a few seconds in case of a mis-tap.

At the **swim** and **bike** stations a competitor drops off the list once
they're stamped, keeping the working list short.

**The finish line (ריצה / קו סיום) works differently** — it's the station that
decides the results, so it's built so nothing can be lost:

- **Nobody disappears.** Once you tap **הגיע/ה** (Arrived) the competitor stays
  exactly where they were on screen and turns grey, with the time you gave them
  (**נרשם בשעה …**). Nothing below them jumps up, so the next button you reach
  for is still the one you meant. You can always see who you've already taken.
- **A relay shows its runner.** The big name on the card is the person actually
  running the last leg — the one who will cross the line in front of you. The
  swimmer and biker are listed underneath in small type, just so you can
  identify the team. (If the team has been given a name of its own, that appears
  small too.)
- **Each race has its own colour.** Every card is tinted by category — blue for
  professionals, teal for עממי, coral for ילדים 6-9, violet for ילדים 9-12 —
  with singles and relay groups in two shades of the same colour.
- **Each volunteer picks their own races.** Under the search box, tap a category
  chip to show only that race; **tap more chips to add more races**, so one
  volunteer can cover two or three at once. A ticked chip is one you're
  covering, and the number on it is how many of that race are still out on the
  course. Tap a ticked chip again to drop that race, or **הכול** (All) to go
  back to the whole field in one tap. The selection is remembered on that phone,
  so a reload puts the volunteer back on their own races. A red banner warns how
  many competitors the filter is hiding.

> Running the finish line with two or three volunteers? Split the categories
> between them — each taps the chips for the races they're covering and they'll
> never be looking at each other's competitors. Just make sure every category is
> covered by someone: the red banner on each phone is the reminder.

> **Started a heat by mistake, or need to run it again?** On the start station,
> each running heat has **ביטול ההתחלה** (Cancel start). Tap it, confirm, and the
> heat drops back into the list below, ready to be sent off again — the clock is
> reset and any times already recorded *in that heat* are cleared with it (they
> were measured against the cancelled start). Nobody is removed from the race and
> no other heat is affected. An admin can do the same from **ניהול תחרות → מקצים**
> (Manage Race → Heats) or from the heat's own page.
>
> A **combined start** goes back to the start line whole: cancelling it resets
> every heat in that wave, because they all ran against the one gun. The
> confirmation says how many recorded times that clears.

> Only the finish (**ריצה / קו סיום**) stamp is required for a result. The swim
> and bike stations are optional splits — use them only if you have enough
> volunteers.

### 5. Results
- **תוצאות** (Results) ranks competitors within each category automatically —
  fastest total time first — the instant both a start and a finish time exist.
- The public does **not** see them yet. Rankings stay hidden until you approve
  and publish them — see Phase 4.

---

## Phase 4 — After the race (publishing the results) — ADMIN

Everything here is on **ניהול תחרות → תוצאות ודירוג** (Manage Race → Scores &
Ranking).

### 1. Someone raced in another competitor's place?
A competitor drops out on the morning — illness, an injury — and a volunteer
takes their place. Nobody has time to write it down until the racing is over, so
fix it here, before you approve:

- Tap the **name** on the result row and type whoever actually raced.
- For a relay, each leg (**שחייה / רכיבה / ריצה**) is tapped separately, so you
  replace only the person who didn't swim/ride/run. The team name updates itself.
- **Times are not touched** — the clock measured the race that was run.
- The stand-in is added to the roster in the competitor's place and the competitor
  who dropped out is taken off the race (their registration stays). From there the
  change follows through to the public results, the downloads and היכל התהילה on
  its own.

### 2. Fix anything else that's wrong
The whole results screen is yours to correct before you publish:

- **A time** — tap the **שחייה / רכיבה / סיום** (swim / bike / finish) time on the
  row and set it against the camera or the manual record.
- **A heat's start** — **זמני זינוק של המקצים** above each table. Every total is
  the finish minus the heat's start, so this re-times everyone in that heat at
  once (and every heat that was sent off with it).
- **Someone who shouldn't be ranked** — **הוצאה מהתוצאות** (Take out of the
  results) on their row. They keep their place in the heat and their times, and
  they move to **מחוץ לתוצאות** at the foot of the table.
- **Someone wrongly left out** — anyone scratched at the start line is listed
  under **מחוץ לתוצאות**; **החזרה לתוצאות** (Put back in the results) brings them
  back into the ranking.
- **Someone missing from the heat entirely, or in the wrong heat** — tap the heat
  name under their name to open that heat, where you can add, move or delete.

**מקום** (Rank), **זמן כולל** (Total) and **סטטוס** (Status) are not typed in —
they are calculated from the times, so they can never disagree with the clock.
Fix a time and they re-sort themselves.

### 3. Approve
When the list is right, tap **אישור תוצאות** (Approve results).

### 4. Publish
Results reach the public only when **both** are set: **אישור** = מאושר (Approved)
and **תוצאות לציבור** = מוצגות (Shown). The panel says
**✓ התוצאות גלויות לציבור** when they are live. Revoke the approval any time to
pull them back.

### 5. What the village sees
The home page changes the moment the results go live: the event's name, a
**תוצאות <year>** button, **היכל התהילה**, and a "הישארו מעודכנים" note where the
date used to be — next year's date will be published there.

### 6. Add the year to the Hall of Fame
**הוספה להיכל התהילה** with the year imports every finished result. Safe to
re-run: it replaces what it imported before, so run it again after any late
correction.

---

## Quick fixes (Admin)

- **Wrong time / missed stamp:** **ניהול תחרות → open the מקצה (heat) → click the
  time** to edit it directly. Admins can set, change, or clear any swim/bike/finish
  time and the heat's start time.
- **Someone registered in the wrong category:** they can register again correctly;
  remove the wrong entry from its heat if it was already placed.
- **A time looks impossible:** check the heat's **start time** first — every result
  is finish minus start, so a wrong start throws off the whole heat.
- **The whole heat has to be re-run:** **ביטול ההתחלה** (Cancel start) on the
  heats board or the heat page — it resets that heat's clock so the start line can
  send it off again. Prefer editing the start time if the heat actually ran and
  only the recorded moment was wrong.

## Roles recap for volunteers (hand this out)

- **Check-in volunteer:** log in → **רישום הגעה** → find name → tap to mark arrived.
- **Start-line timekeeper:** log in → **עמדות תזמון → התחלה** → announce, then
  **התחל עכשיו** exactly on "GO!". If the heat has to start over, tap
  **ביטול ההתחלה** (Cancel start) on it and send it off again.
- **Finish-line timekeeper (most important):** log in → **עמדות תזמון → ריצה / קו
  סיום** → tap the chips for the races you're covering (one, two, or as many as
  you like), then watch for each arriving competitor and tap their button the
  moment they cross. Their card turns grey with the recorded time and stays
  where it is.
