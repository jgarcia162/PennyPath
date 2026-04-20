/**
 * CSV bills + AI-generated payment calendar (bills + debt payment dates as JSON from Gemini).
 */

import {
  AI_PAYOFF_PLAN_CACHE_LS_KEY,
  AI_BILL_CALENDAR_CACHE_LS_KEY,
  AI_BILL_CALENDAR_COLUMNS_LS_KEY,
} from './storage-keys.js';
import { numOr } from './utils.js';

const LS_API_BASE_KEY = 'real-estate-plan.apiBase';
const CLIENT_CAL_TIMEOUT_MS = 60000;

function getApiBase() {
  if (
    typeof window !== 'undefined' &&
    window.PennypathApiOrigin &&
    typeof window.PennypathApiOrigin.getSafeApiBase === 'function'
  ) {
    return window.PennypathApiOrigin.getSafeApiBase(LS_API_BASE_KEY);
  }
  try {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    ) {
      return window.location.origin.replace(/\/$/, '');
    }
  } catch (e) {}
  return 'http://127.0.0.1:8787';
}

/** Split a simple CSV line (commas; no embedded commas in fields for MVP). */
function splitCsvLine(line) {
  return String(line || '')
    .split(',')
    .map(function (s) {
      return s.trim().replace(/^"|"$/g, '');
    });
}

const DEFAULT_BILL_CSV_COLS = {
  name: 'name',
  amount: 'amount',
  due_day: 'due_day',
};

function normHeaderCell(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

/**
 * @param {string} text - raw CSV
 * @param {{ name?: string, amount?: string, due_day?: string }} [columnNames] - header labels to match (case-insensitive)
 * @returns {{ ok: true, bills: Array<{ name: string, amount: number, due_day: number }> } | { ok: false, error: string }}
 */
export function parseCsvBills(text, columnNames) {
  const c = columnNames || {};
  const wantName = normHeaderCell(c.name != null ? c.name : DEFAULT_BILL_CSV_COLS.name);
  const wantAmount = normHeaderCell(c.amount != null ? c.amount : DEFAULT_BILL_CSV_COLS.amount);
  const wantDue = normHeaderCell(c.due_day != null ? c.due_day : DEFAULT_BILL_CSV_COLS.due_day);
  if (!wantName || !wantAmount || !wantDue) {
    return { ok: false, error: 'Enter a column name for bill name, amount, and due day.' };
  }
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(function (l) {
    return l.trim().length > 0;
  });
  if (!lines.length) {
    return { ok: false, error: 'The file is empty.' };
  }
  const header = splitCsvLine(lines[0]).map(normHeaderCell);
  const iName = header.indexOf(wantName);
  const iAmount = header.indexOf(wantAmount);
  const iDue = header.indexOf(wantDue);
  const missing = [];
  if (iName === -1) missing.push('"' + wantName + '" (name)');
  if (iAmount === -1) missing.push('"' + wantAmount + '" (amount)');
  if (iDue === -1) missing.push('"' + wantDue + '" (due day)');
  if (missing.length) {
    return {
      ok: false,
      error:
        'The header row does not include: ' +
        missing.join(', ') +
        '. Match the spelling to your CSV or adjust the column fields.',
    };
  }
  if (iName === iAmount || iName === iDue || iAmount === iDue) {
    return { ok: false, error: 'Name, amount, and due day must map to three different columns.' };
  }
  const maxIdx = Math.max(iName, iAmount, iDue);
  const bills = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvLine(lines[r]);
    if (cols.length <= maxIdx) continue;
    const name = cols[iName];
    const amount = numOr(parseFloat(String(cols[iAmount]).replace(/[$,]/g, '')), NaN);
    const dueDay = parseInt(String(cols[iDue]), 10);
    if (!name || !String(name).trim()) continue;
    if (!Number.isFinite(amount) || amount < 0) continue;
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) continue;
    bills.push({ name: String(name).trim(), amount: amount, due_day: dueDay });
  }
  if (!bills.length) {
    return { ok: false, error: 'No valid bill rows found. Check amounts and due day (1–31).' };
  }
  return { ok: true, bills: bills };
}

