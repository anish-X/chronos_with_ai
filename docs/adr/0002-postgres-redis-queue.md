# 0002-postgres-redis-queue.md

Queue uses PostgreSQL as source-of-truth (durability, history, dashboard queries) + Redis for hot polling (low-latency claim via BLMOVE/BRPOPLPUSH). Workers claim from Redis; fallback to PostgreSQL SKIP LOCKED if Redis unavailable. This teaches both patterns and provides redundancy.