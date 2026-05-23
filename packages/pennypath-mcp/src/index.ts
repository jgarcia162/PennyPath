#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { PennyPathApiClient } from './api-client.js';

function jsonText(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

const ledgerStatusSchema = z.enum(['active', 'completed', 'deleted', 'all']).optional();

async function main(): Promise<void> {
  const api = PennyPathApiClient.fromEnv();
  const server = new McpServer({
    name: 'pennypath',
    version: '0.1.0',
  });

  server.registerTool(
    'pennypath_get_plan_summary',
    {
      description:
        'Read a high-level summary of the user PennyPath plan: take-home pay, HYSA targets, active debt totals, and savings totals. Read-only.',
      inputSchema: z.object({}),
    },
    async () => jsonText(await api.getPlanSummary())
  );

  server.registerTool(
    'pennypath_list_debts',
    {
      description:
        'List debt accounts. Defaults to active debts. Use ledgerStatus to include completed/deleted/all.',
      inputSchema: z.object({
        ledgerStatus: ledgerStatusSchema.describe('Filter: active | completed | deleted | all'),
      }),
    },
    async ({ ledgerStatus }) => jsonText(await api.listDebts(ledgerStatus ?? 'active'))
  );

  server.registerTool(
    'pennypath_get_debt',
    {
      description: 'Get one debt account by id, including recent payment history.',
      inputSchema: z.object({
        id: z.string().min(1).describe('Debt id'),
      }),
    },
    async ({ id }) => jsonText(await api.getDebt(id))
  );

  server.registerTool(
    'pennypath_update_debt',
    {
      description:
        'Update a debt account (name, current balance, aprPct, paidOff, ledgerStatus, deferred fields). Persists to PennyPath.',
      inputSchema: z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        current: z.number().min(0).optional(),
        aprPct: z.number().min(0).optional(),
        paidOff: z.number().min(0).optional(),
        ledgerStatus: z.enum(['active', 'completed', 'deleted']).optional(),
        deferredAmount: z.number().min(0).optional(),
        deferredExpiresOn: z.string().optional(),
        deferredMonthsRemaining: z.number().min(0).optional(),
      }),
    },
    async ({ id, ...patch }) => jsonText(await api.updateDebt(id, patch))
  );

  server.registerTool(
    'pennypath_add_debt_payment',
    {
      description:
        'Record a payment on a debt: adds payment history and reduces current balance by amount. Persists to PennyPath.',
      inputSchema: z.object({
        id: z.string().min(1),
        amount: z.number().positive(),
        at: z.string().optional().describe('ISO timestamp; defaults to now'),
      }),
    },
    async ({ id, amount, at }) => jsonText(await api.addDebtPayment(id, amount, at))
  );

  server.registerTool(
    'pennypath_list_savings_accounts',
    {
      description: 'List all savings accounts with balances, APY, and deposit history.',
      inputSchema: z.object({}),
    },
    async () => jsonText(await api.listSavingsAccounts())
  );

  server.registerTool(
    'pennypath_get_savings_account',
    {
      description: 'Get one savings account by id.',
      inputSchema: z.object({
        id: z.string().min(1),
      }),
    },
    async ({ id }) => jsonText(await api.getSavingsAccount(id))
  );

  server.registerTool(
    'pennypath_update_savings_account',
    {
      description:
        'Update a savings account (name, current balance, apyPct, countTowardsGoal, ledgerStatus). Persists to PennyPath.',
      inputSchema: z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        current: z.number().optional(),
        apyPct: z.number().min(0).optional(),
        countTowardsGoal: z.boolean().optional(),
        ledgerStatus: z.enum(['active', 'deleted']).optional(),
      }),
    },
    async ({ id, ...patch }) => jsonText(await api.updateSavingsAccount(id, patch))
  );

  server.registerTool(
    'pennypath_add_savings_deposit',
    {
      description:
        'Record a deposit on a savings account: adds deposit history and increases current balance. Persists to PennyPath.',
      inputSchema: z.object({
        id: z.string().min(1),
        amount: z.number().positive(),
        at: z.string().optional().describe('ISO timestamp; defaults to now'),
      }),
    },
    async ({ id, amount, at }) => jsonText(await api.addSavingsDeposit(id, amount, at))
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[pennypath-mcp]', err);
  process.exit(1);
});
