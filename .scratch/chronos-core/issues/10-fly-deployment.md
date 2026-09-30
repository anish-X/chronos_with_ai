# 10: Fly.io Deployment

**What to build:** Production deployment to Fly.io free tier. Dockerfile builds all packages, `fly.toml` defines 3 processes (api, scheduler, worker), GitHub Actions CI/CD deploys on merge to main.

**Blocked by:** 01-foundation, 03-api-server, 05-worker, 06-scheduler

**Status:** ready-for-agent

- [ ] `Dockerfile`:
  - Base: `node:20-alpine`
  - Install deps, build all packages (`npm run build`)
  - Prune devDependencies
  - Entry point: `node packages/api/dist/index.js` (or scheduler/worker via CMD)
- [ ] `fly.toml`:
  - `app = "chronos"`
  - `primary_region = "ord"` (or closest)
  - `[processes]`: `api = "node packages/api/dist/index.js"`, `scheduler = "node packages/scheduler/dist/index.js"`, `worker = "node packages/worker/dist/index.js"`
  - `[http_service]`: internal_port = 3000, auto_stop_machines = false, auto_start_machines = true
  - `[mounts]`: none needed (stateless)
- [ ] Fly.io resources:
  - `fly postgres create --name chronos-db --region ord --vm-size shared-cpu-1x --volume-size 3` (free tier)
  - `fly redis create --name chronos-redis --region ord --vm-size shared-cpu-1x` (free tier)
  - `fly secrets set DATABASE_URL=... REDIS_URL=... OPENAI_API_KEY=...`
- [ ] GitHub Actions workflow:
  - On push to main: typecheck, lint, test, build Docker image, `fly deploy`
  - Migration step: `fly ssh console -C "npm run migrate"` before deploy
- [ ] Health checks: `/api/health` for HTTP service, process health for scheduler/worker
- [ ] Verify: `fly logs`, `fly ssh console` to run CLI against production