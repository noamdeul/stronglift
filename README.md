# FiveByFive

A client-side-only, mobile-first web app for logging FiveByFive 5×5 barbell
workouts. No backend, no account — all data lives in your browser
(`localStorage`). Installable as a PWA and fully usable offline.

## Features

- **Guided A/B workouts** — alternates Workout A (Squat · Bench · Row) and
  Workout B (Squat · Overhead Press · Deadlift).
- **Automatic progression** — when you complete all reps, the weight goes up
  next time (+2.5 kg / 5 lb on most lifts, +5 kg / 10 lb on deadlift).
- **Automatic deload** — fail the same lift three workouts in a row and it drops
  10% (rounded to a loadable weight).
- **Tap-to-log sets** — tap a set to mark it done; tap again to record fewer
  reps on a failed set. No keyboard needed.
- **Rest timer** — starts automatically after each work set; timestamp-based so
  it stays accurate even if the screen sleeps.
- **History** — review every past workout.
- **kg / lb** with automatic conversion.
- **Backup** — export/import your data as JSON.
- **Offline + installable** — PWA with a precaching service worker.

## Tech stack

React + Vite + TypeScript · zustand (state + `localStorage` persistence) ·
vite-plugin-pwa · vitest.

## Development

```bash
npm install
npm run dev        # local dev server
npm run test       # run the progression-engine unit tests
npm run build      # production build into dist/
npm run preview    # preview the production build
```

## Deployment (GitHub Pages)

Deployment is automated via `.github/workflows/deploy.yml`: every push to
`main` builds the app and publishes `dist/` to GitHub Pages.

**One-time setup:** in the repo, go to **Settings → Pages → Build and
deployment → Source** and select **GitHub Actions**.

The app is served from the `/fivebyfive/` base path (configured in
`vite.config.ts`). If you fork or rename the repo, update `base` to match the
new repo name.

## Data & privacy

Everything is stored locally in your browser. Clearing site data or switching
devices loses your history unless you export a backup first (Settings →
Backup → Export).

## Project structure

```
src/
  domain/      # pure logic: types, exercises, progression engine, warmups, units
  store/       # zustand store + localStorage persistence
  hooks/       # rest timer, PWA update
  screens/     # Today, History, Session detail, Settings
  components/  # ExerciseCard, SetTracker, RestTimerBar, BottomNav, etc.
  test/        # vitest unit tests for the domain layer
```
