/**
 * "How We Get There" sub-tabs: original plan vs Gemini-generated debt payoff suggestions.
 * Last generated plan text is cached in localStorage; requests go to POST /api/financial-payoff.
 */

import type { FinancialPlan } from '../../types/index.js';
import { AI_PAYOFF_PLAN_CACHE_LS_KEY } from './storage-keys';

const LS_KEY_CACHE = AI_PAYOFF_PLAN_CACHE_LS_KEY;

/** Optional override for API origin (shared with real-estate-plan.html). */
const LS_API_BASE_KEY = 'real-estate-plan.apiBase';

declare const process: any;

function isDevTechnical() {
  return (
    typeof window !== 'undefined' &&
    (window as any).PennypathDev &&
    typeof (window as any).PennypathDev.isTechnical === 'function' &&
    (window as any).PennypathDev.isTechnical()
  );
}

/** True when storage/cache failures should surface in the console (prod stays silent). */
function shouldLogLocalStorageErrors() {
  if (isDevTechnical()) return true;
  try {
    const p = typeof process !== 'undefined' ? process : (globalThis as any).process;
    if (p && p.env && p.env.NODE_ENV === 'development') {
      return true;
    }
  } catch (e) {}
  return typeof window !== 'undefined' && !!(window as any).__PENNYPATH_DEBUG__;
}

