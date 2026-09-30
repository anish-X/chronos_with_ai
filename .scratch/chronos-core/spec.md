# Chronos Core Spec

## Problem Statement

I need a distributed job scheduler that guarantees work gets done — handling scheduling, queueing, execution, retries, and observability. Two core motivations:
1. **Learning**: Build a real distributed system (scheduler + queue + workers) to level up from junior to mid-level developer, with a portfolio project that demonstrates systems thinking.
2. **Personal automation**: Run scheduled jobs like YouTube video summarization, newsletter summarization, task triggering, and reminders — reliably, with visibility into what ran and when.

Current alternatives (cron, GitHub Actions, Vercel Cron) are either too simple (no retries/observability), tied to specific platforms, or don't teach the underlying patterns.

## Solution

Chronos: a distributed scheduler with three independent processes — **Scheduler** (produces Jobs from Schedules), **Queue** (PostgreSQL for durability + Redis for low-latency claim), **Workers** (poll, execute Tasks, record Runs). Jobs are delivered **effectively-once** (at-least-once + idempotent Tasks). A **polling dashboard** shows live Job/Run status, logs, and metrics. **Code-first Task registry** with Zod schemas. **Single-user**, accessed via Tailscale Funnel. Deployed to **Fly.io** (free tier).

## User Stories

1. As a **developer**, I want to define a **Schedule** (cron + timezone), so that Jobs are created automatically at the right times.
2. As a **developer**, I want to register a **Task** (TypeScript class with input/output schemas), so that Jobs can reference it by name with typed payloads.
3. As a **developer**, I want the **Scheduler** to enqueue Jobs for due Schedules, so that work is triggered on time.
4. As a **Worker**, I want to claim a **Job** from the **Queue** (Redis first, PostgreSQL fallback), so that I can execute it without duplicates.
5. As a **Worker**, I want to execute the **Task** with the Job's payload, so that the work gets done.
6. As a **Worker**, I want to record a **Run** (started, finished, status, logs, error), so that every attempt is visible.
7. As a **Worker**, I want to retry failed Jobs (exponential backoff, max retries), so that transient failures self-heal.
8. As a **user**, I want to see a **live dashboard** (polling) of Jobs and Runs with status, timing, and logs, so that I know what happened.
9. As a **user**, I want a **CLI** to list history, tail logs, and trigger Jobs manually, so that I can operate without the dashboard.
10. As a **user**, I want to define a **YouTube summary Task** (input: URL, optional prompt; output: summary + tokens), so that I can schedule video summaries.
11. As a **user**, I want to define a **Reminder Task** (input: message, channel), so that I get notified at scheduled times.
12. As a **user**, I want Jobs to be **idempotent** (re-running a YouTube summary is harmless), so that retries don't cause duplicate effects.
13. As a **developer**, I want the **Queue** to survive restarts (PostgreSQL source-of-truth), so that no Jobs are lost.
14. As a **developer**, I want **low-latency Job claim** via Redis (BLMOVE), so that Workers start work quickly.
15. As a **developer**, I want to deploy to **Fly.io free tier** (app + Redis VM + PostgreSQL), so that it costs $0 and doesn't spin down.
16. As a **user**, I want to access the dashboard remotely via **Tailscale Funnel**, so that I don't need to write auth code.

## Implementation Decisions

### Architecture (ADR-0001)
Three independent Node.js processes sharing a PostgreSQL database and Redis instance:
- **scheduler** — polls Schedules, creates due Jobs in PostgreSQL, publishes to Redis
- **worker** — claims Jobs from Redis (BLMOVE) / PostgreSQL (SKIP LOCKED), executes Task, records Run
- **api** — Express server: REST endpoints for dashboard polling, CLI, manual Job trigger, Task/Schedule CRUD

All three can scale horizontally. Scheduler is singleton (leader election via PostgreSQL advisory lock) to avoid duplicate Job creation.

### Queue (ADR-0002)
- **PostgreSQL** = source of truth. Tables: `schedules`, `jobs`, `runs`, `tasks`. Job status: `pending` → `claimed` → `running` → `succeeded` | `failed` | `dead_letter`.
- **Redis** = hot queue. Key: `queue:jobs` (list of Job IDs). Worker: `BLMOVE queue:jobs processing:jobs 0 5` for atomic claim with 5s timeout. On timeout or crash, Job re-appears in `queue:jobs`. Fallback: `SELECT ... FOR UPDATE SKIP LOCKED` on `jobs` where `status = 'pending'`.
- Job payload stored once in PostgreSQL (`jobs.payload` JSONB). Redis only holds Job ID.

### Effectively-Once Delivery (ADR-0003)
- At-least-once: Job can be claimed multiple times (Redis timeout, Worker crash mid-execution).
- Idempotency: Task implementations must be idempotent (natural for summarization, reminders). Job carries `idempotency_key` (hash of Schedule ID + scheduled_time for scheduled Jobs; UUID for manual).
- Run records every attempt. Dashboard shows all Runs for a Job.

### Stack (ADR-0004)
- **Language**: TypeScript (strict), Node.js 20+
- **API**: Express + Zod for validation
- **DB**: PostgreSQL via `pg` + `sqlx`-style query builder (or `kysely` for type-safe queries)
- **Redis**: `ioredis`
- **Dashboard**: React + Vite + React Query (polling 2s) + Tailwind
- **CLI**: `commander` + `chalk`
- **Deployment**: Fly.io (`fly.toml` with 3 processes: api, scheduler, worker)
- **Task Registry**: `TaskRegistry` class, `registerTask(new SummarizeVideoTask())` at startup. Each Task: `name`, `inputSchema` (Zod), `outputSchema` (Zod), `execute(input)`.
- **Config**: `.env` (DATABASE_URL, REDIS_URL, PORT, TAILSCALE_FUNNEL_HOSTNAME)

