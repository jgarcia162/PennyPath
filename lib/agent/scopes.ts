export const AGENT_SCOPES = [
  'read:debts',
  'write:debts',
  'read:savings',
  'write:savings',
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

export const AGENT_SCOPE_SET = new Set<string>(AGENT_SCOPES);

export function parseScopes(raw: unknown): AgentScope[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is AgentScope => typeof s === 'string' && AGENT_SCOPE_SET.has(s));
}

export function hasScope(scopes: readonly string[], required: AgentScope): boolean {
  return scopes.includes(required);
}

export function hasAnyScope(scopes: readonly string[], required: AgentScope[]): boolean {
  return required.some((s) => scopes.includes(s));
}

/** Default scopes for new Claude Code tokens. */
export const DEFAULT_AGENT_SCOPES: AgentScope[] = [
  'read:debts',
  'write:debts',
  'read:savings',
  'write:savings',
];
