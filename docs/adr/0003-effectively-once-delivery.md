# 0003-effectively-once-delivery.md

Jobs are delivered at-least-once. Tasks must be idempotent (natural for summarization, reminders). Job status transitions (pending → claimed → running → succeeded/failed) are transactional in PostgreSQL. Run records capture every attempt for observability.