# Agent API and Claude Code MCP

Connect Claude Code (or Cursor) to your PennyPath debts and savings via a local MCP server and bearer-token API.

## Prerequisites

1. Apply Supabase migrations `009`–`011` in [supabase/migrations](../supabase/migrations/) (and `006`/`007` if `ledger_status` columns are missing).
2. Set `SUPABASE_SERVICE_ROLE_KEY` in `.env` (see [.env.example](../.env.example)).
3. Run the app: `npm run dev` (or set `PENNYPATH_API_BASE_URL` to your deployed URL).

## Setup

### 1. Create an agent token

```bash
npm run agent:token -- --email YOUR_LOGIN_EMAIL --name "Claude Code"
```

Copy the `pp_agent_...` value (shown once).

### 2. Build the MCP server

```bash
npm run mcp:install
npm run mcp:build
```

### 3. Configure MCP (one file)

```bash
cp .mcp.json.example .mcp.json
```

Edit `.mcp.json`: set the **absolute** path to `packages/pennypath-mcp/dist/index.js` and paste your token. `.mcp.json` is gitignored.

**Claude Code:** open a session in this repo (not the home dashboard), then `/mcp` inside that session to verify `pennypath`.

**Cursor:** same `.mcp.json` at the project root, or **Settings → MCP**. Reload the window after edits.

## MCP tools

| Tool | Action |
|------|--------|
| `pennypath_get_plan_summary` | Read-only plan snapshot |
| `pennypath_list_debts` | List debts (`ledgerStatus` optional) |
| `pennypath_get_debt` | Get one debt |
| `pennypath_update_debt` | Patch debt fields |
| `pennypath_add_debt_payment` | Payment + reduce balance |
| `pennypath_list_savings_accounts` | List savings accounts |
| `pennypath_get_savings_account` | Get one account |
| `pennypath_update_savings_account` | Patch savings fields |
| `pennypath_add_savings_deposit` | Deposit + increase balance |

## HTTP API (debugging)

`Authorization: Bearer <token>` on all routes under `/api/agent/v1/`.

## Security

- Tokens are stored hashed in `agent_api_tokens`.
- The agent API validates the token, then uses the service role with queries scoped to that `user_id`.
- Never commit `.mcp.json` or put tokens in client code.
