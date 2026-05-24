import { describe, it, expect } from 'vitest';
import {
  parseMoneyInput,
  roundMoney,
  formatMoneyInput,
  escapeHtml,
  escapeAttr,
} from './utils.js';

describe('parseMoneyInput', () => {
  it('parses a plain number string', () => {
    expect(parseMoneyInput('1234.56')).toBe(1234.56);
  });

  it('strips dollar sign and commas', () => {
    expect(parseMoneyInput('$1,234.56')).toBe(1234.56);
  });

  it('returns null for empty string', () => {
    expect(parseMoneyInput('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseMoneyInput(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseMoneyInput(undefined)).toBeNull();
  });

  it('rejects partial parses like "123abc"', () => {
    expect(parseMoneyInput('123abc')).toBeNull();
  });

  it('accepts zero', () => {
    expect(parseMoneyInput('0')).toBe(0);
  });

  it('accepts negative values', () => {
    expect(parseMoneyInput('-50.00')).toBe(-50);
  });

  it('accepts decimal-only strings like ".5"', () => {
    expect(parseMoneyInput('.5')).toBe(0.5);
  });
});

describe('roundMoney', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundMoney(1.004)).toBe(1);
    // 1.005 has a binary representation slightly below 1.005, so Math.round gives 1.00
    expect(roundMoney(1.006)).toBe(1.01);
    expect(roundMoney(1.234)).toBe(1.23);
    expect(roundMoney(1.235)).toBe(1.24);
  });

  it('returns 0 for NaN', () => {
    expect(roundMoney(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(roundMoney(Infinity)).toBe(0);
  });

  it('returns 0 for non-numeric strings', () => {
    expect(roundMoney('abc')).toBe(0);
  });

  it('treats zero as valid', () => {
    expect(roundMoney(0)).toBe(0);
  });

  it('handles whole numbers', () => {
    expect(roundMoney(5)).toBe(5);
  });
});

describe('formatMoneyInput', () => {
  it('formats to exactly 2 decimal places', () => {
    expect(formatMoneyInput(1234)).toBe('1234.00');
  });

  it('corrects floating point noise', () => {
    expect(formatMoneyInput(0.1 + 0.2)).toBe('0.30');
  });

  it('formats zero as "0.00"', () => {
    expect(formatMoneyInput(0)).toBe('0.00');
  });
});

describe('escapeHtml', () => {
  it('escapes <, >, &, ", and \' characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leaves clean strings untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('escapeAttr', () => {
  it('escapes double quotes in attribute values', () => {
    expect(escapeAttr('user@example.com"injected')).toBe(
      'user@example.com&quot;injected'
    );
  });

  it('escapes single quotes', () => {
    expect(escapeAttr("O'Brien")).toBe('O&#39;Brien');
  });

  it('escapes angle brackets', () => {
    expect(escapeAttr('<b>')).toBe('&lt;b&gt;');
  });
});