function planSnapshot(plan) {
  const debts = Array.isArray(plan.debts)
    ? plan.debts.map(function (d) {
        return {
          id: String(d.id || ''),
          name: String(d.name || ''),
          current: numOr(d.current, 0),
          aprPct: numOr(d.aprPct, 0),
        };
      })
    : [];
  return {
    monthlyTakeHome: numOr(plan.monthlyTakeHome, 0),
    monthlyFixedExpenses: numOr(plan.monthlyFixedExpenses, 0),
    phase1: {
      ccPayment: numOr(plan.phase1 && plan.phase1.ccPayment, 0),
      hysaDeposit: numOr(plan.phase1 && plan.phase1.hysaDeposit, 0),
    },
    funBudget: numOr(plan.funBudget, 0),
    debts: debts,
  };
}

function loadAiPayoffExcerpt() {
  try {
    const raw = localStorage.getItem(AI_PAYOFF_PLAN_CACHE_LS_KEY);
    if (!raw) return '';
    const o = JSON.parse(raw);
    if (!o || typeof o.text !== 'string') return '';
    const t = o.text.trim();
    return t.length > 7000 ? t.slice(0, 7000) + '\n…' : t;
  } catch (e) {
    return '';
  }
}

function buildCalendarPrompt(plan, bills, monthsAhead) {
  const snap = planSnapshot(plan);
  const strat = loadAiPayoffExcerpt();
  const today = new Date();
  const rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setMonth(rangeEnd.getMonth() + Math.max(1, Math.min(6, monthsAhead)));

  const ymd = function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  };

  return (
    'You output ONLY a single JSON object (no markdown). No code fences.\n\n' +
    'Build a payment calendar that combines:\n' +
    '1) Recurring bills (due on calendar day `due_day` each month).\n' +
    '2) Suggested dates to make extra DEBT payments toward credit cards/loans, consistent with the plan budget and strategy.\n\n' +
    'Financial plan snapshot (numbers):\n' +
    JSON.stringify(snap, null, 0) +
    '\n\nBills (recurring monthly):\n' +
    JSON.stringify(bills, null, 0) +
    '\n\nOptional: prior AI payoff strategy text (follow this for WHICH debt to prioritize and rough timing):\n' +
    (strat
      ? strat
      : '(No prior AI text — use highest APR first for extra payments when balances remain, within the monthly debt payment budget.)') +
    '\n\nDate range: include events from ' +
    ymd(rangeStart) +
    ' through ' +
    ymd(new Date(rangeEnd.getTime() - 86400000)) +
    ' (about ' +
    monthsAhead +
    ' month(s) of calendar).\n\n' +
    'JSON schema exactly:\n' +
    '{\n' +
    '  "notes": "string, 1-2 sentences summarizing the schedule",\n' +
    '  "events": [\n' +
    '    { "date": "YYYY-MM-DD", "kind": "bill", "label": "string", "amount": number },\n' +
    '    { "date": "YYYY-MM-DD", "kind": "debt", "label": "string", "amount": number, "debtName": "string or empty" }\n' +
    '  ]\n' +
    '}\n\n' +
    'Rules:\n' +
    '- Every bill must appear on its due_day in each month in range (adjust if the month has fewer days: use last day of month).\n' +
    '- For debt: schedule concrete payment dates (often 1-3 per month) so the user can see when to pay; amounts should reflect the plan monthly CC/debt budget (phase1.ccPayment) split sensibly across dates. Prioritize the debt matching the strategy (or highest APR if no strategy).\n' +
    '- Use realistic calendar dates only. Amounts are USD numbers >= 0.\n' +
    '- Keep the events array focused and readable (not hundreds of rows).'
  );
}

