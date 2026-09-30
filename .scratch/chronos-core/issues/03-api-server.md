# 03: API Server

**What to build:** Express server (`packages/api`) with REST endpoints for Schedules, Jobs, Tasks, Metrics, Health. Uses shared core types. Polling-friendly JSON responses.

**Blocked by:** 01-foundation

**Status:** ready-for-agent

- [ ] Express app with Zod request validation middleware
- [ ] `GET /api/health` → `{ status: 'ok', timestamp }`
- [ ] `GET /api/tasks` → list from `TaskRegistry` (name, description, inputSchema, outputSchema)
- [ ] `GET /api/schedules` → paginated list with filters (enabled, task_name)
- [ ] `POST /api/schedules` → create Schedule (validates cron_expr, task_name exists in registry)
- [ ] `PATCH /api/schedules/:id` → update Schedule
- [ ] `DELETE /api/schedules/:id` → delete Schedule
- [ ] `GET /api/jobs` → paginated list with filters (status, task_name, date range)
- [ ] `GET /api/jobs/:id` → Job detail + nested Runs
- [ ] `POST /api/jobs` → create manual Job (generates idempotency_key, validates task_name)
- [ ] `GET /api/metrics` → queue depth (pending/claimed), throughput (jobs/min), error rate, worker count (from Redis)
- [ ] Structured JSON logging (pino)
- [ ] Integration tests with supertest against testcontainers PostgreSQL + Redis