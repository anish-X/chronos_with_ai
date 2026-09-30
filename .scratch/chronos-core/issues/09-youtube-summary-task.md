# 09: YouTube Summary Task

**What to build:** `SummarizeVideoTask` in `packages/worker/src/tasks/summarize-video.ts`. Fetches transcript via `youtube-transcript`, summarizes via LLM API (OpenAI/Anthropic), returns summary + token count.

**Blocked by:** 02-task-registry-reminder, 05-worker

**Status:** ready-for-agent

- [ ] `SummarizeVideoTask`:
  - Input: `{ url: string, prompt?: string, model?: 'gpt-4o-mini' | 'claude-3-haiku' }`
  - Output: `{ summary: string, tokensUsed: number, model: string }`
  - Transcript fetch: `youtube-transcript` npm (handles video ID extraction from URL)
  - LLM client: abstracted `LLMClient` interface (OpenAI + Anthropic implementations)
  - Prompt template: system + user prompt with transcript injected
  - Token counting from LLM response
- [ ] Config: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`
- [ ] Unit test: mock transcript fetcher + LLM client → verify summary output shape
- [ ] Integration test: Worker executes SummarizeVideoTask end-to-end (with real API key in CI secret)
- [ ] Idempotency: same URL + prompt → same idempotency_key → no duplicate summary generation
- [ ] Error handling: transcript unavailable → Run fails with clear error; LLM rate limit → retry with backoff