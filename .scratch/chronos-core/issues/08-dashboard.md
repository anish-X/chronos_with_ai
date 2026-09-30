# 08: Dashboard

**What to build:** React + Vite + Tailwind dashboard (`packages/dashboard`) polling API every 2s via React Query. Shows Jobs, Schedules, Runs, Metrics. Single-page app served by API in production.

**Blocked by:** 03-api-server

**Status:** ready-for-agent

- [ ] Vite + React 18 + TypeScript + Tailwind + React Query
- [ ] `Jobs` page: paginated table (ID, Task, Status, Created, Started, Finished, Actions)
  - Status badge with color (pending=gray, claimed=blue, running=yellow, succeeded=green, failed=red, dead_letter=dark)
  - Click row → drawer with Job detail + Runs list
- [ ] `Run` drawer: shows logs, error, output JSON, timing
- [ ] `Schedules` page: list with enable/disable toggle, edit (modal), delete, create new
- [ ] `Metrics` page: cards (queue depth, throughput/min, error rate, active workers) + mini charts (Recharts)
- [ ] `Tasks` page: lists registered Tasks with input/output schemas (from `/api/tasks`)
- [ ] Polling: React Query `refetchInterval: 2000` for Jobs/Schedules/Metrics
- [ ] Responsive: works on mobile (Tailscale Funnel access)
- [ ] Build: `npm run build` outputs to `packages/api/public` (served by Express static)
- [ ] E2E test: Create Schedule via UI → Job appears → Worker completes → UI shows success