# Verified suspension — 2026-11-23

After a single unpause/pause cycle, both https://ainobi.news/ and https://ainobi.news/api/news returned HTTP 503 with DEPLOYMENT_PAUSED. The Vercel project remains paused.

The static maintenance release `bcb133c60e7f8ea7a88fd5d07a8799837ee2241f` was BLOCKED, not deployed. All Git-triggered deployments are disabled in vercel.json. The original source is retained; original config is in docs/resume-vercel-20261123.json. Restore only on owner request, preserving later work. See docs/service-suspension-20261123.md for the original deployment and alias mapping. No domain, database, repository or project was deleted.
