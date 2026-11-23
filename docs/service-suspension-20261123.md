# Service suspension — 2026-11-23

The owner requested suspension while preserving source, projects, domains and data.

## Restore information

Original HEAD: `256fa898ec5d528e5b9a7d467862024e5c5a1f39`.
Original configuration is retained in `docs/resume-vercel-20261123.json`. Existing application code remains in the repository.
Original production deployment: `dpl_J2cSKWwaxkt7pUA8UXhyNyt7CZUp`.
Original aliases: ainobi.news, www.ainobi.news, pef-monitor.vercel.app, pef-monitor-onejess.vercel.app, pef-monitor-git-main-onejess.vercel.app.

## Prepared suspension release

Commit `bcb133c60e7f8ea7a88fd5d07a8799837ee2241f` allows only maintenance/index.html through @vercel/static, excludes all API functions, removes cron definitions, and returns HTTP 503 for every path. Vercel reported BLOCKED for deployment dpl_47ZsHqGPTGHrFfhfJdgprP63dHob, so this release has NOT replaced the original deployment. An attempted alias assignment was rejected because the new deployment was not READY; no alias was changed by that attempt.

Git-triggered deployments are now disabled for all branches. Automatic domain assignment is disabled. Pause returned success, but earlier verification still reached old content and the news API. A single unpause/pause sequence was then applied to refresh the pause state. Its live result must be verified separately. Do not claim that the static suspension build was deployed successfully.

The pef-monitor Supabase project was already INACTIVE. No database, domain, project or source was deleted. To resume only on owner request: restore the original config, explicitly deploy a verified release, then resume/promote only that release and verify aliases. Retain any subsequent source changes.
