/** UI mode for Monthly Budget Breakdown (read-only vs inline edit). */

let editing = false;

export function getBudgetBreakdownEditMode(): boolean {
  return editing;
}

export function setBudgetBreakdownEditMode(value: boolean): void {
  editing = !!value;
}
