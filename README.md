# Financial Plan (static web app)

A **static, client-only** family financial planner: balances, debts, savings, payoff projections, monthly history, optional real-estate scenario pages, and milestone badges. Data lives in **`localStorage`** in the browser—there is no backend.

**Stack:** plain HTML, CSS, and **native ES modules** (`import` / `export`) with **no build step**. Open the site over **HTTP** (not `file://`) so modules load correctly.

---

## Quick start

```bash
# From the repository root
python3 -m http.server 8080
```

Then open:

- [Financial Plan](http://localhost:8080/financial-plan-v3-aggressive.html) — main planner
- [History](http://localhost:8080/history.html) — month-over-month activity
- [Real Estate](http://localhost:8080/real-estate-plan.html) — rental scenario calculator
- [Dev seed](http://localhost:8080/dev-seed.html) — optional mock `localStorage` for development

Use any static server (VS Code Live Preview, `npx serve`, etc.).

---

## Repository layout

| Path | Role |
|------|------|
| `financial-plan-v3-aggressive.html` | Main Financial Plan page |
| `history.html`, `real-estate-plan.html`, `dev-seed.html` | Other entry HTML |
| `assets/financial-plan.css` | Shared styles |
| `assets/print.css` | Print rules for the Financial Plan page |
| `assets/financial-plan/*.js` | **ES modules** (planner domain logic + UI) |
| `assets/theme-service.js` | Theme (`localStorage`) — classic script, attaches `window.ThemeService` |
| `assets/site-settings.js` | Header gear menu (theme, print, demo toggle, etc.) — classic IIFE |
| `assets/checkin-service.js` | Check-ins — classic script, `window.CheckInService` |
| `assets/badges.js` | Badge rules — classic script, `window.Badges` |
| `docs/ARCHITECTURE.md` | Module boundaries and globals (read before large changes) |

Key modules under `assets/financial-plan/`:

- `main.js` — entry: persistence, render, editors, check-ins, badges
- `plan-data.js` — default `PLAN` snapshot and **storage key** constants
- `persistence.js` — load/save balances; demo mode guard
- `render-page.js` — binds `PLAN` + derived values to the DOM
- `checkin-log.js` — check-in list UI + dialog
- `features.js` — payoff timeline + milestone badges
- `goal-editors-wire.js` — Goal 2/3 debt & savings editors

---

## Configuration

Edit the **`PLAN`** object and related defaults in `assets/financial-plan/plan-data.js`. Saved balances and editor state use keys exported from that file (e.g. `STORAGE_KEY`, `DEMO_MODE_STORAGE_KEY`).

**Sample data mode** (Financial Plan + History): shared flag `financial-plan.historyDemo` (`DEMO_MODE_STORAGE_KEY`). When enabled, the planner applies in-memory mock balances without overwriting your saved `localStorage` snapshot until you turn it off.

---

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for coding conventions, naming, and how to propose changes.

---

## Persistence (overview)

- Balances / debts / savings: `financial-plan-v3-aggressive.balances` (see `plan-data.js`)
- Check-ins: `financial-plan-v3-aggressive.checkins`
- Theme: `financial-plan-v3-aggressive.theme`
- Badges: `financial-plan.badges`

Real Estate pages use separate keys and are not cleared by Financial Plan “reset” helpers.

---

## Future tooling

Optional later: Vite/Rollup, TypeScript, lint/format in CI. The codebase is intentionally simple for contributors who only have a browser and a static server.
