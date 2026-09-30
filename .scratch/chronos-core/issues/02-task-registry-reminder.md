# 02: Task Registry + Reminder Task

**What to build:** Code-first `TaskRegistry` with Zod-validated input/output, and the `ReminderTask` (console + webhook) as the first working Task. Registry loads at startup, exposes `getTask(name)` and `listTasks()`.

**Blocked by:** 01-foundation

**Status:** ready-for-agent

- [ ] `Task` interface in `packages/core`: `name`, `inputSchema`, `outputSchema`, `execute(input)`
- [ ] `TaskRegistry` class: `register(task)`, `get(name)`, `list()`
- [ ] `ReminderTask` in `packages/worker/src/tasks/reminder.ts`:
  - Input: `{ message: string, channel: 'console' | 'webhook', webhookUrl?: string }`
  - Output: `{ sent: boolean }`
  - Console channel logs `🔔 {message}`
  - Webhook channel POSTs JSON to `webhookUrl`
- [ ] Unit tests: `ReminderTask.execute()` with mocked fetch, registry lookup, Zod validation rejects invalid input
- [ ] Registry exports all registered tasks for API `/api/tasks` endpoint