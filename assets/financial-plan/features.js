/**
 * Optional UI: payoff timeline and milestone badges.
 *
 * Depends on globals: `window.PayoffTimeline`, `window.Badges` (classic scripts).
 */

import { PLAN, BADGES_STORAGE_KEY } from './plan-data.js';
import { isFinancialPlanDemoMode } from './persistence.js';
import { getCheckinEntriesForBadges } from './checkin-log.js';
import {
  escapeHtml,
  escapeAttr,
  cssEscape,
  todayYyyyMmDd,
} from './utils.js';

export function renderPayoffTimeline(moneyExact, hasBalanceData) {
  const host = document.getElementById('payoff-timeline');
  if (!host) return;
  if (hasBalanceData === false) {
    host.innerHTML =
      '<div class="timeline-empty-msg">No balances on file yet. Add debts and savings in Goals 2 &amp; 3, then save, to see a month-by-month projection.</div>';
    return;
  }
  const proj =
    window.PayoffTimeline && window.PayoffTimeline.project ? window.PayoffTimeline.project(PLAN, { maxMonths: 48 }) : [];
  if (!proj || !proj.length) {
    host.innerHTML = '<div class="timeline-empty-msg">Timeline unavailable.</div>';
    return;
  }

  const rows = proj.slice(0, 48).map(function (r) {
    return (
      '<tr>' +
      '<td>' +
      r.month +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.ccStart) +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.ccInterest) +
      '</td>' +
      '<td class="num">-' +
      moneyExact(r.ccPayment) +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.ccEnd) +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.hysaStart) +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.hysaInterest) +
      '</td>' +
      '<td class="num">+' +
      moneyExact(r.hysaDeposit) +
      '</td>' +
      '<td class="num">' +
      moneyExact(r.hysaEnd) +
      '</td>' +
      '</tr>'
    );
  }).join('');

  host.innerHTML =
    '<table class="timeline-table">' +
    '<thead><tr>' +
    '<th>Month</th>' +
    '<th>CC start</th>' +
    '<th>CC interest</th>' +
    '<th>CC payment</th>' +
    '<th>CC end</th>' +
    '<th>HYSA start</th>' +
    '<th>HYSA interest</th>' +
    '<th>HYSA deposit</th>' +
    '<th>HYSA end</th>' +
    '</tr></thead>' +
    '<tbody>' +
    rows +
    '</tbody>' +
    '</table>';
}

