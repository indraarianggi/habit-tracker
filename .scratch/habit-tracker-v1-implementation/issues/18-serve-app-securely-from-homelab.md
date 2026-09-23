# 18: Serve the app securely from the homelab

**What to build:** The operator can run the same private multi-User app on one homelab node through the existing tunnel, with safe client-IP handling, abuse limits, and migrations before traffic.

**Blocked by:** 02: Sign in and open a private Today view; 03: Create a Task locally and sync it.

**Status:** ready-for-agent

- [ ] A single-node container stack runs the app and reverse proxy on an isolated network; only the existing tunnel reaches the proxy, and application/database ports are not exposed publicly. Off-site replication is added by ticket 19.
- [ ] The proxy trusts client-IP headers only from the tunnel process, and the app trusts them only from the proxy; direct or forged forwarded headers cannot bypass per-IP limits.
- [ ] In-memory per-IP and per-User limits protect public sign-in and authenticated routes, with stricter sign-in thresholds and looser sync thresholds; violations return a useful retry response without leaking User data.
- [ ] The SQLite single-writer database uses WAL mode and schema migrations finish before the app accepts traffic; a fresh start and repeat start both retain valid User data.
- [ ] A container/proxy smoke check exercises a signed-in request, rejected spoofed address, rate limits, and start-up migration ordering.