async function callFinancialCalendarApi(prompt) {
  const base = getApiBase();
  const controller = new AbortController();
  const tid = setTimeout(function () {
    controller.abort();
  }, CLIENT_CAL_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(base + '/api/financial-calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      throw new Error('Calendar request timed out. Try again or shorten the CSV.');
    }
    throw new Error('Could not reach the server. Run npm run research-server for local use.');
  } finally {
    clearTimeout(tid);
  }
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok || data.ok === false) {
    const msg =
      (typeof data.error === 'string' && data.error) ||
      'Calendar request failed (' + res.status + ').';
    throw new Error(msg);
  }
  if (!data.data || typeof data.data !== 'object') {
    throw new Error('Invalid calendar response from server.');
  }
  return data.data;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeEvents(raw) {
  const list = Array.isArray(raw.events) ? raw.events : [];
  const out = [];
  list.forEach(function (ev) {
    if (!ev || typeof ev !== 'object') return;
    const date = String(ev.date || '').trim();
    if (!DATE_RE.test(date)) return;
    const kind = String(ev.kind || '').toLowerCase() === 'debt' ? 'debt' : 'bill';
    const label = String(ev.label || '').trim() || (kind === 'debt' ? 'Debt payment' : 'Bill');
    const amount = numOr(ev.amount, null);
    out.push({
      date: date,
      kind: kind,
      label: label,
      amount: Number.isFinite(amount) ? amount : null,
      debtName: typeof ev.debtName === 'string' ? ev.debtName : '',
    });
  });
  out.sort(function (a, b) {
    return a.date.localeCompare(b.date);
  });
  return { notes: typeof raw.notes === 'string' ? raw.notes : '', events: out };
}

function monthKey(y, m0) {
  return String(y) + '-' + String(m0 + 1).padStart(2, '0');
}

function parseYmd(s) {
  const p = String(s).split('-');
  if (p.length !== 3) return null;
  const y = parseInt(p[0], 10);
  const m = parseInt(p[1], 10) - 1;
  const d = parseInt(p[2], 10);
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return dt;
}