### Auth (ADR-0005)
- No auth in v1. Single-user.
- Remote access: `tailscale funnel 3000` → `https://<machine>.ts.net`
- Fly.io: `flyctl ssh console` for DB/Redis access.

### Database Schema
```sql
-- schedules
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  task_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id),
  task_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending','claimed','running','succeeded','failed','dead_letter')),
  priority INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_jobs_status ON jobs(status) WHERE status IN ('pending','claimed');
CREATE INDEX idx_jobs_next_retry ON jobs(next_retry_at) WHERE status = 'pending';

-- runs
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  logs TEXT,
  error TEXT,
  output JSONB
);
CREATE INDEX idx_runs_job ON runs(job_id);

-- tasks (registered in code, but stored for dashboard metadata)
CREATE TABLE tasks (
  name TEXT PRIMARY KEY,
  description TEXT,
  input_schema JSONB NOT NULL,
  output_schema JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/jobs | List Jobs (filter: status, task_name, date range) |
| GET | /api/jobs/:id | Job detail + Runs |
| POST | /api/jobs | Create manual Job (body: task_name, payload) |
| GET | /api/schedules | List Schedules |
| POST | /api/schedules | Create Schedule |
| PATCH | /api/schedules/:id | Update Schedule |
| DELETE | /api/schedules/:id | Delete Schedule |
| GET | /api/tasks | List registered Tasks (from registry) |
| GET | /api/metrics | Queue depth, Job throughput, error rate, worker count |
| GET | /api/health | Liveness/readiness |

### CLI Commands
```
chronos job list [--status=pending] [--task=summarize_video]
chronos job show <id>
chronos job trigger <task_name> --payload='{"url":"..."}'
chronos schedule list
chronos schedule create --name="daily-summary" --cron="0 8 * * *" --task=summarize_video --payload='{"url":"..."}'
chronos run logs <job_id>
chronos metrics
```

### YouTube Summary Task (First Real Task)
```typescript
class SummarizeVideoTask implements Task {
  name = 'summarize_video';
  inputSchema = z.object({ url: z.string().url(), prompt: z.string().optional() });
  outputSchema = z.object({ summary: z.string(), tokensUsed: z.number() });
  
  constructor(private llm: LLMClient, private transcript: TranscriptFetcher) {}
  
  async execute(input: Input): Promise<Output> {
    const transcript = await this.transcript.fetch(input.url);
    const summary = await this.llm.summarize(transcript, input.prompt);
    return { summary, tokensUsed: summary.tokens };
  }
}
```
Uses `youtube-transcript` npm for transcript, OpenAI/Anthropic SDK for LLM.

### Reminder Task
```typescript
class ReminderTask implements Task {
  name = 'reminder';
  inputSchema = z.object({ message: z.string(), channel: z.enum(['console','webhook']).default('console') });
  outputSchema = z.object({ sent: z.boolean() });
  
  async execute(input): Promise<Output> {
    if (input.channel === 'console') console.log(`🔔 ${input.message}`);
    else await fetch(input.webhookUrl, { method: 'POST', body: JSON.stringify({ text: input.message }) });
    return { sent: true };
  }
}
```

## Testing Decisions

- **Unit tests**: Task `execute()` methods (pure logic, mock external deps). Registry lookup. Schedule → Job conversion.
- **Integration tests**: Worker claim → execute → record Run (testcontainers for PostgreSQL + Redis). Scheduler enqueues due Jobs. Retry/backoff behavior. Idempotency key prevents duplicate Jobs.
- **Contract tests**: API endpoints (supertest) return expected shapes.
- **E2E test**: Full flow — create Schedule → wait for Job → Worker completes → dashboard shows success.
- **No implementation-detail tests**: Don't test private methods, SQL queries directly, or internal state. Test via public API/CLI.
- **Test pyramid**: Many unit, some integration, few E2E. Run in CI on every push.

## Out of Scope

- Multi-user / authentication / authorization
- Workflow/DAG of Jobs (Job dependencies)
- Distributed tracing (OpenTelemetry) — structured logs suffice for v1
- WebSocket/SSE live updates — polling only
- Redis Cluster / PostgreSQL HA — single instance each on Fly.io free tier
- Task versioning / schema migration
- Dynamic Task loading (all Tasks registered at startup)
- Priority queue beyond `priority` column
- Dead letter queue UI (API exists, UI later)
- Mobile app / native notifications
- Plugin system for Tasks

## Further Notes

- **Tracer bullet**: First milestone = Scheduler + Worker + API + Reminder Task working end-to-end. Then YouTube Summary Task. Then Dashboard.
- **Observability from day one**: Every Job creates Runs. Structured JSON logs (pino). Metrics endpoint for Prometheus/Grafana later.
- **Fly.io deployment**: `fly.toml` defines 3 processes. `fly deploy` builds Docker image, runs migrations, starts all three.
- **Local dev**: `docker-compose.yml` with PostgreSQL + Redis. `npm run dev` starts all three processes via `concurrently`.
- **Migrations**: `node-pg-migrate` or `kysely` migration runner. Run on deploy and `npm run migrate`.