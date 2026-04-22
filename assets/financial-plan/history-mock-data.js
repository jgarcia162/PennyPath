/**
 * Deterministic mock monthly summaries for History UI development.
 * Same shape as summarizeMonth() from monthly-activity.js.
 * Mirrors dev-mock-storage.js structure (multiple debts & savings accounts).
 */

import { monthLabel, yyyyMmFromDate } from './monthly-activity';

function seeded(i, salt) {
  const x = Math.sin(i * 12.9898 + salt * 7.123) * 43758.5453;
  return x - Math.floor(x);
}

function money(n) {
  return Math.round(n * 100) / 100;
}

/** Keep in sync with dev-mock-storage MOCK_HISTORY_MONTHS for similar chart length. */
const MOCK_SERIES_MONTHS = 22;

export function buildMockMonthlySeries() {
  const now = new Date();
  const count = MOCK_SERIES_MONTHS;
  const out = [];

  let cc = 3200;
  let car = 620;
  let student = 335;
  let savHysa = 920;
  let savJose = 180;
  let savSher = 420;
  let savVac = 140;
  let savKids = 310;
  let savBond = 55;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyyMm = yyyyMmFromDate(d);
    const idx = count - 1 - i;

    cc += 160 * seeded(idx, 1) - 70 * seeded(idx, 2);
    cc = Math.max(2100, Math.min(4500, cc));
    car += 25 * seeded(idx, 11) - 12;
    car = Math.max(380, Math.min(720, car));
    student += 18 * seeded(idx, 12) - 8;
    student = Math.max(260, Math.min(420, student));

    savHysa += 110 * seeded(idx, 3) - 45;
    savHysa = Math.max(400, savHysa);
    savJose += 35 * seeded(idx, 4);
    savSher += 55 * seeded(idx, 5) - 22;
    savSher = Math.max(0, savSher);
    savVac += 28 * seeded(idx, 13);
    savKids += 45 * seeded(idx, 14);
    savBond += 12 * seeded(idx, 15);

    const ci = Math.floor(1 + seeded(idx, 6) * 4);
    const txDebtCc = 3 + Math.floor(seeded(idx, 7) * 4);
    const txDebtCar = 1 + Math.floor(seeded(idx, 16) * 2);
    const txDebtStu = 1;
    const txSav = 2 + Math.floor(seeded(idx, 8) * 5);

    const debtLines = [
      {
        debtId: 'cc',
        debtName: 'Credit Cards',
        total: money(cc),
        payments: Array.from({ length: txDebtCc }, function (_, j) {
          return {
            amount: money(cc / txDebtCc + (seeded(idx + j, 9) - 0.5) * 55),
            at: d.toISOString(),
          };
        }),
      },
      {
        debtId: 'car',
        debtName: 'Car loan',
        total: money(car),
        payments: Array.from({ length: txDebtCar }, function (_, j) {
          return {
            amount: money(car / Math.max(1, txDebtCar) + (seeded(idx + j, 17) - 0.5) * 20),
            at: d.toISOString(),
          };
        }),
      },
      {
        debtId: 'student',
        debtName: 'Student loan',
        total: money(student),
        payments: Array.from({ length: txDebtStu }, function (_, j) {
          return {
            amount: money(student + (seeded(idx + j, 18) - 0.5) * 15),
            at: d.toISOString(),
          };
        }),
      },
    ];

    const debtPaymentsTotal = money(cc + car + student);

    const savingsLines = [
      {
        accountId: 'hysa',
        name: 'Joint Savings',
        total: money(savHysa),
        deposits:
          savHysa > 50
            ? Array.from({ length: Math.min(4, txSav) }, function (_, j) {
                return {
                  amount: money(savHysa / Math.max(1, txSav) + j * 12),
                  at: d.toISOString(),
                };
              })
            : [],
      },
      {
        accountId: 'jose',
        name: 'Jose — personal',
        total: money(savJose),
        deposits:
          savJose > 0.01
            ? [{ amount: money(savJose), at: d.toISOString() }]
            : [],
      },
      {
        accountId: 'sher',
        name: 'Sherlyna — personal',
        total: money(savSher),
        deposits:
          savSher > 0.01
            ? [{ amount: money(savSher), at: d.toISOString() }]
            : [],
      },
      {
        accountId: 'vacation',
        name: 'Vacation fund',
        total: money(savVac),
        deposits: savVac > 5 ? [{ amount: money(savVac), at: d.toISOString() }] : [],
      },
      {
        accountId: 'kids',
        name: 'Kids — 529',
        total: money(savKids),
        deposits: [{ amount: money(savKids), at: d.toISOString() }],
      },
      {
        accountId: 'ibonds',
        name: 'I-Bonds ladder',
        total: money(savBond),
        deposits: savBond > 1 ? [{ amount: money(savBond), at: d.toISOString() }] : [],
      },
    ];

    const savingsDepositsTotal = money(savHysa + savJose + savSher + savVac + savKids + savBond);

    const checkIns = Array.from({ length: ci }, function (_, j) {
      const day = 2 + j * 6 + Math.floor(seeded(idx + j, 10) * 6);
      return {
        id: 'mock_' + yyyyMm + '_' + j,
        date: yyyyMm + '-' + String(Math.min(28, day)).padStart(2, '0'),
        note: ['Budget review', 'Paycheck sync', 'Goal check-in', 'Family sync', '529 review', 'Debt check'][j % 6],
      };
    });

    const transactionCount =
      debtLines.reduce(function (n, line) {
        return n + line.payments.length;
      }, 0) +
      savingsLines.reduce(function (n, line) {
        return n + line.deposits.length;
      }, 0);

    out.push({
      yyyyMm: yyyyMm,
      label: monthLabel(yyyyMm),
      debtLines: debtLines,
      debtPaymentsTotal: debtPaymentsTotal,
      savingsLines: savingsLines,
      savingsDepositsTotal: savingsDepositsTotal,
      checkIns: checkIns,
      checkInCount: checkIns.length,
      transactionCount: transactionCount,
    });
  }

  return out;
}

let _cached = null;

export function getMockMonthlySeries() {
  if (!_cached) _cached = buildMockMonthlySeries();
  return _cached;
}

export function mockSummaryByMonthMap() {
  const map = new Map();
  getMockMonthlySeries().forEach(function (s) {
    map.set(s.yyyyMm, s);
  });
  return map;
}
