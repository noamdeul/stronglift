# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**FiveByFive** — a client-side-only, mobile-first PWA for logging
FiveByFive 5×5 barbell workouts. There is **no backend and no account**: all
state lives in the browser's `localStorage`. The app is installable and fully
usable offline, and is deployed as a GitHub Pages project site.

## Tech stack

- **React 18** + **TypeScript** (strict mode), built with **Vite 5**
- **zustand** (v4) for state, with the `persist` middleware writing to
  `localStorage`
- **vite-plugin-pwa** (Workbox) for the offline service worker + manifest
- **vitest** for unit tests (node environment, globals enabled)

No CSS framework — styling is hand-written in `src/index.css`. No router; the
active tab is plain `useState` in `App.tsx`.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run test       # vitest run (one-shot)
npm run test:watch # vitest in watch mode
npm run build      # tsc -b && vite build  → dist/
npm run preview    # serve the production build
```

`npm run build` runs the TypeScript project build **first** (`tsc -b`), so type
errors fail the build. The compiler is strict and also enforces
`noUnusedLocals` / `noUnusedParameters` / `noFallthroughCasesInSwitch` — unused
imports and variables are build errors, not warnings.

There is no linter/formatter configured. Match the existing style.

## Architecture

The codebase is deliberately layered. **Keep business logic in `src/domain/`,
out of React components.**

```
src/
  domain/      Pure logic — no React, no zustand, no I/O. Unit-tested.
    types.ts        All shared TypeScript types (the data model)
    exercises.ts    Exercise definitions + A/B workout templates
    units.ts        kg/lb conversion, rounding, bar/plate constants, formatting
    warmups.ts      FiveByFive warmup-set generation
    progression.ts  The progression/deload engine (success → +weight, fail×3 → deload)
    session.ts      Build a fresh session from templates; derive results
    defaults.ts     Default settings, starting weights, SCHEMA_VERSION
  store/
    useAppStore.ts  zustand store: the ONLY stateful glue between domain & UI
  hooks/
    useRestTimer.ts Live countdown derived from a persisted timestamp
    usePwaUpdate.ts Wraps vite-plugin-pwa's update-available hook
  screens/        Top-level tab screens: Today, History, SessionDetail, Settings
  components/      ExerciseCard, SetTracker, WarmupSets, RestTimerBar,
                  BottomNav, ConfirmDialog, DataIO
  test/           vitest unit tests for the domain layer
  App.tsx         Tab shell (today/history/settings) + update toast
  main.tsx        React root
```

### Data flow

1. `domain/` exposes **pure functions** over plain data — no side effects, no
   React. These are the testable core.
2. `store/useAppStore.ts` holds the single `AppState` plus transient UI state
   (the rest timer), and is the **only** place domain functions are wired to
   persisted state and mutations.
3. Components/screens read from the store with selectors
   (`useAppStore((s) => s.currentSession)`) and call store actions. They contain
   presentation logic only.

### The data model (`domain/types.ts`)

- `AppState` is the persisted root: `settings`, `exerciseStates` (per-exercise
  progression memory), `history` (completed sessions, **newest last**),
  `currentSession` (in-progress, persisted so it survives reload),
  `nextWorkoutType`, and `schemaVersion`.
- A workout is `A` (Squat · Bench · Row) or `B` (Squat · OHP · Deadlift); they
  alternate via `flipWorkoutType`.
- `ExerciseState` carries `currentWeight` and `consecutiveFailures` — this is
  the "memory" the progression engine reads and writes.

### Progression engine (`domain/progression.ts`)

This is the heart of the app and is well unit-tested. Key rules:

- An exercise **succeeds** only when *every* work set is `done` and `reps >=
  targetReps`. Warmups never count.
- **Success** → `currentWeight += increment` (per-exercise; +2.5 kg / 5 lb most
  lifts, +5 kg / 10 lb deadlift), reset failures.
- **Failure** → increment the failure counter. At `deloadFailThreshold` (3)
  consecutive failures → drop weight by `deloadFactor` (10%), rounded to a
  loadable weight, and reset the counter. Weight is unchanged on earlier
  failures.

All weight math goes through `roundToIncrement` in `domain/units.ts` to snap to
a loadable plate increment and avoid floating-point fuzz.

## Conventions

- **Pure-domain rule.** New rules/calculations (progression, warmups, units,
  templates) belong in `src/domain/` as pure functions, with a vitest test. Do
  not embed this logic in components or the store.
- **Types live in `domain/types.ts`.** Add shared interfaces there.
- **State updates are immutable.** The store spreads new objects/arrays rather
  than mutating (see `toggleSet`, `mapWarmupSets`). Follow that pattern.
- **Units.** Weights are stored in the user's active unit. When switching units,
  `changeUnit` converts every stored weight via `convertWeight`. Never hardcode
  kg or lb — use `BAR_WEIGHT`, `DEFAULT_ROUNDING`, and the conversion helpers.
- **Timers are timestamp-based.** The rest timer persists `endsAt` (epoch ms)
  rather than a ticking counter, so it stays accurate across screen sleep /
  backgrounding. Preserve this when touching `useRestTimer` / `startRest`.
- **Imports** use the `.ts`/`.tsx`-less relative form (e.g.
  `import ... from './units'`), and prefer `import type { ... }` for type-only
  imports (enforced-ish by `isolatedModules`).

## Persistence & schema migrations

- Persisted under the `localStorage` key `fivebyfive-v1`
  (`PERSIST_KEY` in the store), versioned by `SCHEMA_VERSION` in
  `domain/defaults.ts` (currently `1`).
- `partialize` persists only the `AppState` slice — transient state (the rest
  timer) is intentionally **not** persisted.
- **If you change the shape of `AppState`, bump `SCHEMA_VERSION`** and add the
  migration logic in the store's `migrate` callback (currently a no-op
  passthrough). Import/export and reset all stamp the current `SCHEMA_VERSION`.
- Backup is plain JSON export/import of the `AppState` (`exportData` /
  `importData`, surfaced in `DataIO` / Settings).

## PWA & deployment

- The app is served from the base path **`/fivebyfive/`** (set as `base` in
  `vite.config.ts` and reflected in `index.html` asset URLs). If the repo is
  forked/renamed, `base` must be updated to match.
- Service worker uses `registerType: 'autoUpdate'`; `usePwaUpdate` surfaces a
  "New version available" toast in `App.tsx`.
- **Deployment is automatic:** `.github/workflows/deploy.yml` builds on every
  push to `main` and publishes `dist/` to GitHub Pages. There is no other CI.

## Testing

- Tests live in `src/test/` and cover the domain layer
  (`progression`, `session`, `units`). They run in vitest's node environment.
- When adding or changing domain logic, **add/update a test**. Run
  `npm run test` before pushing.

## Git workflow

- Active development branch for this work: **`claude/claude-md-docs-6i7jzc`**.
  Commit and push there; do not push to `main` (pushing to `main` triggers a
  production deploy).
