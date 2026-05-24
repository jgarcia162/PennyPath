# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run typecheck    # TypeScript check (no emit)
npm run mcp:install  # Install MCP server deps
npm run mcp:build    # Build the MCP server
npm run agent:token -- --email you@example.com  # Create agent API token
```

Static HTML legacy pages require a plain HTTP server (not `file://`):

```bash
python3 -m http.server 8080
# open http://localhost:8080/financial-plan-v3-aggressive.html
```

## Architecture

### Two parallel worlds

The project runs in two distinct modes:

1. **Next.js app** (`app/`) — authenticated dashboard at `localhost:3000`. Supabase auth gates access. The financial plan UI is loaded from `assets/financial-plan/` as ES modules within this shell.

2. **Static HTML** (`financial-plan-v3-aggressive.html`, `history.html`, etc.) — legacy entry points that work offline via `localStorage` only. They share the same `assets/` module tree.

### Financial Plan module graph (`assets/financial-plan/`)

`main.ts` is the entry point. Script load order in the HTML matters:

```text
theme-service.ts → site-settings.ts → payoff-projection.js (module) → checkin-service.ts → badges.ts → main.ts
```

Classic scripts (`theme-service.ts`, `checkin-service.ts`, `site-settings.ts`, `badges.ts`) attach to `window.*` and must load **before** the ES modules that consume them. If you add a new global, update `docs/ARCHITECTURE.md` and load it before the consuming module in every HTML page.

Key module responsibilities:
- `plan-data.ts` — `PLAN` defaults and all `localStorage` key constants (`STORAGE_KEY`, `DEMO_MODE_STORAGE_KEY`). The single source of truth for storage keys.
- `persistence.ts` — loads/saves plan state; syncs to Supabase via repositories; blocks saves in demo mode.
- `render-page.ts` / `render-sections.ts` — pure render helpers reading `PLAN`.
- `goal-editors-wire.ts` — wires the debt and savings editor dialogs.
- `ledger-utils.ts` — shared helpers for `kind` normalization and display formatting for debt payment/charge and savings deposit/withdrawal entries.
- `debt-ledger-editor-cells.ts` / `savings-ledger-editor-cells.ts` — inline ledger row editors.
- `ledger-editor-draft.ts` — draft state management for ledger entry inputs.
- `editor-ledger-save-guard.ts` — prevents committing ledger rows when a pending amount/memo field is being edited.

### Repository layer (`lib/repositories/`)

`lib/repositories/index.ts` is the **only wiring point** — swap Supabase implementations there without touching calling code. All repository interfaces live in `lib/repositories/types.ts`.

Current repositories: `planConfig`, `debt`, `savingsAccount`, `savingsGoal`, `checkIn`, `aiCache`, `financialPlanState`.

Ledger entries carry `kind` (`'payment' | 'charge'` for debts; `'deposit' | 'withdrawal'` for savings) and an optional `memo` (max 120 chars, enforced by `normalizeLedgerMemo`).

### Supabase clients

| File | Use |
|------|-----|
| `lib/supabase/browser.ts` | Client-side (financial plan modules) |
| `lib/supabase/server.ts` | Next.js server components/actions |
| `lib/supabase/admin.ts` | Service-role operations (agent API) |

### Agent API (`app/api/agent/v1/`)

Bearer-token HTTP API for Claude Code / Cursor MCP access. Tokens are stored hashed in `agent_api_tokens` (migration `009`). Auth logic in `lib/agent/auth.ts`; scopes in `lib/agent/scopes.ts`. The local MCP server (`packages/pennypath-mcp/`) wraps these routes.

### Demo mode vs dev seed

- **Demo mode (toggle):** Applies an in-memory mock snapshot via `applyDemoPlanSnapshot`; `savePlanOverrides` becomes a no-op.
- **Dev seed page (`dev-seed.html`):** Writes mock data into `localStorage` — destructive for Financial Plan keys.

## Environment variables

Copy `.env.example` to `.env`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — browser client
- `SUPABASE_SERVICE_ROLE_KEY` — server-only (agent API)
- `GEMINI_API_KEY` — AI payoff plan and bill calendar features

## Database migrations

Migrations are in `supabase/migrations/` (numbered `001`–`012`). For agent/MCP access, migrations `006`, `007`, `009`–`011` must be applied. Migration `012` adds `kind` and `memo` columns to ledger tables.

## Git commit conventions

Use imperative subject with a scope prefix: `feat:`, `fix:`, `style:`, `refactor:`. Commit meaningful deltas as they complete — one logical commit per completed slice of work.

## Key constraints

- Storage keys are centralized in `plan-data.ts`. Never duplicate the string literals; add a comment pointing to the canonical key if unavoidable (e.g. in a non-module classic script).
- DOM element IDs are load-bearing (`#checkin-list`, `#btn-site-settings`, etc.). Keep them stable when JS depends on them.
- ES modules cannot load from `file://` — always use an HTTP server for static HTML dev.
- Do not add `*.backup-*.html` files; use git history instead.
