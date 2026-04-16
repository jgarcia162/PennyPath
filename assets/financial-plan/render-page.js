/**
 * Main page render: binds PLAN + derived metrics to DOM ids.
 */

import { PLAN } from './plan-data.js';
import { derived, getWorkingMonthYm } from './plan-derived.js';
import { collectDashboardMonthOptions, monthLabel } from './monthly-activity.js';
import { createMoneyFormatters, setText, setHtml, numOr } from './utils.js';
import {
  renderGoal2Debts,
  renderDebtsEditor,
  syncDebtsEditorSortSelect,
  syncDebtsProgressSortSelect,
  renderGoal3SavingsAccounts,
  renderSavingsEditor,
  renderSavingsGoalsStack,
} from './render-sections.js';
import { ensureSavingsGoals } from './savings-goals.js';
import { renderPayoffTimeline, renderBadges } from './features.js';
import { renderCheckIns } from './checkin-log.js';
import {
  hasBalanceDataForProjections,
  hasDebtBalanceForInterest,
  hasDebtsOnFile,
} from './plan-empty-state.js';
import { hasMonthWrapRollback } from './month-wrap.js';

const { money, moneyExact } = createMoneyFormatters();

/** Mirror Goal 2 / Goal 3 cards on the Dashboard (`id` → `dash-${id}`). */
function setTextDash(id, text) {
  setText(id, text);
  const dash = document.getElementById('dash-' + id);
  if (dash) dash.textContent = text;
}

function setHtmlDash(id, html) {
  setHtml(id, html);
  const dash = document.getElementById('dash-' + id);
  if (dash) dash.innerHTML = html;
}

function setProgWidthDash(id, pct) {
  const w = (Number.isFinite(pct) ? Math.min(100, pct).toFixed(2) : String(pct)) + '%';
  const a = document.getElementById(id);
  const b = document.getElementById('dash-' + id);
  if (a) a.style.width = w;
  if (b) b.style.width = w;
}

function setSectionHiddenDash(id, hidden) {
  const a = document.getElementById(id);
  const b = document.getElementById('dash-' + id);
  if (a) a.hidden = hidden;
  if (b) b.hidden = hidden;
}

function loadCheckinsForMonthPicker() {
  try {
    if (window.CheckInService && typeof window.CheckInService.list === 'function') {
      return window.CheckInService.list();
    }
  } catch (e) {}
  return [];
}

function syncDashboardMonthSelect() {
  const sel = document.getElementById('dashboard-view-month');
  if (!sel) return;
  const checkins = loadCheckinsForMonthPicker();
  const workingYm = getWorkingMonthYm(PLAN);
  const months = collectDashboardMonthOptions(PLAN, checkins, workingYm);
  const explicit =
    typeof PLAN.dashboardViewMonthYm === 'string' && /^\d{4}-\d{2}$/.test(PLAN.dashboardViewMonthYm)
      ? PLAN.dashboardViewMonthYm
      : '';
  sel.innerHTML = '';
  const optFollow = document.createElement('option');
  optFollow.value = '';
  optFollow.textContent = 'Follow working month (' + monthLabel(workingYm) + ')';
  sel.appendChild(optFollow);
  months.forEach(function (ym) {
    const opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = monthLabel(ym);
    sel.appendChild(opt);
  });
  if (explicit !== '' && months.indexOf(explicit) === -1) {
    const opt = document.createElement('option');
    opt.value = explicit;
    opt.textContent = monthLabel(explicit);
    sel.appendChild(opt);
  }
  sel.value = explicit;
}

