# 12: E2E Tests + Observability Polish

**What to build:** Full end-to-end test covering Schedule → Job → Worker → Run → Dashboard. Structured logs, metrics endpoint, error tracking. Polish: retries visible in UI, dead letter handling, graceful degradation.

**Blocked by:** 03-api-server, 04-queue-infrastructure, 05-worker, 06-scheduler, 08-dashboard

**Status:** ready-for-agent

- [ ] E2E test (Playwright or Vitest + supertest):
  - Create Schedule via API (ReminderTask, cron `* * * * *`)
  - Wait for Job creation (poll `/api/jobs`)
  - Wait for Worker to complete (poll Job status → succeeded)
  - Verify Run recorded with output `{ sent: true }`
  - Verify Dashboard shows Job + Run
- [ ] Structured logging (pino):
  - Every log includes `jobId`, `runId`, `taskName`, `workerId`
  - Log levels: debug (poll), info (claim/start/complete), error (fail/retry)
  - Pretty in dev, JSON in prod
- [ ] Metrics endpoint (`/api/metrics`):
  - `queue_depth_pending`, `queue_depth_claimed`
  - `jobs_created_total`, `jobs_succeeded_total`, `jobs_failed_total`
  - `job_duration_seconds` histogram (buckets: 0.1, 0.5, 1, 5, 10, 30, 60)
  - `worker_count` (from Redis `processing:jobs:*` keys)
- [ ] Dead letter visibility: `dead_letter` Jobs appear in Dashboard with "Retry" button (POST `/api/jobs/:id/retry` — new endpoint)
- [ ] Graceful degradation: Worker continues if Redis down (PG fallback), Scheduler continues if Redis down (still creates Jobs in PG)
- [ ] CI: E2E test runs on every PR (testcontainers for PG + Redis)