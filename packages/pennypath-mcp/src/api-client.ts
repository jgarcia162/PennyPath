const DEFAULT_BASE = 'http://localhost:3000';

export type ApiOk<T> = { ok: true } & T;
export type ApiErr = { ok: false; error: string };

export class PennyPathApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  static fromEnv(): PennyPathApiClient {
    const token = process.env.PENNYPATH_AGENT_TOKEN?.trim();
    if (!token) {
      throw new Error('PENNYPATH_AGENT_TOKEN is required');
    }
    const baseUrl = (process.env.PENNYPATH_API_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
    return new PennyPathApiClient(baseUrl, token);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json: ApiOk<T> | ApiErr;
    try {
      json = JSON.parse(text) as ApiOk<T> | ApiErr;
    } catch {
      throw new Error(`Invalid JSON from API (${res.status}): ${text.slice(0, 500)}`);
    }

    if (!res.ok || !json.ok) {
      const msg = 'error' in json && json.error ? json.error : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return json as T;
  }

  getPlanSummary() {
    return this.request<{ summary: unknown }>('GET', '/api/agent/v1/plan/summary');
  }

  listDebts(ledgerStatus = 'active') {
    const q = ledgerStatus ? `?ledgerStatus=${encodeURIComponent(ledgerStatus)}` : '';
    return this.request<{ debts: unknown[] }>('GET', `/api/agent/v1/debts${q}`);
  }

  getDebt(id: string) {
    return this.request<{ debt: unknown }>('GET', `/api/agent/v1/debts/${encodeURIComponent(id)}`);
  }

  updateDebt(id: string, patch: Record<string, unknown>) {
    return this.request<{ debt: unknown }>('PATCH', `/api/agent/v1/debts/${encodeURIComponent(id)}`, patch);
  }

  addDebtPayment(id: string, amount: number, at?: string) {
    return this.request<{ debt: unknown; payment: unknown }>(
      'POST',
      `/api/agent/v1/debts/${encodeURIComponent(id)}/payments`,
      { amount, ...(at ? { at } : {}) }
    );
  }

  listSavingsAccounts() {
    return this.request<{ savingsAccounts: unknown[] }>('GET', '/api/agent/v1/savings-accounts');
  }

  getSavingsAccount(id: string) {
    return this.request<{ savingsAccount: unknown }>(
      'GET',
      `/api/agent/v1/savings-accounts/${encodeURIComponent(id)}`
    );
  }

  updateSavingsAccount(id: string, patch: Record<string, unknown>) {
    return this.request<{ savingsAccount: unknown }>(
      'PATCH',
      `/api/agent/v1/savings-accounts/${encodeURIComponent(id)}`,
      patch
    );
  }

  addSavingsDeposit(id: string, amount: number, at?: string) {
    return this.request<{ savingsAccount: unknown; deposit: unknown }>(
      'POST',
      `/api/agent/v1/savings-accounts/${encodeURIComponent(id)}/deposits`,
      { amount, ...(at ? { at } : {}) }
    );
  }
}
