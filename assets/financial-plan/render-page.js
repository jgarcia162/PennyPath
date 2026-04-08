/**
 * Main page render: binds PLAN + derived metrics to DOM ids.
 */

import { PLAN } from './plan-data.js';
import { derived } from './plan-derived.js';
import { createMoneyFormatters, setText, setHtml, numOr } from './utils.js';
import {
  renderGoal2Debts,
  renderDebtsEditor,
  syncDebtsEditorSortSelect,
  syncDebtsProgressSortSelect,
  renderGoal3SavingsAccounts,
  renderSavingsEditor,
} from './render-sections.js';
import { renderPayoffTimeline, renderBadges } from './features.js';
import { renderCheckIns } from './checkin-log.js';
import {
  hasBalanceDataForProjections,
  hasDebtBalanceForInterest,
  hasDebtsOnFile,
} from './plan-empty-state.js';

const { money, moneyExact } = createMoneyFormatters();

export function render() {
  const d = derived(PLAN);
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
    setText('goal-debt-amt', money(d.debtRounded));
    setText('goal-debt-when', PLAN.labels.goalDebtWhen);
    setText('debt-progress-left', moneyExact(d.totalDebt) + ' remaining');
    setHtml('debt-progress-right', '<strong>' + d.debtGoalPct.toFixed(1) + '%</strong> paid toward $0');
    const debtFill = document.getElementById('debt-progress-fill');
    if (debtFill) debtFill.style.width = Math.min(100, d.debtGoalPct).toFixed(2) + '%';
  } else {
    setText('goal-debt-amt', '—');
    setText('goal-debt-when', 'Add a debt in Goal 2');
    setText('debt-progress-left', 'No debts on file');
    setHtml('debt-progress-right', '<strong>—</strong>');
    const debtFill = document.getElementById('debt-progress-fill');
    if (debtFill) debtFill.style.width = '0%';
  }

  const monthlySection = document.getElementById('monthly-debt-goal-section');
  if (monthlySection) monthlySection.hidden = !hasDebts;
  if (hasDebts) {
    setText('monthly-debt-goal-meta', 'Goal ' + money(d.monthlyDebtGoal) + '/mo');
    setText('monthly-debt-paid-label', moneyExact(d.monthlyDebtPaid) + ' / ' + moneyExact(d.monthlyDebtGoal));
    setHtml(
      'monthly-debt-pct-label',
      '<strong>' + d.monthlyDebtPct.toFixed(1) + '%</strong> of monthly target'
    );
    const monthlyFill = document.getElementById('monthly-debt-progress-fill');
    if (monthlyFill) monthlyFill.style.width = Math.min(100, d.monthlyDebtPct).toFixed(2) + '%';
    setText(
      'monthly-debt-goal-hint',
      'Sum of payments logged this calendar month across all debts (saved from the Goal 2 editor).'
    );
  }

  setText(
    'goal2-editor-dialog-totals',
    hasDebts ? moneyExact(d.totalDebt) + ' total owed' : 'No balances yet'
  );
  setText(
    'goal3-editor-dialog-totals',
    moneyExact(d.totalAssets) + ' saved of ' + moneyExact(PLAN.goalHysa)
  );

  renderGoal2Debts(PLAN, moneyExact);
  renderDebtsEditor(PLAN);
  syncDebtsEditorSortSelect(PLAN);
  syncDebtsProgressSortSelect(PLAN);
  renderGoal3SavingsAccounts(d, moneyExact);
  renderSavingsEditor(d);

  setText('goal-efund-amt', money(d.efundTarget));
  if (hasData) {
    setText(
      'goal-efund-desc',
      'A full ' +
        PLAN.efundMonths +
        '-month emergency fund based on ' +
        money(PLAN.monthlyFixedExpenses) +
        '/month in fixed expenses. We\'re already ' +
        d.efundPct.toFixed(1) +
        '% of the way there — we just need to grow it by ' +
        moneyExact(d.efundGap) +
        ' more.'
    );
  } else {
    setText(
      'goal-efund-desc',
      'A full ' +
        PLAN.efundMonths +
        '-month emergency fund based on ' +
        money(PLAN.monthlyFixedExpenses) +
        '/month in fixed expenses. Add personal savings in Goal 3 to track how close you are to this target.'
    );
  }
  setText('goal-efund-when', PLAN.labels.efundBuildAfter);

  setText('efund-target-val', money(d.efundTarget));
  setText('efund-target-note', String(PLAN.efundMonths) + ' × ' + money(PLAN.monthlyFixedExpenses) + ' per month');
  setText('efund-have-val', moneyExact(d.personalSavings));
  setText('efund-gap-val', moneyExact(d.efundGap));

  if (hasData) {
    setText('efund-progress-left', moneyExact(d.personalSavings) + ' saved');
    setHtml('efund-progress-right', '<strong>' + d.efundPct.toFixed(1) + '%</strong> of the way there');
  } else {
    setText('efund-progress-left', '$0 saved');
    setHtml('efund-progress-right', '<strong>—</strong> add balances in Goal 3');
  }
  const ef = document.getElementById('efund-progress-fill');
  if (ef) ef.style.width = hasData ? Math.min(100, d.efundPct).toFixed(2) + '%' : '0%';

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
