# Chronos

A distributed job scheduler with guaranteed execution, retries, and observability.

## Language

**Schedule**:
A trigger definition: cron expression, timezone, optional start/end. Produces Jobs.
_Avoid_: Trigger, CronJob, Timer

**Job**:
A single execution instance: payload (JSON), status, retries, result, created_by (Schedule ID or manual). The thing workers execute.
_Avoid_: Task, WorkItem, Execution

**Task**:
A reusable handler: code + input schema + output schema. Jobs reference a Task by name + input. Like a function registry.
_Avoid_: Handler, Action, Function, JobType

**Run**:
An attempt — a Job can have multiple Runs (retries). Each Run has started_at, finished_at, status, logs, error.
_Avoid_: Attempt, Execution, Try

**Worker**:
A process that polls the queue, claims Jobs, executes their Tasks, and records Runs.
_Avoid_: Consumer, Processor, Runner

**Queue**:
The durable backing store for pending Jobs (PostgreSQL + Redis). Provides ordering, priority, and exactly-once claim semantics.
_Avoid_: Broker, MessageBus, Channel