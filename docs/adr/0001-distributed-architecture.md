# 0001-distributed-architecture.md

Chronos uses a distributed architecture: separate Scheduler, Queue (PostgreSQL + Redis), and Worker processes. This is chosen over embedded/background-thread to learn the pattern, survive restarts, and scale independently.