# Contributing

Thanks for helping improve this project. These guidelines keep the codebase approachable for contributors and reviewers.

## Principles

- **Readable first:** Prefer clear names (`monthlyTakeHome`, `applyPlanOverrides`) over abbreviations (`mt`, `appl`).
- **Small, focused changes:** One logical change per PR (bugfix, feature, or refactor—not all three).
- **Match existing style:** Same import order, string quoting, and comment density as neighboring files.

## JavaScript

- **ES modules** live under `assets/financial-plan/`. Use `import` / `export`; no bundler is required for local dev.
- **Classic scripts** (`assets/theme-service.ts`, `assets/checkin-service.ts`, `assets/site-settings.ts`, …) attach to `window` and load **before** modules that depend on them. If you add a new global, document it in `docs/ARCHITECTURE.md` and load it in HTML **before** the module that uses it.
- **Storage keys** are centralized in `plan-data.js` (`STORAGE_KEY`, `DEMO_MODE_STORAGE_KEY`, …). Avoid duplicating string literals; if you must (e.g. non-module script), add a comment pointing to the canonical key.

## HTML & CSS

- Prefer **semantic elements** (`header`, `nav`, `section`, `dialog`) and keep **IDs stable** when JS depends on them (`#checkin-list`, `#btn-site-settings`, …).
- Shared layout tokens live in `assets/financial-plan.css`. Avoid inline styles except for dynamic values from JS where appropriate.

## Accessibility

- Interactive controls should have **labels** (`aria-label`, `aria-labelledby`, or visible text).
- Theme and settings controls use **`aria-expanded` / `aria-controls`** where applicable.

## What to avoid

- Large **backup copies** of HTML in the repo (`*.backup-*.html`)—use git history instead.
- **Drive-by refactors** unrelated to your issue (rename sweeps across unrelated files).

## Pull requests

1. Describe **what** changed and **why** (user-facing behavior or bug).
2. If you touched persistence or keys, say so explicitly.
3. For UI changes, a short note on how you tested (browser, viewport) is enough.

## Local development

```bash
python3 -m http.server 8080
# open http://localhost:8080/financial-plan-v3-aggressive.html
```

ES modules will not load from `file://` in most browsers.
