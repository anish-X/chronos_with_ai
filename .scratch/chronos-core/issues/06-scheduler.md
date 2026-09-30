# 06: Scheduler Process

**What to build:** Scheduler process (`packages/scheduler`) that runs as singleton (PostgreSQL advisory lock), polls Schedules, creates due Jobs with idempotency keys, publishes to queue.

**Blocked by:** 01-foundation, 04-queue-infrastructure

**Status:** ready-for-agent

- [ ] `Scheduler` class: `start()`, `stop()`, `pollInterval` (default 10s)
- [ ] Leader election: `pg_advisory_lock(scheduler_lock_id)` — only lock holder runs poll loop
- [ ] Poll loop:
  - `SELECT * FROM schedules WHERE enabled AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at > now())`
  - For each Schedule, compute next run times since last check (using `cron-parser`)
  - For each due time: create Job with `idempotency_key = hash(schedule_id + scheduled_time)`
  - `INSERT INTO jobs ... ON CONFLICT (idempotency_key) DO NOTHING` — prevents duplicates
  - For each inserted Job: `queue.publishJob(jobId)`
- [ ] Handle Schedule `payload` merge: Job payload = Schedule.payload (merged with any dynamic values)
- [ ] Update Schedule `last_checked_at` after each poll
- [ ] Graceful shutdown: release advisory lock
- [ ] Integration test: Scheduler creates Jobs for due Schedule → Jobs appear in queue → Worker executes
- [ ] Integration test: Two Scheduler processes → only one creates Jobs (advisory lock works)
- [ ] Integration test: Schedule with past due times → creates Jobs for each missed window (catch-up)