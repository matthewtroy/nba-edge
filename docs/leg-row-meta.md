# Leg row meta (Past 5 · streak · badges)

**Data:** `PickLeg.recentVsLine` — up to 5 entries, **index 0 = most recent game** (`lib/leg-history.ts` `lastFiveVsLine`).

**Display:** `LastFiveTicks` shows dots **left = oldest**, **right = newest** via `displayTicksChronological` (`lib/hot-streak.ts`).

**Row order:** Past 5 dots (label `Past 5` on card rows) → hot-streak pill when 4+/5 hits → injury chip → value/former/blowout badges.

**Hot streak:** `isHotStreak` when ≥4 hits among graded Past-5 games (≥3 games with stat data).