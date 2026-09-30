# 04: Queue Infrastructure

**What to build:** Shared queue client (`packages/core/src/queue.ts`) implementing Redis-first claim with PostgreSQL fallback. Atomic Job claim via `BLMOVE` with timeout, re-queue on timeout/crash. `SKIP LOCKED` fallback when Redis unavailable.

**Blocked by:** 01-foundation

**Status:** ready-for-agent

- [ ] `QueueClient` class with `claimJob(workerId): Promise<Job | null>`
  - Redis: `BLMOVE queue:jobs processing:jobs:{workerId} 0 5` (5s timeout)
  - On claim: update PostgreSQL `jobs` set `status='claimed'`, `claimed_at=now()`, `worker_id=workerId`
  - On Redis failure: fallback to `SELECT ... FOR UPDATE SKIP LOCKED` on `jobs` where `status='pending'` ORDER BY `priority DESC, created_at ASC` LIMIT 1
- [ ] `requeueStaleJobs()` — moves `processing:jobs:{workerId}` back to `queue:jobs` + resets PG status to `pending` (called on worker startup + periodic)
- [ ] `publishJob(jobId)` — LPUSH `queue:jobs` (called by Scheduler after creating Job)
- [ ] `completeJob(jobId, status, output?)` — updates PG, removes from Redis processing list
- [ ] `scheduleRetry(jobId, backoffMs)` — sets `next_retry_at`, `status='pending'`, re-publishes to Redis
- [ ] Unit tests: claim/requeue/complete/retry with mocked Redis + testcontainers PG
- [ ] Integration test: concurrent workers claim distinct jobs, crashed worker's job re-queued