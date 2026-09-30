# 07: CLI

**What to build:** `chronos` CLI (`packages/cli`) using Commander + Chalk. Talks to API server for all operations. Works locally and against remote (Tailscale) URL.

**Blocked by:** 03-api-server

**Status:** ready-for-agent

- [ ] `chronos job list [--status=pending|running|succeeded|failed] [--task=<name>] [--limit=20]`
- [ ] `chronos job show <id>` — shows Job + nested Runs with logs/error/output
- [ ] `chronos job trigger <task_name> --payload='{"key":"value"}'` → POST `/api/jobs`
- [ ] `chronos schedule list`
- [ ] `chronos schedule create --name=<name> --cron="0 8 * * *" --task=<task> --payload='{}' [--timezone=UTC] [--start-at=ISO] [--end-at=ISO]`
- [ ] `chronos schedule update <id> [--cron=...] [--enabled=true/false] [--payload=...]`
- [ ] `chronos schedule delete <id>`
- [ ] `chronos run logs <job_id>` — tails Run logs (if running) or shows full logs
- [ ] `chronos metrics` — pretty-prints `/api/metrics`
- [ ] `--api-url` flag (default `http://localhost:3000`), reads from `CHRONOS_API_URL` env
- [ ] JSON output flag (`--json`) for scripting
- [ ] Integration test: CLI commands against running API server