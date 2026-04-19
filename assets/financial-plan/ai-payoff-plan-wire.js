/**
 * "How We Get There" sub-tabs: original plan vs Gemini-generated debt payoff suggestions.
 * Last generated plan text is cached in localStorage; requests go to POST /api/financial-payoff.
 */

import { AI_PAYOFF_PLAN_CACHE_LS_KEY } from './storage-keys.js';

const LS_KEY_CACHE = AI_PAYOFF_PLAN_CACHE_LS_KEY;

/** Optional override for API origin (shared with real-estate-plan.html). */
const LS_API_BASE_KEY = 'real-estate-plan.apiBase';

function isDevTechnical() {
  return (
    typeof window !== 'undefined' &&
    window.PennypathDev &&
    typeof window.PennypathDev.isTechnical === 'function' &&
    window.PennypathDev.isTechnical()
  );
}

/** True when storage/cache failures should surface in the console (prod stays silent). */
function shouldLogLocalStorageErrors() {
  if (isDevTechnical()) return true;
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      return true;
    }
  } catch (e) {}
  return typeof window !== 'undefined' && !!window.__PENNYPATH_DEBUG__;
}

function getPayoffApiBase() {
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

function setSelected(tabEl, selected) {
  if (!tabEl) return;
  tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
  tabEl.tabIndex = selected ? 0 : -1;
}

function setPanelVisible(panelEl, visible) {
  if (!panelEl) return;
  panelEl.hidden = !visible;
}

/** Stable subset of phase1/phase2 for cache fingerprint (matches plan-data shapes). */
function fingerprintPhase1(phase1) {
  if (!phase1 || typeof phase1 !== 'object') {
    return { ccPayment: 0, hysaDeposit: 0 };
  }
  return {
    ccPayment: Number(phase1.ccPayment),
    hysaDeposit: Number(phase1.hysaDeposit),
  };
}

function fingerprintPhase2(phase2) {
  if (!phase2 || typeof phase2 !== 'object') {
    return { hysaDeposit: 0 };
  }
  return {
    hysaDeposit: Number(phase2.hysaDeposit),
  };
}

function buildFingerprint(plan) {
  if (!plan || typeof plan !== 'object') return '';
  try {
    const debts = Array.isArray(plan.debts)
      ? plan.debts.map(function (d) {
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

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_KEY_CACHE);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    if (typeof o.text !== 'string' || typeof o.fingerprint !== 'string') return null;
    return { text: o.text, fingerprint: o.fingerprint, truncated: !!o.truncated, at: o.at };
  } catch (e) {
    return null;
  }
}

function saveCache(fingerprint, text, truncated) {
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

function buildPrompt(plan) {
  const fp = buildFingerprint(plan);
  const debtsBlock = Array.isArray(plan.debts)
    ? plan.debts
        .map(function (d, i) {
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

function headingEmoji(title) {
  const t = String(title || '').toLowerCase();
  if (t.includes('summary')) return '✨';
  if (t.includes('payoff order') || t.includes('recommended')) return '📋';
  if (t.includes('monthly') || t.includes('allocation')) return '💸';
  if (t.includes('deferred') || t.includes('watchlist') || t.includes('promo')) return '⏰';
  if (t.includes('assumption') || t.includes('risk')) return '⚠️';
  if (t.includes('disclaimer')) return '📌';
  return '💡';
}

function stripHeadingMarks(line) {
  return String(line || '')
    .replace(/^#{1,3}\s*/, '')
    .trim();
}

/**
 * Turn body text under a section into paragraphs and simple lists (lines starting with - or *).
 */
function appendBodyLines(parent, bodyText) {
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
 */
function renderPlanContent(text) {
  const frag = document.createDocumentFragment();
  const t = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!t) return frag;

  const chunks = t.split(/\n(?=#{1,3}\s)/);
  chunks.forEach(function (chunk) {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    const hm = trimmed.match(/^#{1,3}\s*([^\n]+)(?:\n([\s\S]*))?$/);
    if (hm) {
      const section = document.createElement('section');
      section.className = 'ai-payoff-section';
      const head = document.createElement('h3');
      head.className = 'ai-payoff-h';
      const titleClean = stripHeadingMarks(hm[1]);
      const em = document.createElement('span');
      em.className = 'ai-payoff-h__emoji';
      em.setAttribute('aria-hidden', 'true');
      em.textContent = headingEmoji(titleClean);
      const titleEl = document.createElement('span');
      titleEl.className = 'ai-payoff-h__title';
      titleEl.textContent = titleClean;
      head.appendChild(em);
      head.appendChild(titleEl);
      section.appendChild(head);
      const body = document.createElement('div');
      body.className = 'ai-payoff-section-body';
      appendBodyLines(body, hm[2] || '');
      section.appendChild(body);
      frag.appendChild(section);
      return;
    }
    const intro = document.createElement('div');
    intro.className = 'ai-payoff-intro-block';
    appendBodyLines(intro, trimmed);
    frag.appendChild(intro);
  });
  return frag;
}

function clearScrollEl(scrollEl) {
  if (!scrollEl) return;
  scrollEl.textContent = '';
}

function setToolbarVisible(toolbarEl, visible) {
  if (!toolbarEl) return;
  toolbarEl.hidden = !visible;
}

function setExpandedState(outputRoot, scrollEl, expandBtn, expanded) {
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

function displayPlanInScroll(scrollEl, outputRoot, toolbarEl, expandBtn, text, opts) {
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

function showPlaceholder(scrollEl, toolbarEl, expandBtn, outputRoot, msg) {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  const p = document.createElement('p');
  p.className = 'ai-payoff-placeholder section-sub';
  p.textContent = msg;
  scrollEl.appendChild(p);
  setToolbarVisible(toolbarEl, false);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
}

function showLoading(scrollEl, toolbarEl, expandBtn, outputRoot) {
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
  label.textContent = 'Crafting your payoff plan…';
  wrap.appendChild(spin);
  wrap.appendChild(label);
  scrollEl.appendChild(wrap);
}

function showError(scrollEl, toolbarEl, expandBtn, outputRoot, msg) {
  if (!scrollEl) return;
  clearScrollEl(scrollEl);
  setToolbarVisible(toolbarEl, false);
  setExpandedState(outputRoot, scrollEl, expandBtn, false);
  const p = document.createElement('p');
  p.className = 'ai-payoff-error';
  p.textContent = msg;
  scrollEl.appendChild(p);
}

/** Client-side ceiling for POST /api/financial-payoff (server GEMINI_FETCH_TIMEOUT_MS is 30s). */
const CLIENT_PAYOFF_FETCH_TIMEOUT_MS = 60000;

/**
 * Calls the app server POST /api/financial-payoff (see server/market-research.mjs).
 */
async function callFinancialPayoffApi(prompt) {
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
    if (e && e.name === 'AbortError') {
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
  const data = await res.json().catch(function () {
    return {};
  });
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
 * @param {object} plan - mutable `PLAN` from plan-data (after persistence merge).
 */
export function wireAiPayoffPlan(plan) {
  const tabOriginal = document.getElementById('tab-how-original');
  const tabAi = document.getElementById('tab-how-ai');
  const panelOriginal = document.getElementById('panel-how-original');
  const panelAi = document.getElementById('panel-how-ai');
  const btn = document.getElementById('btn-ai-payoff-generate');
  const statusEl = document.getElementById('ai-payoff-status');
  const outRoot = document.getElementById('ai-payoff-output');
  const scrollEl = document.getElementById('ai-payoff-scroll');
  const toolbarEl = document.getElementById('ai-payoff-toolbar');
  const expandBtn = document.getElementById('btn-ai-payoff-expand');

  if (!tabOriginal || !tabAi || !panelOriginal || !panelAi || !outRoot || !scrollEl) return;

  function applyCacheToOutput() {
    const cache = loadCache();
    const fp = buildFingerprint(plan);
    if (cache && cache.text && cache.fingerprint === fp) {
      displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, cache.text, {
        truncated: !!cache.truncated,
      });
      if (statusEl) statusEl.textContent = '';
    } else if (cache && cache.text) {
      displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, cache.text, {
        truncated: !!cache.truncated,
      });
      if (statusEl) {
        statusEl.textContent =
          'Showing saved plan; data changed — generate again to refresh.';
      }
    } else {
      showPlaceholder(
        scrollEl,
        toolbarEl,
        expandBtn,
        outRoot,
        'Generate a plan to see AI-suggested payoff order and monthly allocation.'
      );
      if (statusEl) statusEl.textContent = '';
    }
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
      try {
        const prompt = buildPrompt(plan);
        const fp = buildFingerprint(plan);
        const result = await callFinancialPayoffApi(prompt);
        const text = result.text;
        saveCache(fp, text, result.truncated);
        displayPlanInScroll(scrollEl, outRoot, toolbarEl, expandBtn, text, {
          truncated: result.truncated,
        });
        if (statusEl) statusEl.textContent = '';
      } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Something went wrong.';
        if (statusEl) statusEl.textContent = '';
        showError(scrollEl, toolbarEl, expandBtn, outRoot, msg);
      } finally {
        btn.disabled = false;
      }
    });
  }

  return {
    refreshAfterPlanChange: applyCacheToOutput,
  };
}
