/**
 * Monthly check-in log UI: preview list, expand/collapse older rows, “all entries” dialog.
 *
 * Depends on globals loaded before the Financial Plan module bundle:
 * - `window.CheckInService` (see `assets/checkin-service.js`)
 *
 * DOM ids are defined in `financial-plan-v3-aggressive.html` (`#checkin-list`, `#checkin-log-dialog`, etc.).
 */

import { escapeHtml, escapeAttr } from './utils.js';

/** Number of newest entries always visible in the inline list. */
const CHECKIN_PREVIEW_N = 3;
/** Additional rows revealed when the user expands (max inline = preview + this many). */
const CHECKIN_EXPAND_MORE_N = 10;
/** Must match `.checkin-log__more-wrap` CSS transition; collapse scroll runs after this delay. */
const CHECKIN_EXPAND_TRANSITION_MS = 750;

let checkinLogInlineExpanded = false;

function checkinExpandScrollDelayMs() {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 0;
    }
  } catch (e) {
    /* ignore */
  }
  return CHECKIN_EXPAND_TRANSITION_MS;
}

/**
 * Updates expand state on existing nodes so `grid-template-rows` can animate (no full re-render).
 * @param {boolean} expanded
 * @returns {boolean} false if expected elements are missing
 */
function applyCheckinExpandDom(expanded) {
  const wrap = document.getElementById('checkin-log-more-region');
  const btn = document.getElementById('checkin-log-toggle');
  if (!wrap || !btn) return false;
  if (expanded) {
    wrap.classList.add('is-expanded');
    wrap.setAttribute('aria-hidden', 'false');
    wrap.removeAttribute('inert');
  } else {
    wrap.classList.remove('is-expanded');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.setAttribute('inert', '');
  }
  const moreCount = btn.getAttribute('data-checkin-more-count') || '0';
  btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  btn.textContent = expanded ? 'Show less' : 'Show more (' + moreCount + ' older)';
  return true;
}

function checkInRowHtml(it) {
  const date = String(it.date || '');
  const note = String(it.note || '');
  return (
    '<div class="checkin-item">' +
    '<div>' +
    '<div class="checkin-meta">' +
    escapeHtml(date) +
    '</div>' +
    '<div class="checkin-note">' +
    escapeHtml(note) +
    '</div>' +
    '</div>' +
    '<button type="button" class="checkin-delete no-print" data-checkin-delete="' +
    escapeAttr(it.id) +
    '">Delete</button>' +
    '</div>'
  );
}

function fillCheckinDialog(items) {
  const body = document.getElementById('checkin-log-dialog-body');
  if (!body) return;
  body.innerHTML = items.length
    ? items.map(checkInRowHtml).join('')
    : '<p class="checkin-dialog-empty">No entries.</p>';
}

function wireCheckInDialogOnce() {
  const dlg = document.getElementById('checkin-log-dialog');
  if (!dlg || dlg.dataset.checkinDialogWired === '1') return;
  dlg.dataset.checkinDialogWired = '1';
  dlg.addEventListener('click', function (e) {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('data-checkin-dialog-close') !== null) {
      dlg.close();
    }
  });
  const body = document.getElementById('checkin-log-dialog-body');
  if (!body) return;
  body.addEventListener('click', function (e) {
    const delBtn = e.target && e.target.closest ? e.target.closest('button[data-checkin-delete]') : null;
    if (!delBtn) return;
    const id = delBtn.getAttribute('data-checkin-delete');
    if (!id) return;
    if (window.CheckInService && window.CheckInService.remove) {
      window.CheckInService.remove(id);
      const next = window.CheckInService.list ? window.CheckInService.list() : [];
      fillCheckinDialog(next);
      renderCheckIns();
    }
  });
}

/**
 * Check-in rows for badge evaluation (same backing store as the log).
 * @returns {Array<{ id?: string, date?: string, note?: string }>}
 */
export function getCheckinEntriesForBadges() {
  try {
    return window.CheckInService && window.CheckInService.list ? window.CheckInService.list() : [];
  } catch (e) {
    return [];
  }
}

