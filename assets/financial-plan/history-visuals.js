/**
 * SVG charts + comparison bars for History page (no external deps).
 */

import { escapeHtml } from './utils';

/** B as % of A; null if A is 0. */
export function percentOfReference(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null;
  return (b / a) * 100;
}

export function formatPct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return p.toFixed(0) + '%';
}

export function formatSignedPct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  const sign = p > 0 ? '+' : '';
  return sign + p.toFixed(0) + '%';
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number|null} percent change from a to b
 */
export function percentChange(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return null;
  return ((b - a) / a) * 100;
}

/**
 * @param {Array<{ debtPaymentsTotal: number, savingsDepositsTotal: number, checkInCount: number }>} series oldest→newest
 */
export function renderTrendSvg(series, opts) {
  const w = (opts && opts.width) || 800;
  const h = (opts && opts.height) || 240;
  const padL = 52;
  const padR = 28;
  const padT = 28;
  const padB = 52;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  if (!series || series.length < 2) {
    return (
      '<div class="history-chart-empty">Add more months of activity to see a trend line.</div>'
    );
  }

  const debts = series.map(function (s) {
    return s.debtPaymentsTotal;
  });
  const savs = series.map(function (s) {
    return s.savingsDepositsTotal;
  });

  const all = debts.concat(savs);
  let minV = Math.min.apply(null, all);
  let maxV = Math.max.apply(null, all);
  if (maxV <= minV) {
    minV = 0;
    maxV = Math.max(1, maxV);
  }
  const padY = (maxV - minV) * 0.08 || 1;
  minV = Math.max(0, minV - padY);
  maxV = maxV + padY;

  const n = series.length;
  const xAt = function (i) {
    return padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  };
  const yAt = function (v) {
    return padT + innerH - ((v - minV) / (maxV - minV)) * innerH;
  };

  function polyline(vals) {
    return vals
      .map(function (v, i) {
        return (i === 0 ? 'M' : 'L') + xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1);
      })
      .join(' ');
  }

  const shortLabels = series.map(function (s) {
    const p = String(s.yyyyMm || '').split('-');
    if (p.length < 2) return '';
    const mo = Number(p[1]);
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (names[mo - 1] || p[1]) + " '" + String(p[0]).slice(2);
  });

  const gridLines = 4;
  let gridSvg = '';
  for (let g = 0; g <= gridLines; g++) {
    const gv = minV + (g / gridLines) * (maxV - minV);
    const gy = yAt(gv);
    gridSvg +=
      '<line class="history-chart-grid" x1="' +
      padL +
      '" y1="' +
      gy.toFixed(1) +
      '" x2="' +
      (w - padR) +
      '" y2="' +
      gy.toFixed(1) +
      '" />';
    gridSvg +=
      '<text class="history-chart-axis" x="' +
      (padL - 8) +
      '" y="' +
      (gy + 4) +
      '" text-anchor="end">' +
      escapeHtml(formatAxisMoney(gv)) +
      '</text>';
  }

  let xLabels = '';
  series.forEach(function (_, i) {
    if (n > 8 && i % 2 === 1) return;
    const x = xAt(i);
    xLabels +=
      '<text class="history-chart-x" x="' +
      x.toFixed(1) +
      '" y="' +
      (h - 18) +
      '" text-anchor="middle">' +
      escapeHtml(shortLabels[i] || '') +
      '</text>';
  });

  return (
    '<div class="history-chart-svg-wrap">' +
    '<svg class="history-chart-svg" viewBox="0 0 ' +
    w +
    ' ' +
    h +
    '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Debt and savings trend">' +
    '<title>Debt vs savings deposits over time</title>' +
    gridSvg +
    '<path class="history-chart-line history-chart-line--debt" d="' +
    polyline(debts) +
    '" fill="none" />' +
    '<path class="history-chart-line history-chart-line--savings" d="' +
    polyline(savs) +
    '" fill="none" />' +
    xLabels +
    '</svg>' +
    '<div class="history-chart-legend">' +
    '<span class="history-leg history-leg--debt"><i></i> Debt payments</span>' +
    '<span class="history-leg history-leg--savings"><i></i> Savings deposits</span>' +
    '</div>' +
    '</div>'
  );
}

function formatAxisMoney(v) {
  if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
  return String(Math.round(v));
}

/**
 * Side-by-side horizontal bars for comparing two values on a shared scale.
 */
export function renderCompareBars(label, valA, valB, labelA, labelB, moneyExact) {
  const max = Math.max(valA, valB, 1);
  const pctA = (valA / max) * 100;
  const pctB = (valB / max) * 100;
  const refPct = percentOfReference(valA, valB);
  const refHtml =
    refPct == null
      ? '<span class="history-bar-ref">—</span>'
      : '<span class="history-bar-ref">Month B = <strong>' +
        formatPct(refPct) +
        '</strong> of Month A</span>';

  return (
    '<div class="history-bar-block">' +
    '<div class="history-bar-head">' +
    '<span class="history-bar-title">' +
    escapeHtml(label) +
    '</span>' +
    refHtml +
    '</div>' +
    '<div class="history-bar-row">' +
    '<span class="history-bar-tag history-bar-tag--a">' +
    escapeHtml(labelA) +
    '</span>' +
    '<div class="history-bar-track">' +
    '<div class="history-bar-fill history-bar-fill--a" style="width:' +
    pctA.toFixed(1) +
    '%"></div>' +
    '</div>' +
    '<span class="history-bar-amt">' +
    moneyExact(valA) +
    '</span>' +
    '</div>' +
    '<div class="history-bar-row">' +
    '<span class="history-bar-tag history-bar-tag--b">' +
    escapeHtml(labelB) +
    '</span>' +
    '<div class="history-bar-track">' +
    '<div class="history-bar-fill history-bar-fill--b" style="width:' +
    pctB.toFixed(1) +
    '%"></div>' +
    '</div>' +
    '<span class="history-bar-amt">' +
    moneyExact(valB) +
    '</span>' +
    '</div>' +
    '</div>'
  );
}

/**
 * @param {object} m
 * @param {function} moneyExact
 */
export function renderInsightStrip(m, moneyExact) {
  const cards = [
    {
      k: 'Debt Δ',
      v: m.debtChangePct == null ? '—' : formatSignedPct(m.debtChangePct),
      sub: 'Month B vs A',
      cls: 'history-pill--debt',
    },
    {
      k: 'Savings Δ',
      v: m.savingsChangePct == null ? '—' : formatSignedPct(m.savingsChangePct),
      sub: 'deposits',
      cls: 'history-pill--sav',
    },
    {
      k: 'Combined flow',
      v: moneyExact(m.flowB || 0),
      sub: 'Month B total effort',
      cls: 'history-pill--flow',
    },
    {
      k: 'Engagement',
      v: formatPct(m.engagementPct),
      sub: 'check-ins vs 4/mo goal',
      cls: 'history-pill--eng',
    },
  ];

  return (
    '<div class="history-pill-row">' +
    cards
      .map(function (c) {
        return (
          '<div class="history-pill ' +
          c.cls +
          '">' +
          '<div class="history-pill-k">' +
          escapeHtml(c.k) +
          '</div>' +
          '<div class="history-pill-v">' +
          escapeHtml(c.v) +
          '</div>' +
          '<div class="history-pill-sub">' +
          escapeHtml(c.sub) +
          '</div>' +
          '</div>'
        );
      })
      .join('') +
    '</div>'
  );
}