/** iCalendar TEXT escaping (RFC 5545). */
function icsEscapeText(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function ymdToIcsDate(ymd) {
  return String(ymd || '').replace(/-/g, '');
}

/** Next calendar day as YYYYMMDD for all-day DTEND (exclusive). */
function icsEndDateExclusive(ymd) {
  const d = parseYmd(ymd);
  if (!d) return ymdToIcsDate(ymd);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return String(y) + m + day;
}

function icsDtStampUtc() {
  const n = new Date();
  const y = n.getUTCFullYear();
  const mo = String(n.getUTCMonth() + 1).padStart(2, '0');
  const d = String(n.getUTCDate()).padStart(2, '0');
  const h = String(n.getUTCHours()).padStart(2, '0');
  const mi = String(n.getUTCMinutes()).padStart(2, '0');
  const s = String(n.getUTCSeconds()).padStart(2, '0');
  return String(y) + mo + d + 'T' + h + mi + s + 'Z';
}

/**
 * @param {{ notes: string, events: Array<{ date: string, kind: string, label: string, amount: number|null, debtName: string }> }} norm
 * @returns {string}
 */
function buildPaymentCalendarIcs(norm) {
  const dtstamp = icsDtStampUtc();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PennyPath//Payment Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:PennyPath bills and debt',
  ];
  norm.events.forEach(function (ev, idx) {
    const start = ymdToIcsDate(ev.date);
    const end = icsEndDateExclusive(ev.date);
    let summary = String(ev.label || (ev.kind === 'debt' ? 'Debt payment' : 'Bill'));
    if (ev.amount != null && Number.isFinite(ev.amount)) {
      summary += ' — $' + Math.round(ev.amount).toLocaleString('en-US');
    }
    const descParts = [
      ev.kind === 'debt' ? 'Debt payment' : 'Bill',
      ev.debtName ? 'Account: ' + ev.debtName : '',
    ].filter(Boolean);
    const description = descParts.join('\n');
    const uid =
      'pennypath-paycal-' + ev.date + '-' + idx + '-' + ev.kind + '@local';
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + uid);
    lines.push('DTSTAMP:' + dtstamp);
    lines.push('DTSTART;VALUE=DATE:' + start);
    lines.push('DTEND;VALUE=DATE:' + end);
    lines.push('SUMMARY:' + icsEscapeText(summary));
    lines.push('DESCRIPTION:' + icsEscapeText(description));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function downloadBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderCalendar(host, data) {
  host.textContent = '';
  const norm = normalizeEvents(data);
  if (!norm.events.length) {
    const p = document.createElement('p');
    p.className = 'ai-bill-cal__empty';
    p.textContent = 'No calendar events returned.';
    host.appendChild(p);
    return;
  }

  const icsBar = document.createElement('div');
  icsBar.className = 'ai-bill-cal-ics-bar';
  const icsBtn = document.createElement('button');
  icsBtn.type = 'button';
  icsBtn.className = 'ai-bill-cal-ics-btn';
  icsBtn.textContent = 'Download .ics (add to calendar)';
  icsBtn.title = 'Import into Apple Calendar, Google Calendar, Outlook, etc.';
  icsBtn.addEventListener('click', function () {
    const ics = buildPaymentCalendarIcs(norm);
    downloadBlobAsFile(
      new Blob([ics], { type: 'text/calendar;charset=utf-8' }),
      'pennypath-payment-calendar.ics',
    );
  });
  icsBar.appendChild(icsBtn);
  host.appendChild(icsBar);

  if (norm.notes) {
    const note = document.createElement('p');
    note.className = 'ai-bill-cal__notes';
    note.textContent = norm.notes;
    host.appendChild(note);
  }

  const byDate = {};
  norm.events.forEach(function (ev) {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });

  const monthSet = {};
  norm.events.forEach(function (ev) {
    const dt = parseYmd(ev.date);
    if (!dt) return;
    const mk = monthKey(dt.getFullYear(), dt.getMonth());
    monthSet[mk] = { y: dt.getFullYear(), m: dt.getMonth() };
  });
  const monthKeys = Object.keys(monthSet).sort();

  monthKeys.forEach(function (mk) {
    const info = monthSet[mk];
    const wrap = document.createElement('div');
    wrap.className = 'ai-bill-cal-month';
    const title = document.createElement('h4');
    title.className = 'ai-bill-cal-month__title';
    title.textContent = new Date(info.y, info.m, 1).toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    wrap.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'ai-bill-cal-grid';
    grid.setAttribute('role', 'grid');
    ;['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) {
      const h = document.createElement('div');
      h.className = 'ai-bill-cal-grid__dow';
      h.textContent = d;
      grid.appendChild(h);
    });

    const firstDow = new Date(info.y, info.m, 1).getDay();
    const dim = new Date(info.y, info.m + 1, 0).getDate();
    for (let i = 0; i < firstDow; i++) {
      const pad = document.createElement('div');
      pad.className = 'ai-bill-cal-grid__cell ai-bill-cal-grid__cell--pad';
      grid.appendChild(pad);
    }
    for (let day = 1; day <= dim; day++) {
      const cell = document.createElement('div');
      cell.className = 'ai-bill-cal-grid__cell';
      const y = info.y;
      const m = String(info.m + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const key = y + '-' + m + '-' + dd;
      const dayNum = document.createElement('span');
      dayNum.className = 'ai-bill-cal-grid__daynum';
      dayNum.textContent = String(day);
      cell.appendChild(dayNum);
      const evs = byDate[key];
      if (evs && evs.length) {
        const stack = document.createElement('div');
        stack.className = 'ai-bill-cal-grid__stack';
        evs.forEach(function (ev) {
          const chip = document.createElement('span');
          chip.className =
            'ai-bill-cal-chip' +
            (ev.kind === 'debt' ? ' ai-bill-cal-chip--debt' : ' ai-bill-cal-chip--bill');
          const amt =
            ev.amount != null && Number.isFinite(ev.amount)
              ? ' $' + Math.round(ev.amount).toLocaleString()
              : '';
          chip.textContent = ev.label + amt;
          chip.title = ev.kind === 'debt' && ev.debtName ? ev.debtName : ev.label;
          stack.appendChild(chip);
        });
        cell.appendChild(stack);
      }
      grid.appendChild(cell);
    }

    wrap.appendChild(grid);
    host.appendChild(wrap);
  });
}

function saveCalendarCache(payload) {
  try {
    localStorage.setItem(AI_BILL_CALENDAR_CACHE_LS_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadCalendarCache() {
  try {
    const raw = localStorage.getItem(AI_BILL_CALENDAR_CACHE_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).then(function () {
      return true;
    });
  }
  return new Promise(function (resolve, reject) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve(true);
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

function downloadTextAsFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'pennypath-calendar-prompt.txt';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function canShareText(text) {
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function') {
    try {
      return navigator.canShare({ text: text });
    } catch (e) {
      return false;
    }
  }
  return true;
}

function shareTextIfSupported(text) {
  if (typeof navigator.share !== 'function') {
    return Promise.reject(new Error('Sharing is not available in this browser.'));
  }
  return navigator.share({
    title: 'PennyPath — payment calendar prompt',
    text: text,
  });
}

/**
 * @param {object} plan - PLAN
 */
export function wireBillPaymentCalendar(plan) {
  const fileInput = document.getElementById('ai-bill-cal-file');
  const btn = document.getElementById('btn-ai-bill-cal-generate');
  const statusEl = document.getElementById('ai-bill-cal-status');
  const host = document.getElementById('ai-bill-cal-host');
  const colName = document.getElementById('ai-bill-cal-col-name');
  const colAmount = document.getElementById('ai-bill-cal-col-amount');
  const colDue = document.getElementById('ai-bill-cal-col-due');
  if (!fileInput || !btn || !host || !colName || !colAmount || !colDue) return;

  let parsedRows = null;
  let lastCsvText = '';
  let fileName = '';

  function readColumnMap() {
    return {
      name: colName.value,
      amount: colAmount.value,
      due_day: colDue.value,
    };
  }

  function saveColumnMapToStorage() {
    try {
      localStorage.setItem(AI_BILL_CALENDAR_COLUMNS_LS_KEY, JSON.stringify(readColumnMap()));
    } catch (e) {}
  }

  function loadColumnMapFromStorage() {
    try {
      const raw = localStorage.getItem(AI_BILL_CALENDAR_COLUMNS_LS_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  const savedCols = loadColumnMapFromStorage();
  if (savedCols) {
    if (typeof savedCols.name === 'string') colName.value = savedCols.name;
    if (typeof savedCols.amount === 'string') colAmount.value = savedCols.amount;
    if (typeof savedCols.due_day === 'string') colDue.value = savedCols.due_day;
  }

  function setStatus(t) {
    if (statusEl) statusEl.textContent = t || '';
  }

  function syncButton() {
    const ready = !!(parsedRows && parsedRows.length);
    btn.disabled = !ready;
    if (btnOpenPrompt) {
      btnOpenPrompt.disabled = !ready;
      btnOpenPrompt.title = ready
        ? 'Open the full calendar prompt to copy, share, or download'
        : 'Load a CSV with at least one valid bill first';
    }
  }

  function tryParseFromLastFile() {
    if (!lastCsvText) {
      parsedRows = null;
      syncButton();
      return;
    }
    const pr = parseCsvBills(lastCsvText, readColumnMap());
    if (!pr.ok) {
      parsedRows = null;
      setStatus(pr.error);
      syncButton();
      return;
    }
    parsedRows = pr.bills;
    setStatus(pr.bills.length + ' bill(s) loaded from ' + fileName + '.');
    syncButton();
  }

  function onColumnChange() {
    saveColumnMapToStorage();
    tryParseFromLastFile();
  }

  colName.addEventListener('input', onColumnChange);
  colAmount.addEventListener('input', onColumnChange);
  colDue.addEventListener('input', onColumnChange);

  const btnOpenPrompt = document.getElementById('btn-ai-bill-cal-open-prompt');
  const promptDialogEl = document.getElementById('ai-bill-cal-prompt-dialog');
  const promptTextarea = document.getElementById('ai-bill-cal-prompt-text');
  const promptFeedback = document.getElementById('ai-bill-cal-prompt-feedback');
  const btnPromptClose = document.getElementById('btn-ai-bill-cal-prompt-close');
  const btnPromptCopy = document.getElementById('btn-ai-bill-cal-prompt-copy');
  const btnPromptShare = document.getElementById('btn-ai-bill-cal-prompt-share');
  const btnPromptDownload = document.getElementById('btn-ai-bill-cal-prompt-download');

  let storedManualPrompt = '';

  function openManualPromptDialog() {
    if (!promptDialogEl || !promptTextarea) return;
    if (!parsedRows || !parsedRows.length) {
      return;
    }
    storedManualPrompt = buildCalendarPrompt(plan, parsedRows, 3);
    promptTextarea.value = storedManualPrompt;
    if (promptFeedback) promptFeedback.textContent = '';
    if (btnPromptShare) {
      btnPromptShare.hidden = !canShareText(storedManualPrompt);
    }
    if (typeof promptDialogEl.showModal === 'function') {
      promptDialogEl.showModal();
    } else if (typeof promptDialogEl.show === 'function') {
      promptDialogEl.show();
    }
  }

  if (btnOpenPrompt) {
    btnOpenPrompt.addEventListener('click', openManualPromptDialog);
  }
  if (btnPromptClose && promptDialogEl) {
    btnPromptClose.addEventListener('click', function () {
      promptDialogEl.close();
    });
  }
  if (promptDialogEl) {
    promptDialogEl.addEventListener('click', function (e) {
      if (e.target === promptDialogEl) promptDialogEl.close();
    });
  }
  if (btnPromptCopy && promptTextarea) {
    btnPromptCopy.addEventListener('click', function () {
      const t = storedManualPrompt || promptTextarea.value;
      copyTextToClipboard(t)
        .then(function () {
          if (promptFeedback) promptFeedback.textContent = 'Copied to clipboard.';
        })
        .catch(function () {
          if (promptFeedback) {
            promptFeedback.textContent =
              'Could not copy automatically. Select the text in the box and use your browser’s copy command.';
          }
        });
    });
  }
  if (btnPromptShare) {
    btnPromptShare.addEventListener('click', function () {
      const t = storedManualPrompt || '';
      shareTextIfSupported(t)
        .then(function () {
          if (promptFeedback) promptFeedback.textContent = 'Shared.';
        })
        .catch(function (err) {
          if (promptFeedback) {
            promptFeedback.textContent =
              err && err.message ? String(err.message) : 'Share was cancelled or failed.';
          }
        });
    });
  }
  if (btnPromptDownload) {
    btnPromptDownload.addEventListener('click', function () {
      const t = storedManualPrompt || '';
      downloadTextAsFile(t, 'pennypath-calendar-prompt.txt');
      if (promptFeedback) promptFeedback.textContent = 'Download started.';
    });
  }

  fileInput.addEventListener('change', function () {
    parsedRows = null;
    lastCsvText = '';
    fileName = '';
    setStatus('');
    host.textContent = '';
    const f = fileInput.files && fileInput.files[0];
    if (!f) {
      syncButton();
      return;
    }
    fileName = f.name;
    const reader = new FileReader();
    reader.onload = function () {
      lastCsvText = String(reader.result || '');
      tryParseFromLastFile();
    };
    reader.onerror = function () {
      setStatus('Could not read the file.');
      syncButton();
    };
    reader.readAsText(f);
  });

  btn.addEventListener('click', async function () {
    if (!parsedRows || !parsedRows.length) return;
    btn.disabled = true;
    setStatus('Generating calendar…');
    host.textContent = '';
    let calendarPrompt = '';
    try {
      calendarPrompt = buildCalendarPrompt(plan, parsedRows, 3);
      const data = await callFinancialCalendarApi(calendarPrompt);
      const norm = normalizeEvents(data);
      renderCalendar(host, norm);
      saveCalendarCache({ at: new Date().toISOString(), data: norm });
      setStatus('Calendar ready — ' + norm.events.length + ' event(s).');
    } catch (err) {
      const msg = err && err.message ? String(err.message) : 'Something went wrong.';
      setStatus(msg);
      const p = document.createElement('p');
      p.className = 'ai-bill-cal__error';
      p.textContent = msg;
      host.appendChild(p);
    } finally {
      syncButton();
    }
  });

  const cached = loadCalendarCache();
  if (cached && cached.data && Array.isArray(cached.data.events)) {
    renderCalendar(host, cached.data);
    setStatus('Showing saved calendar — generate again to refresh.');
  }

  return {
    refreshAfterPlanChange: function () {
      if (host.querySelector('.ai-bill-cal-month') && statusEl) {
        statusEl.textContent =
          'Plan changed — generate the calendar again to align with new numbers.';
      }
    },
  };
}
