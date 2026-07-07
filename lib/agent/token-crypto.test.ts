import { describe, it, expect } from 'vitest';
import { generateAgentTokenPlaintext, hashAgentToken, isAgentTokenFormat } from './token-crypto';

describe('generateAgentTokenPlaintext', () => {
  it('starts with pp_agent_', () => {
    expect(generateAgentTokenPlaintext()).toMatch(/^pp_agent_/);
  });

  it('is longer than 50 characters', () => {
    expect(generateAgentTokenPlaintext().length).toBeGreaterThan(50);
  });

  it('generates unique tokens on successive calls', () => {
    expect(generateAgentTokenPlaintext()).not.toBe(generateAgentTokenPlaintext());
  });
});

describe('hashAgentToken', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashAgentToken('pp_agent_testtoken');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const token = 'pp_agent_abc123';
    expect(hashAgentToken(token)).toBe(hashAgentToken(token));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashAgentToken('pp_agent_aaa')).not.toBe(hashAgentToken('pp_agent_bbb'));
  });
});

describe('isAgentTokenFormat', () => {
  it('returns true for a valid generated token', () => {
    expect(isAgentTokenFormat(generateAgentTokenPlaintext())).toBe(true);
  });

  it('returns true for a manually constructed valid token', () => {
    expect(isAgentTokenFormat('pp_agent_' + 'x'.repeat(30))).toBe(true);
  });

  it('returns false for wrong prefix', () => {
    expect(isAgentTokenFormat('sk_live_' + 'x'.repeat(30))).toBe(false);
  });

  it('returns false for a too-short token (just the prefix + few chars)', () => {
    expect(isAgentTokenFormat('pp_agent_short')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAgentTokenFormat('')).toBe(false);
  });
});
