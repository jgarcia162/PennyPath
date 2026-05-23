#!/usr/bin/env node
/**
 * Create a PennyPath agent API token for Claude Code MCP.
 *
 * Usage:
 *   npm run agent:token -- --email you@example.com --name "Claude Code"
 *   node scripts/create-agent-token.mjs --user-id <uuid> --name "Claude Code"
 *
 * Loads `.env` then `.env.local` from the repo root (same as Next.js conventions).
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PREFIX = 'pp_agent_';

/** Load KEY=VALUE lines into process.env (does not override existing env). */
function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return false;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

loadEnvFile('.env');
loadEnvFile('.env.local');

function parseArgs(argv) {
  const out = { email: null, userId: null, name: 'Claude Code', expiresDays: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email' && argv[i + 1]) {
      out.email = argv[++i];
    } else if (a === '--user-id' && argv[i + 1]) {
      out.userId = argv[++i];
    } else if (a === '--name' && argv[i + 1]) {
      out.name = argv[++i];
    } else if (a === '--expires-days' && argv[i + 1]) {
      out.expiresDays = Number(argv[++i]);
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  npm run agent:token -- --email <email> [--name "Claude Code"]
  node scripts/create-agent-token.mjs --user-id <uuid> [--name "Claude Code"] [--expires-days 90]

Env: .env and/or .env.local in the project root (see .env.example).
`);
      process.exit(0);
    }
  }
  return out;
}

function generateToken() {
  return PREFIX + randomBytes(32).toString('base64url');
}

function hashToken(plaintext) {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Add them to `.env` or `.env.local` in the project root (see .env.example).');
  if (!existsSync(resolve(process.cwd(), '.env')) && !existsSync(resolve(process.cwd(), '.env.local'))) {
    console.error('No .env or .env.local file found in:', process.cwd());
  }
  process.exit(1);
}

const args = parseArgs(process.argv);
if (!args.email && !args.userId) {
  console.error('Provide --email or --user-id');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId = args.userId;
if (!userId && args.email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error('Failed to list users:', error.message);
    process.exit(1);
  }
  const user = (data?.users || []).find((u) => u.email?.toLowerCase() === args.email.toLowerCase());
  if (!user) {
    console.error(`No user found for email: ${args.email}`);
    process.exit(1);
  }
  userId = user.id;
}

const plaintext = generateToken();
const tokenHash = hashToken(plaintext);
const scopes = ['read:debts', 'write:debts', 'read:savings', 'write:savings'];
const expiresAt =
  args.expiresDays && Number.isFinite(args.expiresDays)
    ? new Date(Date.now() + args.expiresDays * 864e5).toISOString()
    : null;

const { data: row, error: insertErr } = await admin
  .from('agent_api_tokens')
  .insert({
    user_id: userId,
    name: args.name,
    token_hash: tokenHash,
    scopes,
    expires_at: expiresAt,
  })
  .select('id, user_id, name, scopes, expires_at')
  .single();

if (insertErr) {
  console.error('Insert failed:', insertErr.message);
  if (/permission denied/i.test(insertErr.message)) {
    console.error(
      'Fix: In Supabase SQL Editor, run supabase/migrations/010_agent_api_tokens_grants.sql'
    );
    console.error(
      'Also confirm SUPABASE_SERVICE_ROLE_KEY is the service_role secret (not the anon key).'
    );
  } else {
    console.error('Did you run migration 009_agent_api_tokens.sql?');
  }
  process.exit(1);
}

console.log('\nAgent token created (copy now — shown once):\n');
console.log(plaintext);
console.log('\nMetadata:');
console.log(JSON.stringify(row, null, 2));
console.log('\nSet in your environment for Claude Code MCP:');
console.log(`  PENNYPATH_AGENT_TOKEN=${plaintext}`);
console.log(`  PENNYPATH_API_BASE_URL=http://localhost:3000`);
