# 01: Project Foundation

**What to build:** Initialize the monorepo structure with TypeScript, shared config, Docker Compose for local PostgreSQL + Redis, database migration runner, and core domain types (Schedule, Job, Run, Task). A `npm run dev` command starts all infrastructure.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `package.json` with workspaces: `packages/{core,api,worker,scheduler,cli,dashboard}`
- [ ] TypeScript strict config shared across packages
- [ ] `docker-compose.yml` with PostgreSQL 16 + Redis 7
- [ ] Migration runner (`kysely` or `node-pg-migrate`) with initial schema (schedules, jobs, runs, tasks tables from spec)
- [ ] Core domain types in `packages/core/src/types.ts` (Schedule, Job, Run, Task, JobStatus, RunStatus)
- [ ] Zod schemas for all domain types in `packages/core/src/schemas.ts`
- [ ] `.env.example` with DATABASE_URL, REDIS_URL, PORT
- [ ] `npm run migrate` runs migrations against local DB
- [ ] `npm run dev` starts PostgreSQL + Redis via docker-compose
- [ ] ESLint + Prettier + Husky pre-commit
- [ ] GitHub Actions CI: typecheck, lint, test on push