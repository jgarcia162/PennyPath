> **When to use:** Promoting **`develop`** into **`main`** (release / production sync).  
> Choose **release-to-main** in the template dropdown, or add `?template=release-to-main.md` to the compare URL (example: `compare/main...develop?expand=1&template=release-to-main.md`).

# Release: `develop` → `main`

## Summary

<!-- What is landing on main and why now? -->



## Highlights

<!-- Bullet list of user-visible or notable changes since last main promotion. -->

- 
- 

## Verification

<!-- Smoke checks after merge or on staging, if applicable. -->

- [ ] `main` build / deploy succeeds (or N/A for static site).
- [ ] Critical paths spot-checked: <!-- e.g. Financial Plan dashboard, key flows -->
- [ ] No known **breaking changes** for this promotion (or documented below).

## Risk & rollback

<!-- “Low — static content”, or note deploy/DB risks. -->

- **Risk level:** <!-- Low / Medium / High -->
- **Rollback:** <!-- e.g. revert merge commit, redeploy previous main -->

## Breaking changes

<!-- None, or describe and link issues. -->



## Checklist

- [ ] `develop` is up to date and CI is green (or failures understood).
- [ ] This PR is **from `develop` (or a release branch off develop) into `main`**.
- [ ] Stakeholders notified if needed (or N/A).

## Notes

<!-- Deployment window, follow-up issues, or “None”. -->


