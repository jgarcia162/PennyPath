/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PLAN } from './plan-data';

const savedCache = {
  currentId: 'cal-1',
  versions: [
    {
      id: 'cal-1',
      at: '2026-10-03T12:00:00.000Z',
      notes: 'latest',
      events: [{ date: '2026-10-01', kind: 'bill', label: 'Rent', amount: 1200, debtName: '' }],
    },
    {
      id: 'cal-2',
      at: '2026-09-01T12:00:00.000Z',
      notes: 'older',
      events: [{ date: '2026-09-15', kind: 'bill', label: 'Phone', amount: 80, debtName: '' }],
    },
  ],
};

const setBillCalendar = vi.fn(async () => {});

vi.mock('../../lib/repositories', () => ({
  getRepositories: () => ({
    aiCacheRepository: {
      getBillCalendar: async () => savedCache,
      setBillCalendar,
      getColumns: async () => null,
      getBillCalendarColumns: async () => {},
    },
  }),
}));

import { wireBillPaymentCalendar } from './ai-bill-calendar-wire';

function mountCalendarDom() {
  document.body.innerHTML =
    '<input id="ai-bill-cal-file" type="file" />' +
    '<button type="button" id="btn-ai-bill-cal-generate" disabled></button>' +
    '<span id="ai-bill-cal-status"></span>' +
    '<div id="ai-bill-cal-host"></div>' +
    '<input id="ai-bill-cal-col-name" value="name" />' +
    '<input id="ai-bill-cal-col-amount" value="amount" />' +
    '<input id="ai-bill-cal-col-due" value="due_day" />' +
    '<button type="button" id="btn-ai-bill-cal-open-prompt" disabled></button>' +
    '<button type="button" id="btn-ai-bill-cal-saved" disabled></button>';
}

describe('saved calendars UI', () => {
  beforeEach(() => {
    setBillCalendar.mockClear();
    mountCalendarDom();
  });

  it('restores the last calendar without a CSV and lists prior versions', async () => {
    wireBillPaymentCalendar(PLAN);

    await vi.waitFor(function () {
      expect(document.querySelector('.ai-bill-cal-month')).toBeTruthy();
    });
    expect(document.getElementById('ai-bill-cal-host')?.textContent).toContain('Rent');

    const savedBtn = document.getElementById('btn-ai-bill-cal-saved') as HTMLButtonElement;
    expect(savedBtn.disabled).toBe(false);
    savedBtn.click();

    await vi.waitFor(function () {
      expect(document.querySelectorAll('.ai-bill-cal-saved-row').length).toBe(2);
    });

    const viewBtns = document.querySelectorAll('.ai-bill-cal-saved-row__view') as NodeListOf<HTMLButtonElement>;
    expect(viewBtns[1].disabled).toBe(false);
    viewBtns[1].click();

    await vi.waitFor(function () {
      expect(document.getElementById('ai-bill-cal-host')?.textContent).toContain('Phone');
    });
    expect(setBillCalendar).toHaveBeenCalled();
  });
});
