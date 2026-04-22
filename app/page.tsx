export default function HomePage() {
  return (
    <main className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">PennyPath</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          This is the start of the Next.js (App Router) migration. We’re scaffolding the app shell first and will
          incrementally port the existing financial planner pages and logic without removing any features.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Go to Dashboard
          </a>
          <a
            href="/history"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            View History
          </a>
          <a
            href="/real-estate"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Real Estate Plan
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">What’s next</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>Convert the dashboard page route and keep existing planner behavior intact.</li>
          <li>Move `assets/financial-plan/` logic into `lib/` and `components/` in small, safe slices.</li>
          <li>Preserve localStorage persistence and all optional features (AI helpers, badges, history, etc.).</li>
        </ul>
      </section>
    </main>
  );
}

