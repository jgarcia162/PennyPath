/**
 * Monthly check-in log UI: preview list, expand/collapse older rows, “all entries” dialog.
 *
 * Depends on globals loaded before the Financial Plan module bundle:
 * - `window.CheckInService` (see `assets/checkin-service.js`)
 *
 * DOM ids are defined in `financial-plan-v3-aggressive.html` (`#checkin-list`, `#checkin-log-dialog`, etc.).
 */

import type { CheckInEntry, CheckInServiceApi } from '../../types/index.js';
import { escapeHtml, escapeAttr } from './utils';

/** Number of newest entries always visible in the inline list. */
const CHECKIN_PREVIEW_N = 3;
/** Additional rows revealed when the user expands (max inline = preview + this many). */
const CHECKIN_EXPAND_MORE_N = 10;
/** Must match `.checkin-log__more-wrap` CSS transition; collapse scroll runs after this delay. */
const CHECKIN_EXPAND_TRANSITION_MS = 750;

let checkinLogInlineExpanded = false;

function getCheckInService(): CheckInServiceApi | null {
  const svc = (window as any).CheckInService;
  if (!svc || typeof svc !== 'object') return null;
  if (typeof (svc as any).list !== 'function') return null;
  return svc as CheckInServiceApi;
}

function checkinExpandScrollDelayMs(): number {
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
function applyCheckinExpandDom(expanded: boolean): boolean {
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

function checkInRowHtml(it: { id?: string; date?: string; note?: string }): string {
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

function fillCheckinDialog(items: Array<{ id?: string; date?: string; note?: string }>): void {
  const body = document.getElementById('checkin-log-dialog-body');
  if (!body) return;
  body.innerHTML = items.length
    ? items.map(checkInRowHtml).join('')
    : '<p class="checkin-dialog-empty">No entries.</p>';
}

function wireCheckInDialogOnce(): void {
  const dlg = document.getElementById('checkin-log-dialog') as HTMLDialogElement | null;
  if (!dlg || dlg.dataset.checkinDialogWired === '1') return;
  dlg.dataset.checkinDialogWired = '1';
  dlg.addEventListener('click', function (e) {
    const t = e.target as HTMLElement | null;
    if (t && (t as any).getAttribute && (t as any).getAttribute('data-checkin-dialog-close') !== null) {
      dlg.close();
    }
  });
  const body = document.getElementById('checkin-log-dialog-body');
  if (!body) return;
  body.addEventListener('click', function (e) {
    const delBtn =
      (e.target as any) && (e.target as any).closest
        ? ((e.target as any).closest('button[data-checkin-delete]') as HTMLButtonElement | null)
        : null;
    if (!delBtn) return;
    const id = delBtn.getAttribute('data-checkin-delete');
    if (!id) return;
    const svc = getCheckInService();
    if (svc && svc.remove) {
      svc.remove(id);
      const next = svc.list ? svc.list() : [];
      fillCheckinDialog(next);
      renderCheckIns();
    }
  });
}

/**
 * Check-in rows for badge evaluation (same backing store as the log).
 * @returns {Array<{ id?: string, date?: string, note?: string }>}
 */
export function getCheckinEntriesForBadges(): Array<{ id?: string; date?: string; note?: string }> {
  try {
    const svc = getCheckInService();
    return svc && svc.list ? svc.list() : [];
  } catch (e) {
    return [];
  }
}

export function wireCheckIns(): void {
  const form = document.getElementById('checkin-form');
  if (!form) return;
  const dateEl = document.getElementById('checkin-date') as HTMLInputElement | null;
  const noteEl = document.getElementById('checkin-note') as HTMLTextAreaElement | null;
  const st = document.getElementById('checkin-status');

  if (dateEl && !dateEl.value) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dateEl.value = (yyyy + '-' + mm + '-' + dd) as any;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const svc = getCheckInService();
    if (!svc || !svc.add) return;
    const date = dateEl ? String(dateEl.value || '').trim() : '';
    const note = noteEl ? String(noteEl.value || '').trim() : '';
    if (!date || !note) return;
    const added = svc.add({ date: date as any, note: note });
    if (!added) {
      if (st) st.textContent = 'Turn off sample data in Settings to add check-ins.';
      return;
    }
    if (noteEl) noteEl.value = '';
    if (st) {
      st.textContent = 'Added check-in';
      clearTimeout((wireCheckIns as any)._statusClearTimer);
      (wireCheckIns as any)._statusClearTimer = setTimeout(function () {
        st.textContent = '';
      }, 1600);
    }
    renderCheckIns();
  });

  const listHost = document.getElementById('checkin-list');
  if (listHost) {
    listHost.addEventListener('click', function (e) {
      const t = e.target as HTMLElement | null;
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
        const svc = getCheckInService();
        const items = svc && svc.list ? svc.list() : [];
        fillCheckinDialog(items);
        const dlg = document.getElementById('checkin-log-dialog') as HTMLDialogElement | null;
        if (dlg && typeof dlg.showModal === 'function') {
          dlg.showModal();
          const closeBtn = dlg.querySelector('[data-checkin-dialog-close]') as HTMLElement | null;
          if (closeBtn && closeBtn.focus) closeBtn.focus();
        }
        return;
      }
      const delBtn = t.closest('button[data-checkin-delete]');
      if (!delBtn) return;
      const id = delBtn.getAttribute('data-checkin-delete');
      if (!id) return;
      const svc = getCheckInService();
      if (svc && svc.remove) {
        svc.remove(id);
        renderCheckIns();
      }
    });
  }
  wireCheckInDialogOnce();
}

export function renderCheckIns(): void {
  const host = document.getElementById('checkin-list');
  if (!host) return;
  const svc = getCheckInService();
  const items = svc && svc.list ? svc.list() : [];
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
