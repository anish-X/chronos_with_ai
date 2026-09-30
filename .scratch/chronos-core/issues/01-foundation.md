# 01: Project Foundation

**What to build:** Initialize the monorepo structure with TypeScript, shared config, Docker Compose for local PostgreSQL + Redis, database migration runner, and core domain types (Schedule, Job, Run, Task). A `npm run dev` command starts all infrastructure.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] `package.json` with workspaces: `packages/{core,api,worker,scheduler,cli,dashboard}`
- [x] TypeScript strict config shared across packages
- [x] `docker-compose.yml` with PostgreSQL 16 + Redis 7
- [x] Migration runner (`kysely`) with initial schema (schedules, jobs, runs, tasks tables from spec)
- [x] Core domain types in `packages/core/src/types.ts` (Schedule, Job, Run, Task, JobStatus, RunStatus)
- [x] Zod schemas for all domain types in `packages/core/src/schemas.ts`
- [x] `.env.example` with DATABASE_URL, REDIS_URL, PORT
- [x] `npm run migrate` runs migrations against local DB
- [x] `npm run dev` starts PostgreSQL + Redis via docker-compose
- [x] ESLint + Prettier + Husky pre-commit
- [x] GitHub Actions CI: typecheck, lint, test on push