function renderSavingsGoalsTargetEditor() {
  ensureSavingsGoals(PLAN);
  const host = document.getElementById('savings-goals-target-editor');
  if (!host) return;
  host.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'editor-table editor-table--goal-targets';
  table.setAttribute('role', 'grid');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  trh.className = 'editor-table__head-row';
  [
    { t: 'Goal name', title: 'Savings goal label' },
    { t: 'Target amount', title: 'Dollar target for this goal' },
    { t: '', title: 'Remove row' },
  ].forEach(function (h) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h.t;
    if (h.title) th.title = h.title;
    if (!h.t) {
      th.className = 'editor-table__th--action';
      th.setAttribute('aria-label', 'Remove');
    }
    trh.appendChild(th);
  });
  thead.appendChild(trh);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  (PLAN.savingsGoals || []).forEach(function (g) {
    const row = document.createElement('tr');
    row.className = 'savings-goal-target-row';
    row.setAttribute('data-goal-id', String(g.id));

    const tdName = document.createElement('td');
    tdName.className = 'editor-table__cell--name';
    const nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.setAttribute('data-field', 'goal-name');
    nameIn.setAttribute('aria-label', 'Goal name');
    nameIn.value = String(g.name || '');
    tdName.appendChild(nameIn);

    const tdAmt = document.createElement('td');
    const amtIn = document.createElement('input');
    amtIn.type = 'text';
    amtIn.inputMode = 'decimal';
    amtIn.setAttribute('data-field', 'goal-amount');
    amtIn.setAttribute('aria-label', 'Goal amount');
    amtIn.value = String(Math.round(numOr(g.targetAmount, 0)));
    tdAmt.appendChild(amtIn);

    const tdRm = document.createElement('td');
    tdRm.className = 'editor-table__cell--actions';
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn-remove-savings';
    rm.setAttribute('data-action', 'remove-savings-goal');
    rm.setAttribute('data-goal-id', String(g.id));
    rm.textContent = 'Remove';
    tdRm.appendChild(rm);

    row.appendChild(tdName);
    row.appendChild(tdAmt);
    row.appendChild(tdRm);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  host.appendChild(table);
}

function monthlyDebtBarHint(d) {
  const view = d.dashboardViewMonthLabel;
  if (d.viewingDifferentFromWorking) {
    return (
      'Payments logged in ' +
      view +
      ' count toward this bar. Working month for wrap-up is still ' +
      d.workingMonthLabel +
      '. Choose “Follow working month” to align the bar with wrap-up.'
    );
  }
  return (
    'Payments logged in ' +
      view +
      ' count toward this bar. Wrap up the month on the Dashboard when you are ready for a fresh monthly target.'
  );
}

export function render() {
  const d = derived(PLAN);
  syncDashboardMonthSelect();
  const noteWorking = document.getElementById('dashboard-view-working-note');
  if (noteWorking) {
    noteWorking.hidden = !d.viewingDifferentFromWorking;
    noteWorking.textContent = d.viewingDifferentFromWorking
      ? 'Wrap-up month: ' + d.workingMonthLabel + '. New payments and deposits use dates in ' + d.dashboardViewMonthLabel + ' while this view is selected.'
      : '';
  }
  const undoWrap = document.getElementById('btn-month-wrap-undo');
  if (undoWrap) undoWrap.disabled = !hasMonthWrapRollback();
  const hasData = hasBalanceDataForProjections(PLAN);
  const hasDebtBal = hasDebtBalanceForInterest(PLAN);
  const hasDebts = hasDebtsOnFile(PLAN);

  setText(
    'cover-sub',
    'Eliminate all credit card debt, reach ' +
      money(PLAN.goalHysa) +
      ' in savings, and build a full ' +
      String(PLAN.efundMonths) +
      '-month emergency fund.'
  );

  setText('cover-takehome', money(PLAN.monthlyTakeHome));
  if (hasData) {
    setText('cover-debt-free-date', PLAN.debtFreeBy);
    setText('cover-debt-free-note', '~' + PLAN.monthsToDebtFree + ' months away');
    setText('cover-hysa-goal-label', money(PLAN.goalHysa) + ' HYSA By');
    setText('cover-hysa-by', PLAN.labels.hysaGoalByShort);
    setText('cover-hysa-note', '~' + PLAN.monthsToHysaGoal + ' months away');
  } else {
    setText('cover-debt-free-date', '—');
    setText('cover-debt-free-note', 'Add debts in Goal 2 to see a target date.');
    setText('cover-hysa-goal-label', money(PLAN.goalHysa) + ' HYSA By');
    setText('cover-hysa-by', '—');
    setText('cover-hysa-note', 'Add savings in Goal 3 to track progress toward your goal.');
  }

  setText('status-hysa', money(PLAN.hysaBalance));
  if (hasData) {
    setText(
      'status-hysa-note',
      'Earning ' + (PLAN.hysaApy * 100).toFixed(2) + '% APY — ~' + money(Math.round(d.hysaInterestYr)) + '/yr in interest'
    );
  } else {
    setText('status-hysa-note', 'No joint balance on file — add or edit accounts in Goal 3.');
  }
  setText('status-personal', moneyExact(d.personalSavings));
  if (hasData) {
    setText(
      'status-personal-note',
      (d.savingsAccounts || [])
        .filter(function (a) {
          return String(a.id) !== 'hysa';
        })
        .map(function (a) {
          return (a.name || 'Account') + ' ' + moneyExact(numOr(a.current, 0));
        })
        .join(' · ') + ' — current emergency fund (non–joint accounts)'
    );
  } else {
    setText('status-personal-note', 'Add personal savings accounts in Goal 3 to track your emergency fund.');
  }
  setText('status-debt-rounded', money(d.debtRounded));
  setText('status-debt-note', hasDebts ? moneyExact(d.totalDebt) + ' total — edit in Goal 2' : 'No debts on file — add them in Goal 2.');
  setText('status-takehome', money(PLAN.monthlyTakeHome));
  setText('status-takehome-note', moneyExact(PLAN.paycheckAmount) + ' × ' + PLAN.paychecksPerMonth + ' paychecks per month');

  setText('nw-legend-assets', 'Assets: ' + moneyExact(d.totalAssets));
  setText('nw-legend-debt', 'Debt: ' + moneyExact(d.totalDebt));
  setText('nw-total-line', '~' + moneyExact(d.netWorth) + ' net worth');
  setText(
    'nw-total-sub',
    hasData ? '— growing to $' + PLAN.netWorthGoalK + 'K+ by end of plan' : '— Net worth projections appear once you add balances in Goals 2 & 3.'
  );

  const nwA = document.getElementById('nw-fill-assets');
  const nwD = document.getElementById('nw-fill-debt');
  if (nwA) nwA.style.width = d.assetBarPct.toFixed(2) + '%';
  if (nwD) nwD.style.width = d.debtBarPct.toFixed(2) + '%';

  setText('goal-hysa-amt', money(PLAN.goalHysa));
  setText('goal-hysa-when', PLAN.labels.goalHysaWhen);
  if (hasDebts) {
    setTextDash('goal-debt-amt', money(d.debtRounded));
    setTextDash('goal-debt-when', PLAN.labels.goalDebtWhen);
    setTextDash('debt-progress-left', moneyExact(d.totalDebt) + ' remaining');
    setHtmlDash('debt-progress-right', '<strong>' + d.debtGoalPct.toFixed(1) + '%</strong> paid toward $0');
    setProgWidthDash('debt-progress-fill', d.debtGoalPct);
  } else {
    setTextDash('goal-debt-amt', '—');
    setTextDash('goal-debt-when', 'Add a debt in Goal 2');
    setTextDash('debt-progress-left', 'No debts on file');
    setHtmlDash('debt-progress-right', '<strong>—</strong>');
    setProgWidthDash('debt-progress-fill', 0);
  }

  setSectionHiddenDash('monthly-debt-goal-section', !hasDebts);
  if (hasDebts) {
    setTextDash(
      'monthly-debt-goal-meta',
      d.dashboardViewMonthLabel + ' · Goal ' + money(d.monthlyDebtGoal) + '/mo'
    );
    setTextDash('monthly-debt-paid-label', moneyExact(d.monthlyDebtPaid) + ' / ' + moneyExact(d.monthlyDebtGoal));
    setHtmlDash(
      'monthly-debt-pct-label',
      '<strong>' + d.monthlyDebtPct.toFixed(1) + '%</strong> of monthly target'
    );
    setProgWidthDash('monthly-debt-progress-fill', d.monthlyDebtPct);
    setTextDash('monthly-debt-goal-hint', monthlyDebtBarHint(d));
  }

  setText(
    'goal2-editor-dialog-totals',
    hasDebts ? moneyExact(d.totalDebt) + ' total owed' : 'No balances yet'
  );
  setText(
    'goal3-editor-dialog-totals',
    moneyExact(d.goalSavingsCurrent) + ' saved of ' + moneyExact(PLAN.goalHysa)
  );

  renderGoal2Debts(PLAN, moneyExact);
  renderDebtsEditor(PLAN);
  syncDebtsEditorSortSelect(PLAN);
  syncDebtsProgressSortSelect(PLAN);
  renderGoal3SavingsAccounts(d, moneyExact);
  renderSavingsEditor(d);

  renderSavingsGoalsTargetEditor();

  const nGoals = (d.savingsGoalSummaries || []).length;
  setTextDash('goal-efund-amt', nGoals ? nGoals + ' savings targets' : 'Savings targets');
  setTextDash(
    'goal-efund-desc',
    'Link accounts to each target above. The same balance can count toward multiple goals when it applies.'
  );
  setTextDash('goal-efund-when', PLAN.labels.efundBuildAfter);

  renderSavingsGoalsStack('savings-goals-stack', d, money, moneyExact, { hasData: hasData });
  renderSavingsGoalsStack('dash-savings-goals-stack', d, money, moneyExact, { hasData: hasData });

  setHtml(
    'callout-full-picture',
    hasData
      ? '<strong>The full picture by end of plan</strong> By ' +
          PLAN.labels.fullPictureBy +
          ': zero debt, ' +
          money(Math.round(d.hysaEndPlan)) +
          ' HYSA, and ' +
          moneyExact(d.personalEndPlan) +
          ' personal savings — total liquid of ' +
          moneyExact(d.totalLiquidEndPlan) +
          '+. After that, redirecting just a portion of the freed-up ' +
          money(d.phase2Savings) +
          '/month toward the emergency fund closes the ' +
          money(Math.round(d.efundGap)) +
          ' gap in about ' +
          PLAN.labels.monthsToCloseEfund +
          ' months. Full financial security well within reach by late 2027.'
      : '<strong>The full picture by end of plan</strong> Once you add savings and debt balances in Goals 2 &amp; 3 and save, this space will summarize your projected end-of-plan liquid total and next steps toward your emergency fund.'
  );

  setHtml(
    'callout-why-12',
    hasData
      ? '<strong>💡 Why 12 months?</strong> Most financial advisors recommend 3 - 6 months of expenses. A 12-month fund gives you an extra layer of protection — enough runway to handle a job loss, major medical event, or large unexpected expense without ever touching a credit card again. At ' +
          moneyExact(d.personalSavings) +
          ", you're already ahead of most households."
      : '<strong>💡 Why 12 months?</strong> Most financial advisors recommend 3–6 months of expenses. A 12-month fund adds extra runway for job loss, major medical costs, or large surprises — without leaning on credit cards. Your progress toward that fund will show here once you add account balances in Goal 3.'
  );

  setText('phase1-cc', money(PLAN.phase1.ccPayment) + '/mo');
  setText('phase1-hysa', money(PLAN.phase1.hysaDeposit) + '/mo');
  setText('phase1-dur', '~' + PLAN.monthsDebtPayoff + ' months');
  setText('phase2-hysa', money(PLAN.phase2.hysaDeposit) + '/mo');
  setText('phase2-dur', '~' + PLAN.monthsHysaBuild + ' months');
  setText('phase2-result', 'HYSA: $' + PLAN.phase2HysaResultK + 'K+');

  setText('budget-expenses', money(PLAN.monthlyFixedExpenses));
  setText('budget-pct-expenses', d.pctOfBudget(PLAN.monthlyFixedExpenses) + '%');
  setText('budget-cc', money(PLAN.phase1.ccPayment));
  setText('budget-pct-cc', d.pctOfBudget(PLAN.phase1.ccPayment) + '%');
  setText('budget-hysa', money(PLAN.phase1.hysaDeposit));
  setText('budget-pct-hysa', d.pctOfBudget(PLAN.phase1.hysaDeposit) + '%');
  setText('budget-fun', money(PLAN.funBudget));
  setText('budget-pct-fun', d.pctOfBudget(PLAN.funBudget) + '%');
  setText('budget-buffer', money(d.buffer));
  setText('budget-pct-buffer', d.pctOfBudget(d.buffer) + '%');
  setText('budget-total', money(d.budgetTotal));

  const intr = PLAN.interestNote;
  setHtml(
    'callout-interest',
    hasDebtBal
      ? '<strong>⚠️ A note on interest</strong> At a typical ' +
          intr.aprLow +
          '–' +
          intr.aprHigh +
          '% APR, the ' +
          money(d.debtRounded) +
          ' balance will accrue roughly $' +
          intr.monthOneLow +
          '–$' +
          intr.monthOneHigh +
          ' in interest in month one, tapering as the balance drops. Total estimated interest over ' +
          PLAN.monthsDebtPayoff +
          ' months: ~$' +
          intr.total8moLow.toLocaleString() +
          '–$' +
          intr.total8moHigh.toLocaleString() +
          '. Every extra dollar toward the CC directly reduces this cost.'
      : '<strong>⚠️ A note on interest</strong> Add debts with remaining balances in Goal 2 to see estimated interest costs. Until then, there’s nothing to calculate.'
  );

  setHtml(
    'callout-phase2',
    hasData
      ? '<strong>Once the debt is gone in Phase 2...</strong> The full ' +
          money(PLAN.phase1.ccPayment) +
          ' that was going to the credit card flips directly to the HYSA — making your monthly savings deposit ' +
          money(d.phase2Savings) +
          '. No lifestyle change needed. Then after hitting ' +
          money(PLAN.goalHysa) +
          ', a portion of that flow can start building the emergency fund to ' +
          money(d.efundTarget) +
          '.'
      : '<strong>Once the debt is gone in Phase 2...</strong> After you add debt and savings balances in Goals 2 &amp; 3, this section will describe how your payment snowball shifts into savings and emergency-fund building.'
  );

  setHtml(
    'callout-fun',
    '<strong>💡 The fun budget stays. Always.</strong> ' +
      money(PLAN.funBudget) +
      '/month for dates, weekend road trips, and enjoying life is built into the plan and non-negotiable. Sustainability is what makes this work — not deprivation.'
  );

  setText(
    'footer-line',
    hasData
      ? 'Debt-free by ' +
          PLAN.debtFreeBy +
          ' · ' +
          money(PLAN.goalHysa) +
          ' saved by ' +
          PLAN.hysaGoalBy +
          ' · Full emergency fund by late 2027'
      : 'Add your balances in Goals 2 & 3 to see a personalized timeline summary here.'
  );

  renderPayoffTimeline(moneyExact, hasData);
  renderCheckIns();
  renderBadges();
}
