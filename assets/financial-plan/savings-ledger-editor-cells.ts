/**
 * Savings editor: unified Activity column (deposit, withdrawal, note, single Add).
 */

export function buildSavingsLedgerUnifiedCellHtml(): string {
  return (
    '<div class="ledger-unified">' +
    '<div class="ledger-unified__inputs">' +
    '<input type="text" data-field="deposit" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="Deposit" title="Deposit amount">' +
    '<input type="text" data-field="withdrawal" data-money="currency" inputmode="decimal" autocomplete="off" placeholder="Withdraw" title="Withdrawal amount">' +
    '<input type="text" data-field="withdrawal-memo" class="ledger-memo" maxlength="120" autocomplete="off" placeholder="Note" title="Withdrawal note">' +
    '</div>' +
    '<button type="button" class="btn-icon btn-quick-savings-ledger-entry" data-action="quick-savings-ledger-entry" title="Add deposit or withdrawal (withdrawal wins if both filled)" aria-label="Add deposit or withdrawal">Add</button>' +
    '</div>'
  );
}

export function appendSavingsLedgerHeaderCell(tr: HTMLTableRowElement): void {
  const th = document.createElement('th');
  th.scope = 'col';
  th.textContent = 'Activity';
  th.title = 'Deposit or withdrawal amount + optional note, then Add';
  tr.appendChild(th);
}

export function appendSavingsLedgerCellToRow(row: HTMLTableRowElement): void {
  const td = document.createElement('td');
  td.className = 'editor-table__cell--ledger-unified';
  td.innerHTML = buildSavingsLedgerUnifiedCellHtml();
  row.appendChild(td);
}
