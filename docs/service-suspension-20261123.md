# Service suspension — 2026-11-23

The owner requested suspension while preserving all source and data.

Original HEAD: `256fa898ec5d528e5b9a7d467862024e5c5a1f39`. Restore `vercel.json` from this commit or `docs/resume-vercel-20261123.json` only when the owner requests resumption. All application files remain in this repository.

The suspension release uses an explicit static-only build allowlist for `maintenance/index.html`. Existing API files are not included in the deployment. All paths return HTTP 503; cron definitions are empty. After the suspension release, Git deployments will be disabled.

Vercel Pause returned success but the ainobi.news alias still returned the former application in a later check, so deployment and alias verification are required. Database project pef-monitor was already INACTIVE; no database or project was deleted. Historical deployments must be reviewed separately because this source change only affects the new deployment.
