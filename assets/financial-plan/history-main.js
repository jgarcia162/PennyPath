/**
 * History page: compare two months + charts, bars, and optional demo data.
 */

import { PLAN, DEMO_MODE_STORAGE_KEY } from './plan-data.js';
import { applyPlanOverrides } from './persistence.js';
import { syncLegacySavingsFromAccounts } from './savings-accounts.js';
import {
  summarizeMonth,
  collectMonthsWithActivity,
  defaultCompareMonths,
  buildMonthlySeriesForChart,
  monthLabel,
} from './monthly-activity.js';
import { getMockMonthlySeries, mockSummaryByMonthMap } from './history-mock-data.js';
import {
  renderTrendSvg,
  renderCompareBars,
  renderInsightStrip,
  percentChange,
} from './history-visuals.js';
import { createMoneyFormatters, escapeHtml } from './utils.js';
import { STORAGE_KEY } from './plan-data.js';
import { buildMonthCsv, buildMonthCheckpointPayload } from './monthly-export.js';

const { moneyExact } = createMoneyFormatters();

function loadCheckins() {
  try {
    if (window.CheckInService && typeof window.CheckInService.list === 'function') {
      return window.CheckInService.list();
    }
  } catch (e) {}
  return [];
}

function isDemoMode() {
  const el = document.getElementById('demo-mode-toggle');
  return !!(el && el.checked);
}

function formatDelta(diff) {
  if (diff === 0) return '—';
  const sign = diff > 0 ? '+' : '';
  return sign + moneyExact(diff);
}

function formatDeltaCount(diff) {
  if (diff === 0) return '—';
  const sign = diff > 0 ? '+' : '';
  return sign + String(diff);
}

