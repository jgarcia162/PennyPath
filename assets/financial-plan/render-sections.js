/**
 * Goal 2 per-debt UI + debts list inside the balance editor (DOM builders).
 */

import { DEFAULT_DEBT_APR_PCT, DEFAULT_SAVINGS_APY_PCT, PLAN } from './plan-data.js';
import { ensureSavingsGoals, accountContributesToGoal } from './savings-goals.js';
import { numOr, formatMoneyInput } from './utils.js';

/** Normalize legacy sort keys for UI + sorting. */
export function normalizeDebtsEditorSort(mode) {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return m;
}

export function normalizeDebtsProgressSort(mode) {
  const m = mode || 'saved';
  if (m === 'balance') return 'balance-desc';
  if (m === 'apr') return 'apr-desc';
  return m;
}

function sortDebtListByMode(list, mode) {
  if (mode === 'saved') return list;
  if (mode === 'balance-desc' || mode === 'balance-asc') {
    const dir = mode === 'balance-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.current, 0) - numOr(b.current, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'apr-desc' || mode === 'apr-asc') {
    const dir = mode === 'apr-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff =
        (numOr(a.aprPct, DEFAULT_DEBT_APR_PCT) - numOr(b.aprPct, DEFAULT_DEBT_APR_PCT)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  if (mode === 'paid-desc' || mode === 'paid-asc') {
    const dir = mode === 'paid-desc' ? -1 : 1;
    list.sort(function (a, b) {
      const diff = (numOr(a.paidOff, 0) - numOr(b.paidOff, 0)) * dir;
      if (diff !== 0) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
    return list;
  }
  return list;
}

/**
 * Debts in Goal 2 editor row order (saved array order, or balance / APR).
 * @param {{ debts?: unknown[], debtsEditorSort?: string }} plan
 */
export function getDebtsInEditorOrder(plan) {
  const list = Array.isArray(plan.debts) ? plan.debts.slice() : [];
  const mode = normalizeDebtsEditorSort(plan.debtsEditorSort);
  return sortDebtListByMode(list, mode);
}

/**
 * Order for Goal 2 per-debt progress cards (`#goal2-debts`).
 * @param {{ debts?: unknown[], debtsProgressSort?: string }} plan
 */
export function getDebtsInProgressOrder(plan) {
  const list = Array.isArray(plan.debts) ? plan.debts.slice() : [];
  const mode = normalizeDebtsProgressSort(plan.debtsProgressSort);
  return sortDebtListByMode(list, mode);
}

export function renderGoal2Debts(plan, moneyExact) {
  const host = document.getElementById('goal2-debts');
  if (!host) return;
  host.innerHTML = '';
  const debts = getDebtsInProgressOrder(plan);
  debts.forEach(function (debt) {
    const current = Number.isFinite(debt.current) ? debt.current : 0;
    const paid = Number.isFinite(debt.paidOff) ? debt.paidOff : 0;
    const start = Math.max(0, current + paid);
    const pct = start > 0 ? Math.min(100, (Math.max(0, paid) / start) * 100) : 0;

    const wrap = document.createElement('div');
    wrap.className = 'goal2-debt';

    const head = document.createElement('div');
    head.className = 'goal2-debt-head';
    const name = document.createElement('div');
    name.className = 'goal2-debt-name';
    name.textContent = debt.name || 'Debt';
    const meta = document.createElement('div');
    meta.className = 'goal2-debt-meta';
    meta.textContent = moneyExact(current) + ' remaining';
    head.appendChild(name);
    head.appendChild(meta);

    const labels = document.createElement('div');
    labels.className = 'progress-label-row debt';
    labels.innerHTML = '<span>' + moneyExact(paid) + ' paid</span><span><strong>' + pct.toFixed(1) + '%</strong></span>';

    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill-debt';
    fill.style.width = pct.toFixed(2) + '%';
    track.appendChild(fill);

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const history = Array.isArray(debt.paymentHistory) ? debt.paymentHistory : [];
    const recent = history.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal2-debt-payments';
    const summary = document.createElement('summary');
    summary.className = 'goal2-debt-payments-summary';
    summary.textContent = 'Recent payments (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal2-debt-payments-empty';
      empty.textContent = 'No payments recorded in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal2-debt-payments-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        li.className = 'goal2-debt-payment-row';
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal2-debt-payment-meta';
        metaSpan.textContent = moneyExact(Number(p.amount)) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal2-remove-payment no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-debt-id', String(debt.id));
        rm.setAttribute('data-payment-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    wrap.appendChild(head);
    wrap.appendChild(labels);
    wrap.appendChild(track);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}

export function appendDebtsEditorEmptyState(host) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">📊</div>' +
    '<h3 class="editor-empty-state__title">No debts yet</h3>' +
    '<p class="editor-empty-state__text">Add credit cards or loans to track balances, APR, promos, and payments. Use <strong>+ Add debt</strong> below to get started.</p>';
  host.appendChild(wrap);
}

/** Spreadsheet-style table: one header row, data rows are `<tr class="debt-row">`. */
export function buildDebtsEditorThead() {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.className = 'editor-table__head-row';
  const headers = [
    { t: 'Name', title: '' },
    { t: 'Balance', title: 'Current balance' },
    { t: 'APR %', title: 'Annual percentage rate' },
    { t: 'Def $', title: 'Deferred balance (0% promo)' },
    { t: 'Until', title: 'Deferred rate expires' },
    { t: 'Pay', title: 'Payment to log, then +' },
    { t: '', title: 'Remove row' },
  ];
  headers.forEach(function (h) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h.t;
    if (h.title) th.title = h.title;
    if (!h.t) {
      th.className = 'editor-table__th--action';
      th.setAttribute('aria-label', 'Remove');
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  return thead;
}

/**
 * @param {object} debt
 * @returns {HTMLTableRowElement}
 */
export function buildDebtRowTR(debt) {
  const row = document.createElement('tr');
  row.className = 'debt-row';
  row.setAttribute('data-debt-id', String(debt.id));

  function tdInput(className, inner) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.innerHTML = inner;
    return td;
  }

  row.appendChild(
    tdInput(
      'editor-table__cell--name',
      '<input type="text" data-field="name" autocomplete="off" value="">'
    )
  );
  row.appendChild(
    tdInput('', '<input type="text" data-field="current" inputmode="decimal" autocomplete="off" value="">')
  );
  row.appendChild(
    tdInput(
      '',
      '<input type="text" data-field="aprPct" inputmode="decimal" autocomplete="off" placeholder="0" value="">'
    )
  );
  row.appendChild(
    tdInput(
      '',
      '<input type="text" data-field="deferredAmount" inputmode="decimal" autocomplete="off" value="">'
    )
  );
  row.appendChild(
    tdInput('', '<input type="date" data-field="deferredExpiresOn" autocomplete="off" value="">')
  );
  row.appendChild(
    tdInput(
      'editor-table__cell--pay',
      '<div class="field-inline-action">' +
        '<input type="text" data-field="payment" inputmode="decimal" autocomplete="off" placeholder="0.00">' +
        '<button type="button" class="btn-icon btn-quick-payment" data-action="quick-payment" title="Log payment now" aria-label="Log payment now">+</button>' +
        '</div>'
    )
  );
  const rmTd = document.createElement('td');
  rmTd.className = 'editor-table__cell--actions';
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'btn-remove-debt';
  rm.setAttribute('data-action', 'remove');
  rm.textContent = 'Remove';
  rmTd.appendChild(rm);
  row.appendChild(rmTd);

  const nameInput = row.querySelector('input[data-field="name"]');
  const curInput = row.querySelector('input[data-field="current"]');
  const aprInput = row.querySelector('input[data-field="aprPct"]');
  const defInput = row.querySelector('input[data-field="deferredAmount"]');
  const defDateInput = row.querySelector('input[data-field="deferredExpiresOn"]');
  if (nameInput) nameInput.value = debt.name || '';
  if (curInput) curInput.value = formatMoneyInput(numOr(debt.current, 0));
  if (aprInput) aprInput.value = formatMoneyInput(numOr(debt.aprPct, DEFAULT_DEBT_APR_PCT));
  if (defInput) defInput.value = formatMoneyInput(numOr(debt.deferredAmount, 0));
  if (defDateInput) defDateInput.value = typeof debt.deferredExpiresOn === 'string' ? debt.deferredExpiresOn : '';

  return row;
}

export function renderDebtsEditor(plan) {
  const host = document.getElementById('debts-editor-list');
  if (!host) return;
  host.innerHTML = '';
  const debts = getDebtsInEditorOrder(plan);
  if (debts.length === 0) {
    appendDebtsEditorEmptyState(host);
    return;
  }
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--debts';
  table.setAttribute('role', 'grid');
  table.appendChild(buildDebtsEditorThead());
  const tbody = document.createElement('tbody');
  debts.forEach(function (debt) {
    tbody.appendChild(buildDebtRowTR(debt));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

export function syncDebtsEditorSortSelect(plan) {
  const sortSel = document.getElementById('debts-editor-sort');
  if (!sortSel) return;
  sortSel.value = normalizeDebtsEditorSort(plan.debtsEditorSort);
}

export function syncDebtsProgressSortSelect(plan) {
  const sortSel = document.getElementById('debts-progress-sort');
  if (!sortSel) return;
  sortSel.value = normalizeDebtsProgressSort(plan.debtsProgressSort);
}

export function appendSavingsEditorEmptyState(host) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-empty-state editor-empty-state--savings';
  wrap.setAttribute('role', 'status');
  wrap.innerHTML =
    '<div class="editor-empty-state__icon" aria-hidden="true">🏦</div>' +
    '<h3 class="editor-empty-state__title">No savings accounts</h3>' +
    '<p class="editor-empty-state__text">Add joint or personal accounts to track balances, APY, and deposits toward your emergency fund. Use <strong>+ Add account</strong> below.</p>';
  host.appendChild(wrap);
}

export function buildSavingsEditorThead() {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.className = 'editor-table__head-row';
  const headers = [
    { t: 'Name', title: '' },
    { t: 'Balance', title: 'Current balance' },
    { t: 'APY %', title: 'Annual percentage yield' },
    { t: 'Deposit', title: 'Deposit to log, then +' },
    { t: 'Goals', title: 'This balance can count toward one or more targets' },
    { t: '', title: 'Remove row' },
  ];
  headers.forEach(function (h) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h.t;
    if (h.title) th.title = h.title;
    if (!h.t) {
      th.className = 'editor-table__th--action';
      th.setAttribute('aria-label', 'Remove');
    }
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  return thead;
}

/**
 * @param {object} acc
 * @param {Array<{ id?: string, name?: string }>} savingsGoals
 * @returns {HTMLTableRowElement}
 */
export function buildSavingsRowTR(acc, savingsGoals) {
  const row = document.createElement('tr');
  row.className = 'savings-row';
  row.setAttribute('data-savings-id', String(acc.id));

  const tdName = document.createElement('td');
  tdName.className = 'editor-table__cell--name';
  tdName.innerHTML = '<input type="text" data-field="name" autocomplete="off" value="">';

  const tdCur = document.createElement('td');
  tdCur.innerHTML =
    '<input type="text" data-field="current" inputmode="decimal" autocomplete="off" value="">';

  const tdApy = document.createElement('td');
  tdApy.innerHTML =
    '<input type="text" data-field="apyPct" inputmode="decimal" autocomplete="off" placeholder="0" value="">';

  const tdDep = document.createElement('td');
  tdDep.className = 'editor-table__cell--pay';
  tdDep.innerHTML =
    '<div class="field-inline-action">' +
    '<input type="text" data-field="deposit" inputmode="decimal" autocomplete="off" placeholder="0.00">' +
    '<button type="button" class="btn-icon btn-quick-deposit" data-action="quick-deposit" title="Log deposit now" aria-label="Log deposit now">+</button>' +
    '</div>';

  const tdGoal = document.createElement('td');
  tdGoal.className = 'editor-table__cell--goals';
  const goals = Array.isArray(savingsGoals) ? savingsGoals : [];
  if (goals.length === 0) {
    tdGoal.textContent = '—';
  } else {
    goals.forEach(function (g) {
      const gid = String(g && g.id ? g.id : '');
      if (!gid) return;
      const label = document.createElement('label');
      label.className = 'editor-savings-goal-check';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-field', 'goalId');
      cb.setAttribute('data-goal-id', gid);
      cb.setAttribute('aria-label', 'Count toward ' + String(g.name || gid));
      cb.checked = accountContributesToGoal(acc, gid);
      const span = document.createElement('span');
      span.className = 'editor-savings-goal-check__text';
      span.textContent = String(g.name || gid);
      label.appendChild(cb);
      label.appendChild(span);
      tdGoal.appendChild(label);
    });
  }

  const rmTd = document.createElement('td');
  rmTd.className = 'editor-table__cell--actions';
  const rm = document.createElement('button');
  rm.type = 'button';
  rm.className = 'btn-remove-savings';
  rm.setAttribute('data-action', 'remove');
  rm.textContent = 'Remove';
  rmTd.appendChild(rm);

  row.appendChild(tdName);
  row.appendChild(tdCur);
  row.appendChild(tdApy);
  row.appendChild(tdDep);
  row.appendChild(tdGoal);
  row.appendChild(rmTd);

  const nameInput = row.querySelector('input[data-field="name"]');
  const curInput = row.querySelector('input[data-field="current"]');
  const apyInput = row.querySelector('input[data-field="apyPct"]');
  if (nameInput) nameInput.value = acc.name || '';
  if (curInput) curInput.value = formatMoneyInput(numOr(acc.current, 0));
  if (apyInput) apyInput.value = formatMoneyInput(numOr(acc.apyPct, DEFAULT_SAVINGS_APY_PCT));

  return row;
}

export function renderSavingsEditor(d) {
  const host = document.getElementById('savings-editor-list');
  if (!host) return;
  host.innerHTML = '';
  const accs = d.savingsAccounts || [];
  ensureSavingsGoals(PLAN);
  const savingsGoals = PLAN.savingsGoals || [];
  if (accs.length === 0) {
    appendSavingsEditorEmptyState(host);
    return;
  }
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--savings';
  table.setAttribute('role', 'grid');
  table.appendChild(buildSavingsEditorThead());
  const tbody = document.createElement('tbody');
  accs.forEach(function (acc) {
    tbody.appendChild(buildSavingsRowTR(acc, savingsGoals));
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

export function renderGoal3SavingsAccounts(d, moneyExact) {
  const host = document.getElementById('goal3-savings');
  if (!host) return;
  host.innerHTML = '';
  const accs = d.savingsAccounts || [];
  accs.forEach(function (acc) {
    const current = numOr(acc.current, 0);
    const hist = Array.isArray(acc.depositHistory) ? acc.depositHistory : [];
    const lifetimeDep = hist.reduce(function (s, p) {
      return s + numOr(p.amount, 0);
    }, 0);

    const wrap = document.createElement('div');
    wrap.className = 'goal3-savings-account';

    const head = document.createElement('div');
    head.className = 'goal3-savings-head';
    const name = document.createElement('div');
    name.className = 'goal3-savings-name';
    name.textContent = acc.name || 'Account';
    const meta = document.createElement('div');
    meta.className = 'goal3-savings-meta';
    const apy = numOr(acc.apyPct, 0);
    meta.textContent =
      apy.toFixed(2) +
      '% APY · ' +
      moneyExact(lifetimeDep) +
      ' logged deposits (lifetime)';
    head.appendChild(name);
    head.appendChild(meta);

    const goalWrap = document.createElement('div');
    goalWrap.className = 'goal3-savings-goals';
    const summaries = d.savingsGoalSummaries || [];
    let anyGoal = false;
    summaries.forEach(function (sg) {
      if (!accountContributesToGoal(acc, sg.id)) return;
      anyGoal = true;
      const goalAmt = numOr(sg.targetAmount, 0);
      const pctTowardGoal = goalAmt > 0 ? Math.min(100, (current / goalAmt) * 100) : 0;
      const sub = document.createElement('div');
      sub.className = 'goal3-savings-goal-line';
      const cap = document.createElement('div');
      cap.className = 'goal3-savings-goal-caption';
      cap.textContent = String(sg.name || 'Goal');
      const prog = document.createElement('div');
      prog.className = 'goal3-savings-progress goal3-savings-progress--nested';
      const labels = document.createElement('div');
      labels.className = 'progress-label-row';
      const labelLeft =
        goalAmt > 0
          ? moneyExact(current) + ' of ' + moneyExact(goalAmt)
          : moneyExact(current) + ' balance';
      const labelRight =
        goalAmt > 0
          ? '<strong>' + pctTowardGoal.toFixed(1) + '%</strong> of target'
          : '<strong>—</strong> set target in goal list';
      labels.innerHTML = '<span>' + labelLeft + '</span><span>' + labelRight + '</span>';
      const track = document.createElement('div');
      track.className = 'progress-track';
      const fill = document.createElement('div');
      fill.className = 'progress-fill-purple';
      fill.style.width = goalAmt > 0 ? pctTowardGoal.toFixed(2) + '%' : '0%';
      track.appendChild(fill);
      prog.appendChild(labels);
      prog.appendChild(track);
      sub.appendChild(cap);
      if (sg.goalByWhen) {
        const when = document.createElement('div');
        when.className = 'goal3-savings-goal-when';
        when.textContent = String(sg.goalByWhen);
        sub.appendChild(when);
      }
      sub.appendChild(prog);
      goalWrap.appendChild(sub);
    });
    if (!anyGoal) {
      const none = document.createElement('div');
      none.className = 'goal3-savings-not-goal';
      none.textContent = 'Not assigned to any savings goal — use checkboxes in the savings editor.';
      goalWrap.appendChild(none);
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = hist.filter(function (p) {
      const ts = new Date(p.at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    recent.sort(function (a, b) {
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });

    const details = document.createElement('details');
    details.className = 'goal3-savings-deposits';
    const summary = document.createElement('summary');
    summary.className = 'goal3-savings-deposits-summary';
    summary.textContent = 'Recent deposits (30 days)' + (recent.length ? ' · ' + recent.length : '');
    details.appendChild(summary);

    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'goal3-savings-deposits-empty';
      empty.textContent = 'No deposits logged in the last 30 days.';
      details.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'goal3-savings-deposits-list';
      recent.forEach(function (p) {
        const li = document.createElement('li');
        li.className = 'goal3-savings-deposit-row';
        const dateStr = new Date(p.at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        const metaSpan = document.createElement('span');
        metaSpan.className = 'goal3-savings-deposit-meta';
        metaSpan.textContent = moneyExact(Number(p.amount)) + ' · ' + dateStr;

        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'goal3-remove-deposit no-print';
        rm.textContent = 'Remove';
        rm.setAttribute('data-savings-id', String(acc.id));
        rm.setAttribute('data-deposit-id', String(p.id));

        li.appendChild(metaSpan);
        li.appendChild(rm);
        ul.appendChild(li);
      });
      details.appendChild(ul);
    }

    wrap.appendChild(head);
    wrap.appendChild(goalWrap);
    wrap.appendChild(details);
    host.appendChild(wrap);
  });
}

/**
 * Renders stacked progress cards for each savings goal (plan tab + dashboard).
 * @param {string} hostId
 * @param {object} d — result of `derived(PLAN)`
 * @param {(n: number) => string} money
 * @param {(n: number) => string} moneyExact
 * @param {{ hasData?: boolean }} [opts]
 */
export function renderSavingsGoalsStack(hostId, d, money, moneyExact, opts) {
  const host = document.getElementById(hostId);
  if (!host) return;
  const hasData = opts && opts.hasData;
  const sums = d.savingsGoalSummaries || [];
  host.innerHTML = '';
  if (sums.length === 0) {
    const p = document.createElement('p');
    p.className = 'savings-goals-stack__empty';
    p.textContent = 'Add savings targets in “Edit goal targets” above.';
    host.appendChild(p);
    return;
  }
  sums.forEach(function (sg) {
    const block = document.createElement('div');
    block.className = 'savings-goal-block';
    const title = document.createElement('div');
    title.className = 'savings-goal-block__title';
    title.textContent = String(sg.name || 'Goal');
    block.appendChild(title);
    if (sg.goalByWhen) {
      const when = document.createElement('div');
      when.className = 'savings-goal-block__when';
      when.textContent = String(sg.goalByWhen);
      block.appendChild(when);
    }

    const grid = document.createElement('div');
    grid.className = 'efund-grid savings-goal-block__grid';
    function cell(label, val, note) {
      const it = document.createElement('div');
      it.className = 'efund-item';
      const l = document.createElement('div');
      l.className = 'efund-item-label';
      l.textContent = label;
      const v = document.createElement('div');
      v.className = 'efund-item-val';
      v.textContent = val;
      const n = document.createElement('div');
      n.className = 'efund-item-note';
      n.textContent = note;
      it.appendChild(l);
      it.appendChild(v);
      it.appendChild(n);
      return it;
    }
    grid.appendChild(
      cell(
        'Target',
        money(sg.targetAmount),
        String(sg.id) === 'goal-efund' ? 'Often 12 × monthly expenses — editable below' : 'Goal amount'
      )
    );
    grid.appendChild(cell('Assigned balances', moneyExact(sg.sum), 'Full balance of each linked account'));
    grid.appendChild(cell('Gap', moneyExact(sg.gap), 'Still needed'));
    block.appendChild(grid);

    const prog = document.createElement('div');
    prog.className = 'progress-wrap';
    const row = document.createElement('div');
    row.className = 'progress-label-row';
    if (hasData && sg.targetAmount > 0) {
      row.innerHTML =
        '<span>' +
        moneyExact(sg.sum) +
        ' toward target</span><span><strong>' +
        sg.pct.toFixed(1) +
        '%</strong> complete</span>';
    } else if (!hasData) {
      row.innerHTML =
        '<span>$0</span><span><strong>—</strong> add accounts in Goal 3</span>';
    } else {
      row.innerHTML =
        '<span>' + moneyExact(sg.sum) + '</span><span>Set a target above $0 to track %</span>';
    }
    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill-purple';
    fill.style.width =
      hasData && sg.targetAmount > 0 ? Math.min(100, sg.pct).toFixed(2) + '%' : '0%';
    track.appendChild(fill);
    prog.appendChild(row);
    prog.appendChild(track);
    block.appendChild(prog);
    host.appendChild(block);
  });
}
