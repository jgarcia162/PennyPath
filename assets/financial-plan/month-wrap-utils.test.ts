import { describe, it, expect } from 'vitest';
import {
  defaultWrapDestinationYm,
  listWrapDestinationMonths,
  nextYyyyYm,
  wrapDestinationOptionLabel,
} from './month-wrap-utils.js';

describe('nextYyyyYm', () => {
  it('advances one calendar month', () => {
    expect(nextYyyyYm('2026-05')).toBe('2026-06');
  });

  it('rolls over the year', () => {
    expect(nextYyyyYm('2026-12')).toBe('2027-01');
  });
});

describe('defaultWrapDestinationYm', () => {
  it('jumps to the current calendar month when the working month is behind', () => {
    expect(defaultWrapDestinationYm('2026-05', new Date(2026, 7, 30))).toBe('2026-08');
  });

  it('uses the next month when already on the current calendar month', () => {
    expect(defaultWrapDestinationYm('2026-08', new Date(2026, 7, 30))).toBe('2026-09');
  });

  it('uses the next month when the working month is ahead of the calendar', () => {
    expect(defaultWrapDestinationYm('2026-10', new Date(2026, 7, 30))).toBe('2026-11');
  });
});

describe('listWrapDestinationMonths', () => {
  it('starts at the month after wrap and includes the current calendar month', () => {
    const months = listWrapDestinationMonths('2026-05', new Date(2026, 7, 30));
    expect(months[0]).toBe('2026-06');
    expect(months).toContain('2026-08');
    expect(months).not.toContain('2026-05');
  });
});

describe('wrapDestinationOptionLabel', () => {
  it('marks the current calendar month', () => {
    expect(wrapDestinationOptionLabel('2026-08', new Date(2026, 7, 30))).toBe('August 2026 (this month)');
    expect(wrapDestinationOptionLabel('2026-06', new Date(2026, 7, 30))).toBe('June 2026');
  });
});
