# 05: Worker Process

**What to build:** Worker process (`packages/worker`) that polls queue, claims Jobs, executes Tasks via Registry, records Runs, handles retries with exponential backoff. Runs as standalone Node process.

**Blocked by:** 01-foundation, 02-task-registry-reminder, 04-queue-infrastructure

**Status:** ready-for-agent

- [ ] `Worker` class: `start()`, `stop()`, `pollInterval` (configurable, default 1s)
- [ ] Poll loop: `queue.claimJob()` → if Job, `executeJob(job)`
- [ ] `executeJob(job)`:
  - Create `Run` record: `status='running', started_at=now()`
  - Update Job: `status='running', started_at=now()`
  - Lookup Task from Registry by `job.task_name`
  - Validate `job.payload` against Task `inputSchema`
  - Call `task.execute(payload)` with timeout (configurable, default 5min)
  - On success: `Run.status='succeeded', finished_at=now(), output=result`; `Job.status='succeeded', finished_at=now()`
  - On failure: `Run.status='failed', finished_at=now(), error=message`; if `retry_count < max_retries` → `scheduleRetry(jobId, 2^retry_count * 1000)` else `Job.status='failed'` (or `dead_letter` if no retries left)
  - Always: `queue.completeJob(jobId, finalStatus)`
- [ ] Graceful shutdown: finish current Job, stop polling, release Redis processing slot
- [ ] Structured logs: Job ID, Task name, Run ID, duration, status
- [ ] Integration test: Worker claims Job → executes ReminderTask → records Run → Job succeeds
- [ ] Integration test: Task throws → Worker retries with backoff → eventually succeeds/fails
- [ ] Integration test: Worker killed mid-execution → Job re-queued → picked up by another Worker