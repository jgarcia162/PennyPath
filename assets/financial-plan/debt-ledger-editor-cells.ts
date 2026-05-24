/**
 * Debt editor: unified Activity column (pay, charge, note, single Add).
 */

export function buildDebtLedgerUnifiedCellHtml(): string {
  return (
    '<div class="ledger-unified">' +
    '<div class="ledger-unified__inputs">' +
    '<input type="text" data-field="payment" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="Pay" title="Payment amount">' +
    '<input type="text" data-field="charge" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="Charge" title="Charge amount">' +
    '<input type="text" data-field="charge-memo" class="ledger-memo" maxlength="120" autocomplete="off" placeholder="Note" title="Charge note">' +
    '</div>' +
    '<button type="button" class="btn-icon btn-quick-ledger-entry" data-action="quick-ledger-entry" title="Add payment or charge (charge wins if both filled)" aria-label="Add payment or charge">Add</button>' +
    '</div>'
  );
}

export function appendDebtLedgerHeaderCell(tr: HTMLTableRowElement): void {
  const th = document.createElement('th');
  th.scope = 'col';
  th.textContent = 'Activity';
  th.title = 'Pay or charge amount + optional note, then Add';
  tr.appendChild(th);
}

export function appendDebtLedgerCellToRow(row: HTMLTableRowElement): void {
  const td = document.createElement('td');
  td.className = 'editor-table__cell--ledger-unified';
  td.innerHTML = buildDebtLedgerUnifiedCellHtml();
  row.appendChild(td);
}