function loadBadgeUnlocks() {
  try {
    const raw = localStorage.getItem(BADGES_STORAGE_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

function saveBadgeUnlocks(unlocks) {
  try {
    localStorage.setItem(BADGES_STORAGE_KEY, JSON.stringify(unlocks || {}));
  } catch (e) {
    /* ignore */
  }
}

function badgeCatalog() {
  return [
    { id: 'debt-first-step', group: 'debt', color: 'sage', emoji: '🌱', name: 'First Step', desc: 'Any amount has been paid off', need: 'Pay at least $1 toward your debts' },
    { id: 'debt-5k', group: 'debt', color: 'sage', emoji: '💪', name: '$5K Down', desc: '$5,000+ paid off in total', need: 'Reach $5,000 total paid off' },
    { id: 'debt-halfway', group: 'debt', color: 'sage', emoji: '🔥', name: 'Halfway There', desc: '50% of original debt eliminated', need: 'Eliminate 50% of the original debt' },
    { id: 'debt-almost-free', group: 'debt', color: 'sage', emoji: '🏁', name: 'Almost Free', desc: 'Remaining balance under $5,000', need: 'Get remaining debt under $5,000' },
    { id: 'debt-free', group: 'debt', color: 'sage', emoji: '🎉', name: 'Debt Free', desc: 'All balances at $0', need: 'Bring total remaining debt to $0' },
    { id: 'savings-starts', group: 'savings', color: 'gold', emoji: '💰', name: 'Saving Starts', desc: 'HYSA above the starting default', need: 'Grow HYSA above the starting default' },
    { id: 'savings-30k', group: 'savings', color: 'gold', emoji: '⭐', name: '$30K Club', desc: 'HYSA crosses $30,000', need: 'Reach $30,000 in HYSA' },
    { id: 'savings-40k', group: 'savings', color: 'gold', emoji: '🥇', name: '$40K Milestone', desc: 'HYSA crosses $40,000', need: 'Reach $40,000 in HYSA' },
    { id: 'savings-goal', group: 'savings', color: 'gold', emoji: '🏆', name: 'Goal Reached', desc: 'HYSA reaches the plan goal', need: 'Reach your HYSA goal' },
    { id: 'checkins-first', group: 'checkins', color: 'blue', emoji: '📝', name: 'First Check-In', desc: 'At least 1 check-in entry', need: 'Add your first check-in' },
    { id: 'checkins-3', group: 'checkins', color: 'blue', emoji: '🔁', name: '3-Month Streak', desc: 'At least 3 check-ins', need: 'Add 3 check-ins' },
    { id: 'checkins-6', group: 'checkins', color: 'blue', emoji: '🌟', name: '6-Month Streak', desc: 'At least 6 check-ins', need: 'Add 6 check-ins' },
  ];
}

export function renderBadges() {
  const host = document.getElementById('badges-grid');
  if (!host) return;

  const unlocks = loadBadgeUnlocks();
  const checkins = getCheckinEntriesForBadges();
  const evald =
    window.Badges && window.Badges.evaluateBadges ? window.Badges.evaluateBadges(PLAN, checkins) : [];
  const earnedById = {};
  evald.forEach(function (b) {
    earnedById[b.id] = !!b.earned;
  });

  const today = todayYyyyMmDd();
  const justUnlocked = {};
  badgeCatalog().forEach(function (b) {
    if (earnedById[b.id] && !unlocks[b.id]) {
      unlocks[b.id] = today;
      justUnlocked[b.id] = true;
    }
  });
  if (Object.keys(justUnlocked).length && !isFinancialPlanDemoMode()) saveBadgeUnlocks(unlocks);

  host.innerHTML = badgeCatalog()
    .map(function (b) {
      const unlockedOn = unlocks[b.id] || '';
      const earned = !!unlockedOn;
      const lockedText = '🔒 ' + (b.need || 'Keep going');
      const note = earned ? 'Unlocked on ' + unlockedOn : lockedText;
      return (
        '<div class="badge-card ' +
        (earned ? 'is-earned' : 'is-locked') +
        ' badge-' +
        b.color +
        ' ' +
        (justUnlocked[b.id] ? 'just-unlocked' : '') +
        '" ' +
        'data-badge-id="' +
        escapeAttr(b.id) +
        '" ' +
        'data-earned="' +
        (earned ? '1' : '0') +
        '">' +
        '<div class="badge-emoji" aria-hidden="true">' +
        b.emoji +
        '</div>' +
        '<div class="badge-name">' +
        escapeHtml(b.name) +
        '</div>' +
        '<div class="badge-desc">' +
        escapeHtml(b.desc) +
        '</div>' +
        (earned ? '<div class="badge-date">' + escapeHtml(unlockedOn) + '</div>' : '<div class="badge-locked-note">' + escapeHtml(note) + '</div>') +
        (earned ? '<div class="badge-note" data-badge-note="' + escapeAttr(b.id) + '" hidden>Unlocked on <strong>' + escapeHtml(unlockedOn) + '</strong></div>' : '') +
        '</div>'
      );
    })
    .join('');

  const nodes = host.querySelectorAll('.badge-card.just-unlocked');
  nodes.forEach(function (el) {
    el.addEventListener(
      'animationend',
      function () {
        el.classList.remove('just-unlocked');
      },
      { once: true }
    );
  });
}

export function wireBadges() {
  const host = document.getElementById('badges-grid');
  if (!host) return;
  host.addEventListener('click', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.badge-card') : null;
    if (!card) return;
    if (card.getAttribute('data-earned') !== '1') return;
    const id = card.getAttribute('data-badge-id');
    const note = host.querySelector('[data-badge-note="' + cssEscape(id) + '"]');
    if (!note) return;
    note.hidden = !note.hidden;
  });
}
