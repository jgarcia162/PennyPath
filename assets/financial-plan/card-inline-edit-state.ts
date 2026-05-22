/**
 * Inline edit state for Goal 2 debt cards (`#goal2-debts`) and
 * Goal 3 savings cards (`#goal3-savings`).
 *
 * Only one card per type can be in inline-edit mode at a time. Entering edit
 * mode on a different card (same type) silently clears the previous edit; the
 * dashboard cards never mutate `PLAN` while typing — the inputs hold the
 * draft until Save is clicked, so cancel just clears the editing id and
 * re-renders the card from the unchanged `PLAN`.
 */

let editingDebtId: string | null = null;
let editingSavingsId: string | null = null;

export function getEditingDebtCardId(): string | null {
  return editingDebtId;
}

export function setEditingDebtCardId(id: string | null): void {
  editingDebtId = id == null ? null : String(id);
}

export function getEditingSavingsCardId(): string | null {
  return editingSavingsId;
}

export function setEditingSavingsCardId(id: string | null): void {
  editingSavingsId = id == null ? null : String(id);
}

export function isAnyCardInlineEditing(): boolean {
  return editingDebtId != null || editingSavingsId != null;
}

export function clearAllCardInlineEditing(): void {
  editingDebtId = null;
  editingSavingsId = null;
}
