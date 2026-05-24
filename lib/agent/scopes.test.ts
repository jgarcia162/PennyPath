import { describe, it, expect } from 'vitest';
import {
  AGENT_SCOPES,
  DEFAULT_AGENT_SCOPES,
  hasAnyScope,
  hasScope,
  parseScopes,
} from './scopes.js';

describe('parseScopes', () => {
  it('accepts all known AGENT_SCOPES', () => {
    expect(parseScopes([...AGENT_SCOPES])).toEqual([...AGENT_SCOPES]);
  });

  it('filters out unknown scope strings', () => {
    expect(parseScopes(['read:debts', 'admin:all'])).toEqual(['read:debts']);
  });

  it('returns empty array for an empty array', () => {
    expect(parseScopes([])).toEqual([]);
  });

  it('returns empty array for null', () => {
    expect(parseScopes(null)).toEqual([]);
  });

  it('returns empty array for a plain string', () => {
    expect(parseScopes('read:debts')).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseScopes(undefined)).toEqual([]);
  });
});

describe('hasScope', () => {
  const scopes = ['read:debts', 'write:savings'] as const;

  it('returns true when the scope is present', () => {
    expect(hasScope(scopes, 'read:debts')).toBe(true);
  });

  it('returns false when the scope is absent', () => {
    expect(hasScope(scopes, 'write:debts')).toBe(false);
  });

  it('returns false for an empty scope list', () => {
    expect(hasScope([], 'read:debts')).toBe(false);
  });
});

describe('hasAnyScope', () => {
  const scopes = ['read:debts'] as const;

  it('returns true if at least one required scope is present', () => {
    expect(hasAnyScope(scopes, ['read:debts', 'write:debts'])).toBe(true);
  });

  it('returns false if none of the required scopes are present', () => {
    expect(hasAnyScope(scopes, ['write:debts', 'read:savings'])).toBe(false);
  });

  it('returns false for an empty required list', () => {
    expect(hasAnyScope(scopes, [])).toBe(false);
  });
});

describe('DEFAULT_AGENT_SCOPES', () => {
  it('contains all four expected scopes', () => {
    expect(DEFAULT_AGENT_SCOPES).toContain('read:debts');
    expect(DEFAULT_AGENT_SCOPES).toContain('write:debts');
    expect(DEFAULT_AGENT_SCOPES).toContain('read:savings');
    expect(DEFAULT_AGENT_SCOPES).toContain('write:savings');
  });

  it('contains exactly 4 scopes', () => {
    expect(DEFAULT_AGENT_SCOPES).toHaveLength(4);
  });
});
