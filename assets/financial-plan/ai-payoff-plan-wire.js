/**
 * "How We Get There" sub-tabs: original plan vs Gemini-generated debt payoff suggestions.
 * API key and last generated text are stored in localStorage (browser-only).
 */

const LS_KEY_API = 'pennypath.gemini.apiKey';
const LS_KEY_CACHE = 'pennypath.aiPayoffPlan.v1';

const GEMINI_MODEL = 'gemini-2.0-flash';

function setSelected(tabEl, selected) {
  if (!tabEl) return;
  tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
  tabEl.tabIndex = selected ? 0 : -1;
}

function setPanelVisible(panelEl, visible) {
  if (!panelEl) return;
  panelEl.hidden = !visible;
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
      phase1: plan.phase1,
      phase2: plan.phase2,
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
    return { text: o.text, fingerprint: o.fingerprint, at: o.at };
  } catch (e) {
    return null;
  }
}

function saveCache(fingerprint, text) {
  try {
    localStorage.setItem(
      LS_KEY_CACHE,
      JSON.stringify({
        fingerprint: fingerprint,
        text: text,
        at: new Date().toISOString(),
      })
    );
  } catch (e) {}
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
    'Respond in clear plain text (no HTML) with these sections and headings:\n' +
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

function displayPlanText(el, text) {
  if (!el) return;
  el.textContent = '';
  el.style.whiteSpace = 'pre-wrap';
  const p = document.createElement('p');
  p.className = 'ai-payoff-body';
  p.textContent = text;
  el.appendChild(p);
}

function showPlaceholder(el, msg) {
  if (!el) return;
  el.textContent = '';
  const p = document.createElement('p');
  p.className = 'ai-payoff-placeholder section-sub';
  p.textContent = msg;
  el.appendChild(p);
}

async function callGemini(apiKey, prompt) {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 4096,
      },
    }),
  });
  const data = await res.json().catch(function () {
    return {};
  });
  if (!res.ok) {
    const err =
      (data.error && data.error.message) ||
      'Request failed (' + res.status + '). Check the API key and network.';
    throw new Error(err);
  }
  const text =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] &&
    data.candidates[0].content.parts[0].text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty response from the model. Try again.');
  }
  return text.trim();
}

/**
 * @param {object} plan - mutable `PLAN` from plan-data (after persistence merge).
 */
export function wireAiPayoffPlan(plan) {
  const tabOriginal = document.getElementById('tab-how-original');
  const tabAi = document.getElementById('tab-how-ai');
  const panelOriginal = document.getElementById('panel-how-original');
  const panelAi = document.getElementById('panel-how-ai');
  const keyInput = document.getElementById('ai-payoff-api-key');
  const btn = document.getElementById('btn-ai-payoff-generate');
  const statusEl = document.getElementById('ai-payoff-status');
  const outEl = document.getElementById('ai-payoff-output');

  if (!tabOriginal || !tabAi || !panelOriginal || !panelAi || !outEl) return;

  try {
    const k = localStorage.getItem(LS_KEY_API);
    if (k && keyInput) keyInput.value = k;
  } catch (e) {}

  function applyCacheToOutput() {
    const cache = loadCache();
    const fp = buildFingerprint(plan);
    if (cache && cache.text && cache.fingerprint === fp) {
      displayPlanText(outEl, cache.text);
      if (statusEl) statusEl.textContent = '';
    } else if (cache && cache.text) {
      displayPlanText(outEl, cache.text);
      if (statusEl) {
        statusEl.textContent =
          'Showing saved plan; data changed — generate again to refresh.';
      }
    } else {
      showPlaceholder(
        outEl,
        'Generate a plan to see AI-suggested payoff order and monthly allocation.'
      );
      if (statusEl) statusEl.textContent = '';
    }
  }

  applyCacheToOutput();

  if (keyInput) {
    keyInput.addEventListener('change', function () {
      try {
        const v = String(keyInput.value || '').trim();
        if (v) localStorage.setItem(LS_KEY_API, v);
        else localStorage.removeItem(LS_KEY_API);
      } catch (e) {}
    });
  }

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

  if (btn) {
    btn.addEventListener('click', async function () {
      const apiKey = keyInput ? String(keyInput.value || '').trim() : '';
      if (!apiKey) {
        if (statusEl) statusEl.textContent = 'Enter a Gemini API key first.';
        return;
      }
      try {
        localStorage.setItem(LS_KEY_API, apiKey);
      } catch (e) {}

      if (statusEl) statusEl.textContent = 'Generating…';
      btn.disabled = true;
      try {
        const prompt = buildPrompt(plan);
        const text = await callGemini(apiKey, prompt);
        const fp = buildFingerprint(plan);
        saveCache(fp, text);
        displayPlanText(outEl, text);
        if (statusEl) statusEl.textContent = '';
      } catch (err) {
        const msg = err && err.message ? String(err.message) : 'Something went wrong.';
        if (statusEl) statusEl.textContent = msg;
      } finally {
        btn.disabled = false;
      }
    });
  }

  return {
    refreshAfterPlanChange: applyCacheToOutput,
  };
}