export function wireCheckIns() {
  const form = document.getElementById('checkin-form');
  if (!form) return;
  const dateEl = document.getElementById('checkin-date');
  const noteEl = document.getElementById('checkin-note');
  const st = document.getElementById('checkin-status');

  if (dateEl && !dateEl.value) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateEl.value = yyyy + '-' + mm + '-' + dd;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!window.CheckInService || !window.CheckInService.add) return;
    const date = dateEl ? String(dateEl.value || '').trim() : '';
    const note = noteEl ? String(noteEl.value || '').trim() : '';
    if (!date || !note) return;
    const added = window.CheckInService.add({ date: date, note: note });
    if (!added) {
      if (st) st.textContent = 'Turn off sample data in Settings to add check-ins.';
      return;
    }
    if (noteEl) noteEl.value = '';
    if (st) {
      st.textContent = 'Added check-in';
      clearTimeout(wireCheckIns._statusClearTimer);
      wireCheckIns._statusClearTimer = setTimeout(function () {
        st.textContent = '';
      }, 1600);
    }
    renderCheckIns();
  });

  const listHost = document.getElementById('checkin-list');
  if (listHost) {
    listHost.addEventListener('click', function (e) {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#checkin-log-toggle')) {
        const wasExpanded = checkinLogInlineExpanded;
        checkinLogInlineExpanded = !checkinLogInlineExpanded;
        if (applyCheckinExpandDom(checkinLogInlineExpanded)) {
          if (wasExpanded && !checkinLogInlineExpanded) {
            setTimeout(function () {
              const toggleBtn = document.getElementById('checkin-log-toggle');
              if (toggleBtn && toggleBtn.scrollIntoView) {
                toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }, checkinExpandScrollDelayMs());
          }
        } else {
          renderCheckIns();
        }
        return;
      }
      if (t.closest('#checkin-open-all')) {
        wireCheckInDialogOnce();
        const items = window.CheckInService && window.CheckInService.list ? window.CheckInService.list() : [];
        fillCheckinDialog(items);
        const dlg = document.getElementById('checkin-log-dialog');
        if (dlg && typeof dlg.showModal === 'function') {
          dlg.showModal();
          const closeBtn = dlg.querySelector('[data-checkin-dialog-close]');
          if (closeBtn && closeBtn.focus) closeBtn.focus();
        }
        return;
      }
      const delBtn = t.closest('button[data-checkin-delete]');
      if (!delBtn) return;
      const id = delBtn.getAttribute('data-checkin-delete');
      if (!id) return;
      if (window.CheckInService && window.CheckInService.remove) {
        window.CheckInService.remove(id);
        renderCheckIns();
      }
    });
  }
  wireCheckInDialogOnce();
}

export function renderCheckIns() {
  const host = document.getElementById('checkin-list');
  if (!host) return;
  const items = window.CheckInService && window.CheckInService.list ? window.CheckInService.list() : [];
  if (!items.length) {
    checkinLogInlineExpanded = false;
    host.innerHTML = '<div class="checkin-log-empty">No check-ins yet.</div>';
    return;
  }
  if (items.length <= CHECKIN_PREVIEW_N) {
    checkinLogInlineExpanded = false;
  }

  const previewItems = items.slice(0, CHECKIN_PREVIEW_N);
  const moreSlice = items.slice(CHECKIN_PREVIEW_N, CHECKIN_PREVIEW_N + CHECKIN_EXPAND_MORE_N);
  const hasMoreThanPreview = items.length > CHECKIN_PREVIEW_N;
  const hasOverflowBeyondInline = items.length > CHECKIN_PREVIEW_N + CHECKIN_EXPAND_MORE_N;
  const moreCount = Math.min(CHECKIN_EXPAND_MORE_N, Math.max(0, items.length - CHECKIN_PREVIEW_N));

  let html = '<div class="checkin-log__inner">';
  if (hasMoreThanPreview) {
    html += '<div class="checkin-log__head">';
    html += '<p class="checkin-log__hint">Showing the ' + String(CHECKIN_PREVIEW_N) + ' most recent</p>';
    html += '<div class="checkin-log__toolbar no-print">';
    const expandLabel = checkinLogInlineExpanded
      ? 'Show less'
      : 'Show more (' + String(moreCount) + ' older)';
    html +=
      '<button type="button" class="checkin-log__toggle" id="checkin-log-toggle" aria-expanded="' +
      (checkinLogInlineExpanded ? 'true' : 'false') +
      '" aria-controls="checkin-log-more-region" data-checkin-more-count="' +
      escapeAttr(String(moreCount)) +
      '">' +
      escapeHtml(expandLabel) +
      '</button>';
    if (hasOverflowBeyondInline) {
      html +=
        '<button type="button" class="checkin-log__show-all" id="checkin-open-all">' +
        'Show all entries (' +
        String(items.length) +
        ')' +
        '</button>';
    }
    html += '</div></div>';
  }

  html += '<div class="checkin-log__preview">';
  html += previewItems.map(checkInRowHtml).join('');
  html += '</div>';

  if (hasMoreThanPreview) {
    html +=
      '<div class="checkin-log__more-wrap' +
      (checkinLogInlineExpanded ? ' is-expanded' : '') +
      '" id="checkin-log-more-region" aria-hidden="' +
      (checkinLogInlineExpanded ? 'false' : 'true') +
      '"' +
      (checkinLogInlineExpanded ? '' : ' inert') +
      '>';
    html += '<div class="checkin-log__more-inner">';
    html += moreSlice.map(checkInRowHtml).join('');
    html += '</div></div>';
  }

  html += '</div>';

  host.innerHTML = html;
}
