/**
 * Shared post-persist / post-mutation render policy.
 *
 * Goal 2 (debts) and Goal 3 (savings) both persist then refresh the dashboard.
 * Keep that decision in one place so Save never rebuilds an open editor table
 * (which wipes in-progress Add/edit rows) while still updating derived UI.
 */

import type { PlanPageRenderOptions } from './render-page';
import { getEditingDebtCardId, getEditingSavingsCardId } from './card-inline-edit-state';

export function isNativeDialogOpen(id: string): boolean {
  const dlg = document.getElementById(id) as HTMLDialogElement | null;
  return !!(dlg && typeof dlg.open === 'boolean' && dlg.open);
}

export type PersistRenderPolicy = {
  preserveLedgerActivityDrafts?: boolean;
  refreshGoal2DebtsCards?: boolean;
  refreshGoal3SavingsCards?: boolean;
  /**
   * Rebuild open Goal 2 / Goal 3 editor tables from PLAN.
   * Default false: keep live DOM so typing/Add during an in-flight save is not wiped.
   * Pass true after ledger Add, where the table must show the committed history row.
   */
  rebuildOpenEditors?: boolean;
  /** Rebuild the savings-targets table (Edit Goals). Default false after persist. */
  refreshGoalsTargetEditor?: boolean;
};

/**
 * Options for `render()` after a persist. Dashboard cards and status strip update;
 * open editor dialogs and the goals table stay intact unless explicitly rebuilt.
 */
export function persistRenderOptions(policy: PersistRenderPolicy = {}): PlanPageRenderOptions {
  const rebuild = policy.rebuildOpenEditors === true;
  const g2Open = isNativeDialogOpen('goal2-editor-dialog');
  const g3Open = isNativeDialogOpen('goal3-editor-dialog');
  return {
    skipDebtsEditor: g2Open && !rebuild,
    skipSavingsEditor: g3Open && !rebuild,
    skipGoalsTargetEditor: policy.refreshGoalsTargetEditor !== true,
    refreshGoal2DebtsCards: policy.refreshGoal2DebtsCards === true || getEditingDebtCardId() == null,
    refreshGoal3SavingsCards: policy.refreshGoal3SavingsCards === true || getEditingSavingsCardId() == null,
    preserveLedgerActivityDrafts: policy.preserveLedgerActivityDrafts !== false,
  };
}
