# PennyPath

Family financial planner: debts, savings, payoff projections, monthly history, and optional real-estate scenarios. The **dashboard** is a **Next.js** app with **Supabase** auth and persistence; legacy **static HTML** pages remain for local-only workflows.

**Stack:** Next.js 16, React, TypeScript, Tailwind, Supabase. Financial Plan UI logic lives in `assets/financial-plan/` (ES modules loaded by the dashboard).

---

## Quick start

```bash
npm install
cp .env.example .env   # add Supabase + Gemini keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in (or use trial mode).

```bash
npm run typecheck
npm run build
```

---

## Repository layout

| Path | Role |
|------|------|
| `app/` | Next.js routes (dashboard, login, API) |
| `lib/` | Supabase clients, repositories, server helpers |
| `assets/financial-plan/` | Planner domain logic + UI wiring |
| `supabase/migrations/` | Postgres schema |
| `packages/pennypath-mcp/` | Local MCP server for Claude Code / Cursor |
| `docs/ARCHITECTURE.md` | Module boundaries (read before large planner changes) |
| `docs/AGENT_MCP.md` | **Agent API + MCP setup** |
| `financial-plan-v3-aggressive.html`, `history.html`, … | Legacy static entry points |

---

## AI agent access (MCP)

Use **Claude Code** or **Cursor** to read and update your debts and savings in natural language (e.g. “list active debts”, “set Chase balance to 4200”).

1. Apply agent migrations in Supabase (`009`–`011`; see `supabase/migrations/`).
2. `npm run agent:token -- --email you@example.com`
3. `npm run mcp:install && npm run mcp:build`
4. `cp .mcp.json.example .mcp.json` and add your token + absolute path to the MCP script.

Full steps: **[docs/AGENT_MCP.md](docs/AGENT_MCP.md)**

---

## Legacy static server (optional)

```bash
python3 -m http.server 8080
```

Then open `financial-plan-v3-aggressive.html` and related pages. Use HTTP, not `file://`, so ES modules load. Demo/history share `DEMO_MODE_STORAGE_KEY` in `assets/financial-plan/plan-data.js`.

---

## Configuration

- **Environment:** `.env` — `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `GEMINI_API_KEY`. See `.env.example`.
- **Planner defaults:** `assets/financial-plan/plan-data.js` (`PLAN`, storage keys).

---

## Contributing

See **[CONTRIBUTING.md](CONTRIBUTING.md)**.