function getPayoffApiBase() {
  if (
    typeof window !== 'undefined' &&
    (window as any).PennypathApiOrigin &&
    typeof (window as any).PennypathApiOrigin.getSafeApiBase === 'function'
  ) {
    return (window as any).PennypathApiOrigin.getSafeApiBase(LS_API_BASE_KEY);
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

function setSelected(tabEl: HTMLElement | null, selected: boolean): void {
  if (!tabEl) return;
  tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
  tabEl.tabIndex = selected ? 0 : -1;
}

function setPanelVisible(panelEl: HTMLElement | null, visible: boolean): void {
  if (!panelEl) return;
  panelEl.hidden = !visible;
}

/** Stable subset of phase1/phase2 for cache fingerprint (matches plan-data shapes). */
function fingerprintPhase1(phase1: any): { ccPayment: number; hysaDeposit: number } {
  if (!phase1 || typeof phase1 !== 'object') {
    return { ccPayment: 0, hysaDeposit: 0 };
  }
  return {
    ccPayment: Number(phase1.ccPayment),
    hysaDeposit: Number(phase1.hysaDeposit),
  };
}

function fingerprintPhase2(phase2: any): { hysaDeposit: number } {
  if (!phase2 || typeof phase2 !== 'object') {
    return { hysaDeposit: 0 };
  }
  return {
    hysaDeposit: Number(phase2.hysaDeposit),
  };
}

function buildFingerprint(plan: any): string {
  if (!plan || typeof plan !== 'object') return '';
  try {
    const debts = Array.isArray(plan.debts)
      ? plan.debts.map(function (d: any) {
          return {
            id: String(d.id || ''),
            name: String(d.name || ''),
            current: Number(d.current),
            aprPct: Number(d.aprPct),
            deferredAmount: Number(d.deferredAmount),
            deferredExpiresOn: String(d.deferredExpiresOn || ''),
            deferredMonthsRemaining: Number(d.deferredMonthsRemaining),
          };
        })
      : [];
    return JSON.stringify({
      debts: debts,
      monthlyTakeHome: Number(plan.monthlyTakeHome),
      monthlyFixedExpenses: Number(plan.monthlyFixedExpenses),
      phase1: fingerprintPhase1(plan.phase1),
      phase2: fingerprintPhase2(plan.phase2),
      funBudget: Number(plan.funBudget),
      monthsDebtPayoff: Number(plan.monthsDebtPayoff),
      ccApr: Number(plan.ccApr),
    });
  } catch (e) {
    return '';
  }
}

function loadCache(): { text: string; fingerprint: string; truncated: boolean; at: unknown } | null {
  try {
    const raw = localStorage.getItem(LS_KEY_CACHE);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    const anyO = o as any;
    if (typeof anyO.text !== 'string' || typeof anyO.fingerprint !== 'string') return null;
    return { text: anyO.text, fingerprint: anyO.fingerprint, truncated: !!anyO.truncated, at: anyO.at };
  } catch (e) {
    return null;
  }
}

function saveCache(fingerprint: string, text: string, truncated: boolean): void {
  try {
    localStorage.setItem(
      LS_KEY_CACHE,
      JSON.stringify({
        fingerprint: fingerprint,
        text: text,
        truncated: !!truncated,
        at: new Date().toISOString(),
      })
    );
  } catch (e) {
    if (shouldLogLocalStorageErrors() && typeof console !== 'undefined' && console.warn) {
      console.warn('[PennyPath] AI payoff plan cache: localStorage.setItem failed', e);
    }
  }
}

function buildPrompt(plan: FinancialPlan): string {
  const fp = buildFingerprint(plan);
  const debtsBlock = Array.isArray(plan.debts)
    ? plan.debts
        .map(function (d: any, i: number) {
          const lines = [
            'Debt ' + (i + 1) + ': ' + String(d.name || 'Unnamed'),
            '  Balance (current): $' + Number(d.current || 0).toFixed(2),
            '  APR: ' + Number(d.aprPct || 0) + '% (0 may mean blended or unknown)',
            '  Deferred / promo balance (0% while active): $' +
              Number(d.deferredAmount || 0).toFixed(2),
            '  Deferred interest promo ends on (YYYY-MM-DD or empty): ' +
              String(d.deferredExpiresOn || '(none)'),
            '  Legacy months remaining on promo (if used): ' +
              String(d.deferredMonthsRemaining || 0),
          ];
          return lines.join('\n');
        })
        .join('\n\n')
    : '(no debts listed)';

  return (
    'You are helping with a personal debt payoff plan. The user wants the most affordable path ' +
    '(minimize total interest paid over time, while staying realistic about cash flow). ' +
    'Consider avalanche (highest APR first), snowball (smallest balance first), and any ' +
    'deferred-interest promotional balances that may charge retroactive interest after the promo ends.\n\n' +
    'Financial snapshot (numbers only; not professional advice context):\n' +
    '- Monthly take-home: $' +
    Number(plan.monthlyTakeHome || 0).toFixed(2) +
    '\n' +
    '- Monthly fixed expenses: $' +
    Number(plan.monthlyFixedExpenses || 0).toFixed(2) +
    '\n' +
    '- Phase 1 budget line — CC payment target: $' +
    Number(plan.phase1 && plan.phase1.ccPayment ? plan.phase1.ccPayment : 0).toFixed(2) +
    '\n' +
    '- Phase 1 budget line — HYSA deposit: $' +
    Number(plan.phase1 && plan.phase1.hysaDeposit ? plan.phase1.hysaDeposit : 0).toFixed(2) +
    '\n' +
    '- Fun budget: $' +
    Number(plan.funBudget || 0).toFixed(2) +
    '\n' +
    '- Months to debt-free (app estimate): ' +
    String(plan.monthsDebtPayoff || '') +
    '\n' +
    '- Legacy blended CC APR field (if debts aggregated): ' +
    Number(plan.ccApr || 0) * 100 +
    '%\n\n' +
    'Debts:\n' +
    debtsBlock +
    '\n\n' +
    'Respond using Markdown: use ### for each section heading (e.g. ### 1) Summary). ' +
    'Use short bullet lists where helpful. Sections:\n' +
    '1) Summary — one short paragraph.\n' +
    '2) Recommended payoff order — numbered list with one line of rationale each.\n' +
    '3) Monthly allocation — how to split extra payments across debts month to month (practical steps).\n' +
    '4) Deferred interest watchlist — call out any promo deadlines and what to do before they expire.\n' +
    '5) Assumptions and risks — what could change the plan.\n' +
    '6) Disclaimer — this is educational, not financial advice.\n\n' +
    'Fingerprint for consistency (ignore in prose): ' +
    fp.slice(0, 80) +
    '…'
  );
}

/** Max chars of prior plan embedded in a refinement prompt (model context limits). */
const MAX_REFINEMENT_PREVIOUS_CHARS = 28000;

/**
 * Follow-up prompt: same financial snapshot as buildPrompt, plus prior output and user request.
 * @param {object} plan
 * @param {string} previousPlanText - raw markdown from last generation
 * @param {string} userFeedback - user instructions to change the plan
 */
function buildRefinementPrompt(plan: FinancialPlan, previousPlanText: string, userFeedback: string): string {
  const base = buildPrompt(plan);
  let prev = String(previousPlanText || '').trim();
  if (prev.length > MAX_REFINEMENT_PREVIOUS_CHARS) {
    prev =
      prev.slice(0, MAX_REFINEMENT_PREVIOUS_CHARS) +
      '\n\n[…truncated for length; the full prior plan was longer.]';
  }
  const ask = String(userFeedback || '').trim();
  return (
    base +
    '\n\n--- REFINEMENT ---\n' +
    'You already produced a debt payoff plan for this snapshot (shown below under “Previous plan”). ' +
    'Revise that plan according to the user’s follow-up. Keep the same Markdown structure ' +
    '(### headings and numbered sections as before). If their request conflicts with the numbers, ' +
    'explain the tradeoff briefly.\n\n' +
    '### Previous plan\n' +
    prev +
    '\n\n### User follow-up request\n' +
    ask +
    '\n\nRespond with a complete updated plan (all sections), not a short diff.'
  );
}

function headingEmoji(title: unknown): string {
  const t = String(title || '').toLowerCase();
  if (t.includes('summary')) return '✨';
  if (t.includes('payoff order') || t.includes('recommended')) return '📋';
  if (t.includes('monthly') || t.includes('allocation')) return '💸';
  if (t.includes('deferred') || t.includes('watchlist') || t.includes('promo')) return '⏰';
  if (t.includes('assumption') || t.includes('risk')) return '⚠️';
  if (t.includes('disclaimer')) return '📌';
  return '💡';
}

function stripHeadingMarks(line: unknown): string {
  return String(line || '')
    .replace(/^#{1,3}\s*/, '')
    .trim();
}

/**
 * Turn body text under a section into paragraphs and simple lists (lines starting with - or *).
 */
function appendBodyLines(parent: HTMLElement, bodyText: unknown): void {
  const raw = String(bodyText || '').trim();
  if (!raw) return;
  const blocks = raw.split(/\n\n+/);
  blocks.forEach(function (block) {
    const lines = block.split('\n').map(function (l) {
      return l.trim();
    });
    const listLines = lines.filter(Boolean);
    const isUnorderedList =
      listLines.length > 0 &&
      listLines.every(function (l) {
        return /^[-*]\s+/.test(l);
      });
    const isOrderedList =
      listLines.length > 0 &&
      listLines.every(function (l) {
        return /^\d+[.)]\s+/.test(l);
      });
    if ((isUnorderedList || isOrderedList) && listLines.length) {
      const listEl = document.createElement(isOrderedList ? 'ol' : 'ul');
      listEl.className = 'ai-payoff-ul';
      listLines.forEach(function (l) {
        const li = document.createElement('li');
        li.className = 'ai-payoff-li';
        li.textContent = l.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '');
        listEl.appendChild(li);
      });
      parent.appendChild(listEl);
      return;
    }
    const p = document.createElement('p');
    p.className = 'ai-payoff-p';
    p.textContent = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (p.textContent) parent.appendChild(p);
  });
}

/**
 * Render Markdown-ish plan text into structured, styled nodes (safe: textContent only).
 * ### sections become alternating timeline cards; leading text stays as intro.
 */
function renderPlanContent(text: unknown): DocumentFragment {
  const frag = document.createDocumentFragment();
  const t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return frag;

  const chunks = t.split(/\n(?=#{1,3}\s)/);
  const introParts: string[] = [];
  const sections: Array<{ title: string; body: string }> = [];

  chunks.forEach(function (chunk) {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    const hm = trimmed.match(/^#{1,3}\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (hm) {
      sections.push({
        title: stripHeadingMarks(hm[1]),
        body: hm[2] || '',
      });
    } else {
      introParts.push(trimmed);
    }
  });

  if (introParts.length) {
    const intro = document.createElement('div');
    intro.className = 'ai-payoff-intro-block ai-payoff-intro-block--lead';
    appendBodyLines(intro, introParts.join('\n\n'));
    frag.appendChild(intro);
  }

  if (sections.length) {
    const timeline = document.createElement('div');
    timeline.className = 'ai-payoff-timeline';
    timeline.setAttribute('role', 'list');

    sections.forEach(function (sec, idx) {
      const row = document.createElement('section');
      row.className =
        'ai-payoff-timeline__row ' +
        (idx % 2 === 0 ? 'ai-payoff-timeline__row--left' : 'ai-payoff-timeline__row--right');
      row.setAttribute('role', 'listitem');

      const leftCell = document.createElement('div');
      leftCell.className = 'ai-payoff-timeline__cell';
      const rail = document.createElement('div');
      rail.className = 'ai-payoff-timeline__rail';
      rail.setAttribute('aria-hidden', 'true');
      const dot = document.createElement('span');
      dot.className = 'ai-payoff-timeline__dot';
      dot.textContent = String(idx + 1);
      rail.appendChild(dot);

      const rightCell = document.createElement('div');
      rightCell.className = 'ai-payoff-timeline__cell';

      const card = document.createElement('div');
      card.className = 'ai-payoff-timeline__card';

      const cardHead = document.createElement('div');
      cardHead.className = 'ai-payoff-timeline__card-head';
      const em = document.createElement('span');
      em.className = 'ai-payoff-timeline__card-emoji';
      em.setAttribute('aria-hidden', 'true');
      em.textContent = headingEmoji(sec.title);
      const titleEl = document.createElement('span');
      titleEl.className = 'ai-payoff-timeline__card-title';
      titleEl.textContent = sec.title;
      cardHead.appendChild(em);
      cardHead.appendChild(titleEl);

      const cardBody = document.createElement('div');
      cardBody.className = 'ai-payoff-timeline__card-body';
      appendBodyLines(cardBody, sec.body);

      card.appendChild(cardHead);
      card.appendChild(cardBody);

      if (idx % 2 === 0) {
        leftCell.appendChild(card);
        row.appendChild(leftCell);
        row.appendChild(rail);
        row.appendChild(rightCell);
      } else {
        row.appendChild(leftCell);
        row.appendChild(rail);
        rightCell.appendChild(card);
        row.appendChild(rightCell);
      }

      timeline.appendChild(row);
    });

    frag.appendChild(timeline);
  }

  return frag;
}

function clearScrollEl(scrollEl: HTMLElement | null): void {
  if (!scrollEl) return;
  scrollEl.textContent = '';
}

function setToolbarVisible(toolbarEl: HTMLElement | null, visible: boolean): void {
  if (!toolbarEl) return;
  toolbarEl.hidden = !visible;
}

function setExpandedState(
  outputRoot: HTMLElement | null,
  scrollEl: HTMLElement | null,
  expandBtn: HTMLButtonElement | null,
  expanded: boolean
): void {
  if (!outputRoot || !scrollEl) return;
  outputRoot.classList.toggle('ai-payoff-output--expanded', !!expanded);
  if (expandBtn) {
    expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    expandBtn.textContent = expanded ? 'Collapse' : 'Expand full plan';
  }
  if (expanded && scrollEl) {
    try {
      scrollEl.focus();
    } catch (e) {}
  }
}

function displayPlanInScroll(
  scrollEl: HTMLElement | null,
  outputRoot: HTMLElement | null,
  toolbarEl: HTMLElement | null,
  expandBtn: HTMLButtonElement | null,
  text: unknown,
  opts?: { truncated?: boolean }
): void {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  scrollEl.appendChild(renderPlanContent(text));
  if (opts && opts.truncated) {
    const note = document.createElement('p');
    note.className = 'ai-payoff-truncation-note';
    note.setAttribute('role', 'status');
    note.textContent =
      '⚠️ The response may be truncated by the model length limit. Tap Generate again for a fresh run, or expand the full plan below and scroll.';
    scrollEl.appendChild(note);
  }
  setToolbarVisible(toolbarEl, true);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
}

function showPlaceholder(
  scrollEl: HTMLElement | null,
  toolbarEl: HTMLElement | null,
  expandBtn: HTMLButtonElement | null,
  outputRoot: HTMLElement | null,
  msg: unknown
): void {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  const p = document.createElement('p');
  p.className = 'ai-payoff-placeholder section-sub';
  p.textContent = String(msg == null ? '' : msg);
  scrollEl.appendChild(p);
  setToolbarVisible(toolbarEl, false);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
}

function showLoading(
  scrollEl: HTMLElement | null,
  toolbarEl: HTMLElement | null,
  expandBtn: HTMLButtonElement | null,
  outputRoot: HTMLElement | null,
  opts?: { message?: string }
): void {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  setToolbarVisible(toolbarEl, false);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
  const wrap = document.createElement('div');
  wrap.className = 'ai-payoff-loading';
  const spin = document.createElement('span');
  spin.className = 'ai-payoff-loading__spinner';
  spin.setAttribute('aria-hidden', 'true');
  const label = document.createElement('p');
  label.className = 'ai-payoff-loading__label';
  label.textContent = opts && opts.message ? String(opts.message) : 'Crafting your payoff plan…';
  wrap.appendChild(spin);
  wrap.appendChild(label);
  scrollEl.appendChild(wrap);
}

function showError(
  scrollEl: HTMLElement | null,
  toolbarEl: HTMLElement | null,
  expandBtn: HTMLButtonElement | null,
  outputRoot: HTMLElement | null,
  msg: unknown
): void {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  setToolbarVisible(toolbarEl, false);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
  const p = document.createElement('p');
  p.className = 'ai-payoff-error';
  p.textContent = String(msg == null ? '' : msg);
  scrollEl.appendChild(p);
}

/** Client-side ceiling for POST /api/financial-payoff (server GEMINI_FETCH_TIMEOUT_MS is 30s). */
const CLIENT_PAYOFF_FETCH_TIMEOUT_MS = 60000;

/**
 * Calls the app server POST /api/financial-payoff (see server/market-research.mjs).
 */
async function callFinancialPayoffApi(prompt: string): Promise<{ text: string; truncated: boolean }> {
  const base = getPayoffApiBase();
  const controller = new AbortController();
  const timeoutId = setTimeout(function () {
    controller.abort();
  }, CLIENT_PAYOFF_FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(base + '/api/financial-payoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt }),
      signal: controller.signal,
    });
  } catch (e) {
    const err = e as any;
    if (err && err.name === 'AbortError') {
      if (isDevTechnical()) {
        throw new Error(
          'The AI payoff request timed out. Ensure `npm run research-server` is running and try again.'
        );
      }
      throw new Error('The AI request took too long. Please try again.');
    }
    if (isDevTechnical()) {
      throw new Error(
        'Could not reach the AI server. Run `npm run research-server`, set GEMINI_API_KEY in .env, and open this page from http://127.0.0.1:8787/ or the same host as the API.'
      );
    }
    throw new Error(
      'We couldn’t reach the AI service. Check your internet connection and try again.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
  const data = (await res.json().catch(function () {
    return {};
  })) as any;
  if (!res.ok || data.ok === false) {
    if (isDevTechnical()) {
      const msg =
        (data.gemini && data.gemini.message) ||
        (typeof data.error === 'string' && data.error) ||
        'Request failed (' + res.status + ').';
      throw new Error(msg);
    }
    throw new Error(
      'The AI service couldn’t complete your request. Please try again in a moment.'
    );
  }
  if (typeof data.text !== 'string' || !data.text.trim()) {
    if (isDevTechnical()) {
      throw new Error('Empty response from the model. Try again.');
    }
    throw new Error('We couldn’t generate a plan. Please try again.');
  }
  return { text: data.text.trim(), truncated: !!data.truncated };
}

/**
 * @param plan mutable `PLAN` from plan-data (after persistence merge).
 */
export function wireAiPayoffPlan(plan: FinancialPlan): { refreshAfterPlanChange: () => void } | void {
  const tabOriginal = document.getElementById('tab-how-original') as HTMLElement | null;
  const tabAi = document.getElementById('tab-how-ai') as HTMLElement | null;
  const panelOriginal = document.getElementById('panel-how-original') as HTMLElement | null;
  const panelAi = document.getElementById('panel-how-ai') as HTMLElement | null;
  const btn = document.getElementById('btn-ai-payoff-generate') as HTMLButtonElement | null;
  const statusEl = document.getElementById('ai-payoff-status') as HTMLElement | null;
  const outRoot = document.getElementById('ai-payoff-output') as HTMLElement | null;
  const scrollEl = document.getElementById('ai-payoff-scroll') as HTMLElement | null;
  const toolbarEl = document.getElementById('ai-payoff-toolbar') as HTMLElement | null;
  const expandBtn = document.getElementById('btn-ai-payoff-expand') as HTMLButtonElement | null;
  const refineInput = document.getElementById('ai-payoff-refine-input') as HTMLTextAreaElement | null;
  const refineBtn = document.getElementById('btn-ai-payoff-refine') as HTMLButtonElement | null;

  if (!tabOriginal || !tabAi || !panelOriginal || !panelAi || !outRoot || !scrollEl) return;
  const btnEl = btn;

  /** Raw markdown last shown or loaded from cache; used for refinement prompts. */
  let lastAiPlanText = '';

  function syncRefineControls() {
    if (!refineInput && !refineBtn) return;
    const hasPlan = !!String(lastAiPlanText || '').trim();
    if (refineInput) {
      refineInput.disabled = !hasPlan;
      if (!hasPlan) refineInput.value = '';
    }
    if (refineBtn) refineBtn.disabled = !hasPlan;
  }

  function applyCacheToOutput() {
    const cache = loadCache();
    const fp = buildFingerprint(plan);
    if (cache && cache.text && cache.fingerprint === fp) {
      lastAiPlanText = cache.text;
      displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, cache.text, {
        truncated: !!cache.truncated,
      });
      if (statusEl) statusEl.textContent = '';
    } else if (cache && cache.text) {
      lastAiPlanText = cache.text;
      displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, cache.text, {
        truncated: !!cache.truncated,
      });
      if (statusEl) {
        statusEl.textContent =
          'Showing saved plan; data changed — generate again to refresh.';
      }
    } else {
      lastAiPlanText = '';
      showPlaceholder(
        scrollEl,
        toolbarEl,
        expandBtn,
        outRoot,
        'Generate a plan to see AI-suggested payoff order and monthly allocation.'
      );
      if (statusEl) statusEl.textContent = '';
    }
    syncRefineControls();
  }

  applyCacheToOutput();

  function activateOriginal() {
    setSelected(tabOriginal, true);
    setSelected(tabAi, false);
    setPanelVisible(panelOriginal, true);
    setPanelVisible(panelAi, false);
  }

  function activateAi() {
    setSelected(tabOriginal, false);
    setSelected(tabAi, true);
    setPanelVisible(panelOriginal, false);
    setPanelVisible(panelAi, true);
  }

  tabOriginal.addEventListener('click', activateOriginal);
  tabAi.addEventListener('click', activateAi);

  if (expandBtn) {
    expandBtn.addEventListener('click', function () {
      const expanded = outRoot.classList.contains('ai-payoff-output--expanded');
      setExpandedState(outRoot, scrollEl, expandBtn, !expanded);
    });
  }

  if (btn) {
    btn.addEventListener('click', async function () {
      activateAi();
      if (statusEl) statusEl.textContent = 'Generating payoff plan…';
      showLoading(scrollEl, toolbarEl, expandBtn, outRoot);
      btn.disabled = true;
      if (refineBtn) refineBtn.disabled = true;
      try {
        const prompt = buildPrompt(plan);
        const fp = buildFingerprint(plan);
        const result = await callFinancialPayoffApi(prompt);
        const fpAfter = buildFingerprint(plan);
        if (fpAfter !== fp) {
          applyCacheToOutput();
          if (statusEl) {
            statusEl.textContent = 'Plan changed while generating — generate again.';
          }
          return;
        }
        const text = result.text;
        lastAiPlanText = text;
        saveCache(fp, text, result.truncated);
        displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, text, {
          truncated: result.truncated,
        });
        if (statusEl) statusEl.textContent = '';
        syncRefineControls();
      } catch (err) {
        const msg = err && (err as any).message ? String((err as any).message) : 'Something went wrong.';
        if (statusEl) statusEl.textContent = '';
        showError(scrollEl, toolbarEl, expandBtn, outRoot, msg);
      } finally {
        if (btnEl) btnEl.disabled = false;
        syncRefineControls();
      }
    });
  }

  if (refineBtn && refineInput) {
    refineBtn.addEventListener('click', async function () {
      const feedback = String(refineInput.value || '').trim();
      if (!String(lastAiPlanText || '').trim()) {
        if (statusEl) statusEl.textContent = 'Generate a plan first, then ask for changes.';
        return;
      }
      if (!feedback) {
        if (statusEl) statusEl.textContent = 'Write what you’d like changed, then tap Refine plan.';
        try {
          refineInput.focus();
        } catch (e) {}
        return;
      }

      activateAi();
      if (statusEl) statusEl.textContent = 'Updating your plan…';
      showLoading(scrollEl, toolbarEl, expandBtn, outRoot, { message: 'Updating your plan…' });
      if (btnEl) btnEl.disabled = true;
      refineBtn.disabled = true;
      if (refineInput) refineInput.disabled = true;
      try {
        const prompt = buildRefinementPrompt(plan, lastAiPlanText, feedback);
        const fp = buildFingerprint(plan);
        const result = await callFinancialPayoffApi(prompt);
        const fpAfter = buildFingerprint(plan);
        if (fpAfter !== fp) {
          applyCacheToOutput();
          if (statusEl) {
            statusEl.textContent = 'Plan changed while updating — try again.';
          }
          return;
        }
        const text = result.text;
        lastAiPlanText = text;
        saveCache(fp, text, result.truncated);
        displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, text, {
          truncated: result.truncated,
        });
        refineInput.value = '';
        if (statusEl) statusEl.textContent = '';
      } catch (err) {
        const msg = err && (err as any).message ? String((err as any).message) : 'Something went wrong.';
        if (statusEl) statusEl.textContent = '';
        showError(scrollEl, toolbarEl, expandBtn, outRoot, msg);
      } finally {
        if (btnEl) btnEl.disabled = false;
        syncRefineControls();
      }
    });
  }

  return {
    refreshAfterPlanChange: applyCacheToOutput,
  };
}
