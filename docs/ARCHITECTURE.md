# Architecture (overview)

This project is a **static site**: HTML pages load scripts in a defined order. There is **no bundler** in the default workflow.

## Layers

1. **Static HTML** — Structure and element IDs used by scripts.
2. **Classic scripts (non-module)** — Run first, define global `window.*` services used by modules.
3. **ES modules** (`assets/financial-plan/*.js`) — Application logic, imports only other modules or browser APIs.

## Global services (classic scripts)

| Global | File | Purpose |
|--------|------|---------|
| `window.ThemeService` | `assets/theme-service.ts` | Light/dark theme; storage key `financial-plan-v3-aggressive.theme` (also on `ThemeService.STORAGE_KEY`) |
| `window.CheckInService` | `assets/checkin-service.ts` | Check-in CRUD |
| `window.Badges` | `assets/badges.ts` | Pure badge evaluation |
| `window.PayoffTimeline` | `assets/financial-plan/payoff-projection.js` (module) | Timeline projection (loaded as module before `main.js`) |

**Site header** behavior (`assets/site-settings.ts`): gear menu, theme, print, demo toggle. Uses the same demo flag string as `DEMO_MODE_STORAGE_KEY` in `plan-data.js` (`financial-plan.historyDemo`).

## Financial Plan module graph (simplified)

- `main.js` — Entry: `persistence` → `render` → goal editors → `checkin-log` → `features` (badges).
- `render-page.js` — Reads `PLAN`, calls render helpers including `checkin-log.renderCheckIns`.
- `persistence.js` — Loads/saves balances; **blocks saves** when demo mode is on.
- `dev-mock-storage.js` — Mock payloads for demo mode and dev seeding; **does not** duplicate business rules from `persistence` for normal load path.

## Demo mode vs dev seed

- **Demo mode (toggle):** In-memory mock plan snapshot via `applyDemoPlanSnapshot`; `savePlanOverrides` is a no-op.
- **Dev seed page:** Writes mock data into `localStorage` (destructive for Financial Plan keys).

## Cross-page consistency

- **History** and **Financial Plan** share `DEMO_MODE_STORAGE_KEY` so sample data is one toggle.
- **Real Estate** shares styles and header but separate storage keys.

## Adding a new module

1. Place it under `assets/financial-plan/`.
2. Import it from the smallest parent that needs it (avoid circular imports).
3. If it needs a global, ensure the classic script loads **before** the module in every HTML page that uses it.
