# 11: Tailscale Funnel Setup

**What to build:** Documentation and scripts to expose local/production dashboard via Tailscale Funnel for remote single-user access. Zero auth code.

**Blocked by:** 03-api-server

**Status:** ready-for-agent

- [ ] `docs/TAILSCALE.md`: step-by-step setup
  - Install Tailscale on dev machine + server (Fly.io: `fly ssh console` → install)
  - `tailscale up` on both
  - `tailscale funnel 3000` (local) or `tailscale funnel --bg 3000` (production via Fly SSH)
  - Access at `https://<machine>.ts.net`
- [ ] `scripts/tailscale-funnel.sh`: starts funnel in background, prints URL
- [ ] Fly.io: add `tailscale` to Dockerfile, `fly secrets set TAILSCALE_AUTH_KEY=...` (ephemeral key)
- [ ] Verify: access dashboard from phone/laptop via `https://<machine>.ts.net`
- [ ] Note: Funnel uses HTTPS automatically, no cert management needed