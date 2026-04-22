(function () {
  'use strict';

  function clamp0(n: unknown): number {
    const v = Number(n);
    return Math.max(0, Number.isFinite(v) ? v : 0);
  }

  function todayYyyyMmDd(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  function debtStats(plan: any): { paidOff: number; remaining: number; original: number; pctEliminated: number } {
    const debts = Array.isArray(plan && plan.debts) ? plan.debts : [];
    const paidOff = debts.reduce(function (sum, d) { return sum + clamp0(d && d.paidOff); }, 0);
    const remaining = debts.reduce(function (sum, d) { return sum + clamp0(d && d.current); }, 0);
    const original = debts.reduce(function (sum, d) { return sum + clamp0((d && d.current) + (d && d.paidOff)); }, 0);
    const pctEliminated = original > 0 ? (paidOff / original) : 0;
    return { paidOff: paidOff, remaining: remaining, original: original, pctEliminated: pctEliminated };
  }

  function checkinCount(checkins: unknown): number {
    const arr = Array.isArray(checkins) ? checkins : [];
    return arr.length;
  }

  function sumTowardGoalHysa(plan: any): number {
    const accs = Array.isArray(plan && plan.savingsAccounts) ? plan.savingsAccounts : [];
    var sum = 0;
    accs.forEach(function (a) {
      if (!a) return;
      var ids = a.goalIds;
      if (Array.isArray(ids) && ids.indexOf('goal-hysa') >= 0) {
        sum += clamp0(a.current);
      } else if ((!ids || !ids.length) && a.countTowardsGoal) {
        sum += clamp0(a.current);
      }
    });
    return sum;
  }

  /**
   * Pure badge evaluation. No IO. No mutation.
   * Returns [{ id, earned, unlockedOn: null }]
   */
  function evaluateBadges(plan: any, checkins: unknown): Array<{ id: string; earned: boolean; unlockedOn: null }> {
    const now = todayYyyyMmDd(); // returned for convenience, but caller controls persistence
    const ds = debtStats(plan || {});
    const hysa = clamp0(plan && plan.hysaBalance);
    const towardHysaGoal = sumTowardGoalHysa(plan);
    const goalHysa = clamp0(plan && plan.goalHysa);
    const hysaStart = clamp0(plan && plan._hysaStartingDefault);
    const nCheckins = checkinCount(checkins);

    const items = [
      // Debt
      { id: 'debt-first-step', earned: ds.paidOff > 0, now: now },
      { id: 'debt-5k', earned: ds.paidOff >= 5000, now: now },
      { id: 'debt-halfway', earned: ds.original > 0 && ds.pctEliminated >= 0.5, now: now },
      { id: 'debt-almost-free', earned: ds.remaining > 0 && ds.remaining < 5000, now: now },
      { id: 'debt-free', earned: ds.remaining <= 0 && ds.original > 0, now: now },

      // Savings
      { id: 'savings-starts', earned: hysa > hysaStart, now: now },
      { id: 'savings-30k', earned: hysa >= 30000, now: now },
      { id: 'savings-40k', earned: hysa >= 40000, now: now },
      { id: 'savings-goal', earned: goalHysa > 0 && towardHysaGoal >= goalHysa, now: now },

      // Consistency
      { id: 'checkins-first', earned: nCheckins >= 1, now: now },
      { id: 'checkins-3', earned: nCheckins >= 3, now: now },
      { id: 'checkins-6', earned: nCheckins >= 6, now: now },
    ];

    return items.map(function (b) {
      return { id: b.id, earned: !!b.earned, unlockedOn: null };
    });
  }

  (window as any).Badges = {
    evaluateBadges: evaluateBadges,
  };
})();

