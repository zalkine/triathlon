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
- **Each race has its own colour.** Every card is tinted by category — blue for
  professionals, teal for עממי, coral for ילדים 6-9, violet for ילדים 9-12 —
  with singles and relay groups in two shades of the same colour.
- **One volunteer per race.** Under the search box, tap a category chip to show
  only that race (the number on the chip is how many are still out on the
  course). The choice is remembered on that phone, so a reload puts the
  volunteer back on their own race. A red banner warns how many competitors in
  other categories the filter is hiding — tap **הכול** (All) to see everyone
  again.

> Running the finish line with two or three volunteers? Give each one a
> category chip and they'll never be looking at each other's competitors.

> **Started a heat by mistake, or need to run it again?** On the start station,
> each running heat has **ביטול ההתחלה** (Cancel start). Tap it, confirm, and the
> heat drops back into the list below, ready to be sent off again — the clock is
> reset and any times already recorded *in that heat* are cleared with it (they
> were measured against the cancelled start). Nobody is removed from the race and
> no other heat is affected. An admin can do the same from **ניהול תחרות → מקצים**
> (Manage Race → Heats) or from the heat's own page.

> Only the finish (**ריצה / קו סיום**) stamp is required for a result. The swim
> and bike stations are optional splits — use them only if you have enough
> volunteers.

### 5. Results
- **תוצאות** (Results) ranks competitors within each category automatically —
  fastest total time first — the instant both a start and a finish time exist.
  Public and live; no action needed.

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
  סיום** → tap your category chip if you're only covering one race, then watch
  for each arriving competitor and tap their button the moment they cross. Their
  card turns grey with the recorded time and stays where it is.
