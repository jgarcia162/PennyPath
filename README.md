# PennyPath

A family financial planner for paying down debt, tracking savings, and seeing when the plan actually closes.

I built this so two people can share one picture of the household: balances, payoff dates, savings goals, and a lightweight monthly history — without a spreadsheet that only one of us understands.

**[Live demo](https://penny-path-lake.vercel.app)** · **[Take a peek](https://penny-path-lake.vercel.app/login)** (time-boxed trial with sample data) · **[Source](https://github.com/jgarcia162/PennyPath)**

<!-- Drop a PNG at docs/screenshots/dashboard.png, then uncomment:
![PennyPath dashboard](docs/screenshots/dashboard.png)
-->

## Why

Household money work is usually split across credit-card apps, a HYSA, and a private spreadsheet. I wanted one place to log payments and charges, watch debt pay down, fund savings targets, and wrap a month without losing the story of what changed.

## Features

- **Debts** — balances, APR, promo/deferred amounts, payments and charges with optional notes, and a payoff projection
- **Savings** — accounts, APY, deposits and withdrawals, and goals (including a joint HYSA target)
- **Month wrap-up** — checkpoint the working month and look back at history
- **Check-ins and milestones** — short notes plus progress badges
- **Real estate** — optional scenarios alongside the financial plan
- **Take a peek** — a trial session with sample data that does not persist
- **AI helpers** — payoff-plan and bill-calendar prompts (Gemini)
- **Agent access** — a scoped HTTP API plus a local MCP server so Claude Code or Cursor can read and update debts and savings in natural language

## Architecture highlights

- **Next.js app** with Supabase auth and persistence (`app/`, `lib/`)
- **Shared planner modules** in `assets/financial-plan/` — the same ES module tree drives the dashboard and the legacy static HTML pages
- **Repository layer** (`lib/repositories/`) so UI code does not talk to Supabase directly
- **Ledger model** — debt `payment` / `charge` and savings `deposit` / `withdrawal`, with memos and inline card editors
- **Vitest** coverage around money input, persistence policy, and ledger flows

Deeper module map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind · Supabase · Vitest · Gemini

## Run locally

Setup, scripts, env vars, and how to open a PR are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.