function cardSectionDebt(lines) {
  const nonZero = lines.filter(function (l) {
    return l.total > 0;
  });
  if (!nonZero.length) {
    return '<p class="history-muted">No debt payments logged.</p>';
  }
  return (
    '<ul class="history-line-items">' +
    nonZero
      .map(function (l) {
        return (
          '<li><span class="history-line-name">' +
          escapeHtml(l.debtName) +
          '</span> <span class="history-line-amt">' +
          moneyExact(l.total) +
          '</span></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function cardSectionSavings(lines) {
  const nonZero = lines.filter(function (l) {
    return l.total > 0;
  });
  if (!nonZero.length) {
    return '<p class="history-muted">No savings deposits logged.</p>';
  }
  return (
    '<ul class="history-line-items">' +
    nonZero
      .map(function (l) {
        return (
          '<li><span class="history-line-name">' +
          escapeHtml(l.name) +
          '</span> <span class="history-line-amt">' +
          moneyExact(l.total) +
          '</span></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function cardSectionCheckins(list) {
  if (!list.length) {
    return '<p class="history-muted">No check-ins this month.</p>';
  }
  return (
    '<ul class="history-checkin-list">' +
    list
      .map(function (c) {
        return (
          '<li><span class="history-checkin-date">' +
          escapeHtml(c.date) +
          '</span> — <span class="history-checkin-note">' +
          escapeHtml(c.note || '(no note)') +
          '</span></li>'
        );
      })
      .join('') +
    '</ul>'
  );
}

function monthCard(summary) {
  return (
    '<div class="history-card" data-month="' +
    escapeHtml(summary.yyyyMm) +
    '">' +
    '<h2 class="history-card-title">' +
    escapeHtml(summary.label) +
    '</h2>' +
    '<div class="history-card-block">' +
    '<div class="history-card-block-head">Debt payments</div>' +
    '<p class="history-card-lead">' +
    moneyExact(summary.debtPaymentsTotal) +
    ' total · ' +
    String(
      summary.debtLines.reduce(function (n, l) {
        return n + l.payments.length;
      }, 0)
    ) +
    ' ' +
    (summary.debtLines.reduce(function (n, l) {
      return n + l.payments.length;
    }, 0) === 1
      ? 'entry'
      : 'entries') +
    '</p>' +
    cardSectionDebt(summary.debtLines) +
    '</div>' +
    '<div class="history-card-block">' +
    '<div class="history-card-block-head">Savings deposits</div>' +
    '<p class="history-card-lead">' +
    moneyExact(summary.savingsDepositsTotal) +
    ' total · ' +
    String(
      summary.savingsLines.reduce(function (n, l) {
        return n + l.deposits.length;
      }, 0)
    ) +
    ' ' +
    (summary.savingsLines.reduce(function (n, l) {
      return n + l.deposits.length;
    }, 0) === 1
      ? 'entry'
      : 'entries') +
    '</p>' +
    cardSectionSavings(summary.savingsLines) +
    '</div>' +
    '<div class="history-card-block">' +
    '<div class="history-card-block-head">Check-ins</div>' +
    '<p class="history-card-lead">' +
    String(summary.checkInCount) +
    (summary.checkInCount === 1 ? ' entry' : ' entries') +
    '</p>' +
    cardSectionCheckins(summary.checkIns) +
    '</div>' +
    '</div>'
  );
}

function emptyDemoSummary(yyyyMm) {
  return {
    yyyyMm: yyyyMm,
    label: monthLabel(yyyyMm),
    debtLines: [],
    debtPaymentsTotal: 0,
    savingsLines: [],
    savingsDepositsTotal: 0,
    checkIns: [],
    checkInCount: 0,
    transactionCount: 0,
  };
}

function getSummaryForMonth(yyyyMm, plan, checkins, demo) {
  if (demo) {
    const map = mockSummaryByMonthMap();
    if (map.has(yyyyMm)) return map.get(yyyyMm);
    return emptyDemoSummary(yyyyMm);
  }
  return summarizeMonth(plan, yyyyMm, checkins);
}

function monthTag(yyyyMm) {
  const p = String(yyyyMm).split('-');
  if (p.length < 2) return String(yyyyMm);
  const mo = Number(p[1]);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (names[mo - 1] || p[1]) + " '" + String(p[0]).slice(2);
}

function getChartSeries(plan, checkins, demo) {
  if (demo) return getMockMonthlySeries();
  return buildMonthlySeriesForChart(plan, checkins, 24);
}

function syncDemoBanner(demo) {
  const ban = document.getElementById('history-demo-banner');
  if (ban) ban.hidden = !demo;
}

function downloadTextFile(filename, content, mime) {
  try {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      try {
        URL.revokeObjectURL(url);
      } catch (e2) {}
    }, 4000);
    return true;
  } catch (e) {
    return false;
  }
}

function wireExportImport() {
  const exportMonthInput = document.getElementById('hist-export-month');
  const exportCsvBtn = document.getElementById('hist-export-csv');
  const exportJsonBtn = document.getElementById('hist-export-json');
  const importInput = document.getElementById('hist-import-json');
  const hint = document.getElementById('history-export-hint');
  const demoToggle = document.getElementById('demo-mode-toggle');

  if (!exportMonthInput || !exportCsvBtn || !exportJsonBtn || !importInput) return;

  // Default export month to Month B when available; otherwise “this month”.
  const monthB = document.getElementById('hist-month-b');
  if (monthB && monthB.value && !exportMonthInput.value) exportMonthInput.value = monthB.value;
  if (!exportMonthInput.value) {
    const d = new Date();
    exportMonthInput.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function setHint(msg) {
    if (hint) hint.textContent = msg || '';
  }

  function ensureNotDemoMode() {
    if (demoToggle && demoToggle.checked) {
      setHint('Turn off sample data in Settings (⚙) to export/import your real saved activity.');
      return false;
    }
    return true;
  }

  exportCsvBtn.addEventListener('click', function () {
    if (!ensureNotDemoMode()) return;
    applyPlanOverrides();
    syncLegacySavingsFromAccounts(PLAN);
    const yyyyMm = exportMonthInput.value;
    const checkins = loadCheckins();
    const csv = buildMonthCsv(PLAN, checkins, yyyyMm);
    if (!csv) {
      setHint('Could not build CSV (invalid month).');
      return;
    }
    const ok = downloadTextFile('pennypath-activity-' + String(yyyyMm) + '.csv', csv, 'text/csv;charset=utf-8');
    setHint(ok ? 'Exported CSV for ' + String(yyyyMm) + '.' : 'CSV export failed in this browser.');
  });

  exportJsonBtn.addEventListener('click', function () {
    if (!ensureNotDemoMode()) return;
    applyPlanOverrides();
    syncLegacySavingsFromAccounts(PLAN);
    const yyyyMm = exportMonthInput.value;
    const checkins = loadCheckins();
    const payload = buildMonthCheckpointPayload(PLAN, checkins, yyyyMm);
    if (!payload) {
      setHint('Could not build backup (invalid month).');
      return;
    }
    const content = JSON.stringify(payload, null, 2) + '\n';
    const ok = downloadTextFile(
      'pennypath-checkpoint-' + String(yyyyMm) + '.json',
      content,
      'application/json;charset=utf-8'
    );
    setHint(ok ? 'Exported backup checkpoint for ' + String(yyyyMm) + '.' : 'Backup export failed in this browser.');
  });

  importInput.addEventListener('change', function () {
    if (!ensureNotDemoMode()) return;
    const file = importInput.files && importInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
      let obj;
      try {
        obj = JSON.parse(String(reader.result || ''));
      } catch (e) {
        setHint('Import failed: file is not valid JSON.');
        return;
      }
      if (!obj || obj.schema !== 'pennypath.month-checkpoint' || obj.version !== 1 || !obj.payload) {
        setHint('Import failed: not a PennyPath month checkpoint (v1).');
        return;
      }
      const planPayload = obj.payload.plan;
      const checkins = obj.payload.checkins;
      if (!planPayload || typeof planPayload !== 'object' || !Array.isArray(planPayload.debts)) {
        setHint('Import failed: missing plan payload.');
        return;
      }

      const ok = window.confirm(
        'Import this checkpoint?\n\n' +
          'This will REPLACE your saved Financial Plan balances/debts/savings histories and check-ins in this browser with the contents of the file.\n\n' +
          'Tip: export a backup of your current month first if you want a safety copy.'
      );
      if (!ok) return;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(planPayload));
      } catch (e2) {
        setHint('Import failed: could not write plan data to storage.');
        return;
      }
      try {
        const ckKey =
          window.CheckInService && window.CheckInService.STORAGE_KEY
            ? window.CheckInService.STORAGE_KEY
            : 'financial-plan-v3-aggressive.checkins';
        localStorage.setItem(ckKey, JSON.stringify(Array.isArray(checkins) ? checkins : []));
      } catch (e3) {
        setHint('Import failed: could not write check-ins to storage.');
        return;
      }

      setHint('Imported checkpoint. Reloading…');
      try {
        location.reload();
      } catch (e4) {}
    };
    reader.onerror = function () {
      setHint('Import failed: could not read file.');
    };
    try {
      reader.readAsText(file);
    } catch (e5) {
      setHint('Import failed: could not read file.');
    }
  });
}

function renderInsights(sa, sb, chartSeries, labelA, labelB) {
  const host = document.getElementById('history-insights-root');
  if (!host) return;

  const flowA = sa.debtPaymentsTotal + sa.savingsDepositsTotal;
  const flowB = sb.debtPaymentsTotal + sb.savingsDepositsTotal;
  const engagementPct = Math.min(sb.checkInCount / 4, 1) * 100;

  const strip = renderInsightStrip(
    {
      debtChangePct: percentChange(sa.debtPaymentsTotal, sb.debtPaymentsTotal),
      savingsChangePct: percentChange(sa.savingsDepositsTotal, sb.savingsDepositsTotal),
      flowB: flowB,
      engagementPct: engagementPct,
    },
    moneyExact
  );

  const bars =
    '<div class="history-bars-grid">' +
    renderCompareBars('Debt payments', sa.debtPaymentsTotal, sb.debtPaymentsTotal, labelA, labelB, moneyExact) +
    renderCompareBars(
      'Savings deposits',
      sa.savingsDepositsTotal,
      sb.savingsDepositsTotal,
      labelA,
      labelB,
      moneyExact
    ) +
    renderCompareBars('Combined flow (debt + savings)', flowA, flowB, labelA, labelB, moneyExact) +
    '</div>';

  const chartTitle =
    chartSeries.length >= 2
      ? '<h3 class="history-chart-title">Activity trend <span class="history-chart-sub">(' +
        chartSeries.length +
        ' months)</span></h3>'
      : '';

  host.innerHTML =
    '<section class="history-insights" aria-label="Charts and metrics">' +
    strip +
    bars +
    '<div class="history-chart-section">' +
    chartTitle +
    renderTrendSvg(chartSeries) +
    '</div>' +
    '</section>';
}

function render() {
  applyPlanOverrides();
  syncLegacySavingsFromAccounts(PLAN);

  const demo = isDemoMode();
  syncDemoBanner(demo);

  const checkins = demo ? [] : loadCheckins();
  const inputA = document.getElementById('hist-month-a');
  const inputB = document.getElementById('hist-month-b');
  const host = document.getElementById('history-compare-root');
  const hintEl = document.getElementById('history-months-hint');
  if (!inputA || !inputB || !host) return;

  const def = defaultCompareMonths();
  let ma = inputA.value || def.monthA;
  let mb = inputB.value || def.monthB;

  if (demo) {
    const ms = getMockMonthlySeries();
    if (ms.length >= 2) {
      if (!inputA.value && !inputB.value) {
        ma = ms[ms.length - 2].yyyyMm;
        mb = ms[ms.length - 1].yyyyMm;
        inputA.value = ma;
        inputB.value = mb;
      }
    }
  } else {
    if (!inputA.value) inputA.value = ma;
    if (!inputB.value) inputB.value = mb;
  }

  const monthsWithData = demo
    ? getMockMonthlySeries().map(function (s) {
        return s.yyyyMm;
      })
    : collectMonthsWithActivity(PLAN, checkins);

  if (hintEl) {
    if (demo) {
      hintEl.textContent =
        'Sample data: 14 months of synthetic debt, savings, and check-ins for layout preview. Turn off to use your logs.';
    } else {
      hintEl.textContent =
        monthsWithData.length > 0
          ? 'Months with logged activity: ' +
            monthsWithData.slice(0, 18).join(', ') +
            (monthsWithData.length > 18 ? '…' : '')
          : 'Log payments in Goal 2, deposits in Goal 3, and check-ins on the main plan — or enable sample data in Settings (⚙).';
    }
  }

  const sa = getSummaryForMonth(ma, PLAN, checkins, demo);
  const sb = getSummaryForMonth(mb, PLAN, checkins, demo);
  const chartSeries = getChartSeries(PLAN, checkins, demo);

  renderInsights(sa, sb, chartSeries, monthTag(ma), monthTag(mb));

  const dDebt = sb.debtPaymentsTotal - sa.debtPaymentsTotal;
  const dSav = sb.savingsDepositsTotal - sa.savingsDepositsTotal;
  const dCi = sb.checkInCount - sa.checkInCount;
  const dTx = sb.transactionCount - sa.transactionCount;

  const deltaHtml =
    '<div class="history-delta">' +
    '<h3 class="history-delta-title">Comparison <span class="history-delta-sub">(' +
    escapeHtml(sb.label) +
    ' vs ' +
    escapeHtml(sa.label) +
    ')</span></h3>' +
    '<div class="history-delta-grid">' +
    '<div class="history-delta-item"><span class="history-delta-label">Debt payments</span>' +
    '<span class="history-delta-val">' +
    formatDelta(dDebt) +
    '</span></div>' +
    '<div class="history-delta-item"><span class="history-delta-label">Savings deposits</span>' +
    '<span class="history-delta-val">' +
    formatDelta(dSav) +
    '</span></div>' +
    '<div class="history-delta-item"><span class="history-delta-label">Check-ins</span>' +
    '<span class="history-delta-val">' +
    formatDeltaCount(dCi) +
    '</span></div>' +
    '<div class="history-delta-item"><span class="history-delta-label">Logged transactions</span>' +
    '<span class="history-delta-val">' +
    formatDeltaCount(dTx) +
    '</span></div>' +
    '</div>' +
    '</div>';

  host.innerHTML =
    deltaHtml +
    '<div class="history-columns">' +
    monthCard(sa) +
    monthCard(sb) +
    '</div>';
}

function wire() {
  const inputA = document.getElementById('hist-month-a');
  const inputB = document.getElementById('hist-month-b');
  const swapBtn = document.getElementById('hist-swap');
  const demoToggle = document.getElementById('demo-mode-toggle');

  try {
    const stored = localStorage.getItem(DEMO_MODE_STORAGE_KEY);
    const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    const demoFromUrl = params && params.get('demo') === '1';
    if (demoToggle) {
      if (demoFromUrl) {
        demoToggle.checked = true;
        localStorage.setItem(DEMO_MODE_STORAGE_KEY, '1');
      } else if (stored === '1') {
        demoToggle.checked = true;
      }
    }
  } catch (e) {}

  if (demoToggle && demoToggle.checked && inputA && inputB && !inputA.value && !inputB.value) {
    const ms = getMockMonthlySeries();
    if (ms.length >= 2) {
      inputA.value = ms[ms.length - 2].yyyyMm;
      inputB.value = ms[ms.length - 1].yyyyMm;
    }
  }

  const def = defaultCompareMonths();
  if (inputA && !inputA.value && !(demoToggle && demoToggle.checked)) inputA.value = def.monthA;
  if (inputB && !inputB.value && !(demoToggle && demoToggle.checked)) inputB.value = def.monthB;

  if (inputA) inputA.addEventListener('change', render);
  if (inputB) inputB.addEventListener('change', render);
  if (swapBtn) {
    swapBtn.addEventListener('click', function () {
      if (!inputA || !inputB) return;
      const t = inputA.value;
      inputA.value = inputB.value;
      inputB.value = t;
      render();
    });
  }

  wireExportImport();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire);
} else {
  wire();
}
