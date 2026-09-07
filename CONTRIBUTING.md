# Contributing

PennyPath is a personal project. These notes are for me (and anyone cloning the repo) to run it locally, keep changes small, and land work on `develop`.

## Principles

- **Readable first:** Prefer clear names (`monthlyTakeHome`, `applyPlanOverrides`) over abbreviations.
- **Small, focused changes:** One logical change per PR (bugfix, feature, or refactor — not all three).
- **Match existing style:** Same import order, string quoting, and comment density as neighboring files.

## Local development

```bash
npm install
cp .env.example .env   # add Supabase + Gemini keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in, or use **Take a peek** on the login page.

```bash
npm run typecheck
npm test
npm run build
```

### Environment

Copy `.env.example` to `.env`. Typical keys:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser client
- `SUPABASE_SERVICE_ROLE_KEY` — server only (agent API, trial cleanup)
- `GEMINI_API_KEY` — AI payoff plan, bill calendar, and research routes

Never commit real keys. Planner defaults and storage keys live in `assets/financial-plan/plan-data.ts` (`PLAN`, `STORAGE_KEY`, `DEMO_MODE_STORAGE_KEY`). Do not duplicate those string literals; if a classic script must, add a comment pointing at the canonical key.

### Repository layout

| Path | Role |
|------|------|
| `app/` | Next.js routes (dashboard, login, API) |
| `lib/` | Supabase clients, repositories, server helpers |
| `assets/financial-plan/` | Planner domain logic + UI wiring |
| `supabase/migrations/` | Postgres schema |
| `packages/pennypath-mcp/` | Local MCP server for Claude Code / Cursor |
| `docs/ARCHITECTURE.md` | Module boundaries (read before large planner changes) |
| `docs/AGENT_MCP.md` | Agent API + MCP setup |
| `financial-plan-v3-aggressive.html`, `history.html`, … | Legacy static entry points |

### JavaScript

- **ES modules** live under `assets/financial-plan/`. Use `import` / `export`.
- **Classic scripts** (`assets/theme-service.ts`, `assets/checkin-service.ts`, `assets/site-settings.ts`, …) attach to `window` and load **before** modules that depend on them. If you add a new global, document it in `docs/ARCHITECTURE.md` and load it in every HTML page **before** the consuming module.
- Script order for the financial plan: `theme-service.ts` → `site-settings.ts` → `payoff-projection.js` (module) → `checkin-service.ts` → `badges.ts` → `main.ts`.

### HTML & CSS

- Prefer **semantic elements** (`header`, `nav`, `section`, `dialog`) and keep **IDs stable** when JS depends on them (`#checkin-list`, `#btn-site-settings`, …).
- Shared layout tokens live in `assets/financial-plan.css`. Avoid inline styles except for dynamic values from JS.

### Accessibility

- Interactive controls should have **labels** (`aria-label`, `aria-labelledby`, or visible text).
- Theme and settings controls use **`aria-expanded` / `aria-controls`** where applicable.

### What to avoid

- Large **backup copies** of HTML in the repo (`*.backup-*.html`) — use git history instead.
- **Drive-by refactors** unrelated to the issue (rename sweeps across unrelated files).

## Pull requests

Open PRs against **`develop`**, not `main`. Releases to production are `develop` → `main`.

1. Describe **what** changed and **why** (user-facing behavior or bug).
2. If you touched persistence or storage keys, say so explicitly.
3. For UI changes, a short note on how you tested (browser, viewport) is enough.
4. Commit message style: imperative subject with a scope prefix (`feat:`, `fix:`, `style:`, `refactor:`).

## AI agent access (MCP)

Use Claude Code or Cursor to read and update debts and savings in natural language (for example “list active debts”, “set Chase balance to 4200”).

1. Apply agent migrations in Supabase (`009`–`011`; see `supabase/migrations/`).
2. `npm run agent:token -- --email you@example.com`
3. `npm run mcp:install && npm run mcp:build`
4. `cp .mcp.json.example .mcp.json` and add your token plus the absolute path to the MCP script.

Full steps: **[docs/AGENT_MCP.md](docs/AGENT_MCP.md)**.

## Legacy static HTML (optional)

The Next.js dashboard is the primary app. Static pages share the same `assets/` modules and still work offline via `localStorage`.

```bash
python3 -m http.server 8080
# open http://localhost:8080/financial-plan-v3-aggressive.html
```

Use HTTP, not `file://`, so ES modules load. Demo mode and History share `DEMO_MODE_STORAGE_KEY` in `assets/financial-plan/plan-data.ts`.
