# CrisisDesk Demo Script

## Setup

1. Set `GEMINI_API_KEY` in your environment (see `.env.example`).
2. `npm install && npm run dev`, open http://localhost:3000.
3. If you're on Chrome 149+/Edge 150+ with the WebMCP origin trial enabled, or
   ChatGPT Desktop's in-app browser, the top-right badge reads **"WebMCP:
   Native"**. Otherwise it reads **"WebMCP: Local Fallback"** — the demo works
   identically either way; only the badge changes, honestly.

## Primary scenario — INC-1042

> "Most incident-response tools are designed for humans. CrisisDesk is
> designed for humans **and** agents."

1. Open the dashboard (`/`). Point out `payment-api` and `checkout-api`
   degraded, and INC-1042 at 18.7% error rate.
2. Open `/incidents/INC-1042`. Walk through the metrics charts — error rate
   and latency both step-change right at the `payment-api v2.8.1` deployment
   marker in the timeline. This is real, generated data, not a static image.
3. Click **Investigate with Agent**.
4. Narrate the **Agent Activity** feed as it fills in live: `get_incident`,
   `get_service_status`, `get_recent_deployments`, `get_logs`,
   `get_metrics`, `get_dependencies`, `correlate_evidence`,
   `create_root_cause_hypothesis`, `create_remediation_plan`,
   `execute_remediation`. Click one open to show the actual input/output JSON
   — this is the real WebMCP call, not an animation.
5. When the **root cause hypothesis** appears, read the confidence score and
   the bullet-point evidence summary.
6. When the **remediation plan** appears, note the proposed rollback step.
7. The **approval dialog** appears — this is the human-in-the-loop gate. Point
   out that the tool call is genuinely paused (the "awaiting your approval"
   label in the agent panel), not a fake pause.
8. Click **Approve**. Watch:
   - `payment-api` version flips 2.8.1 → 2.8.0
   - error rate and latency charts recover
   - `checkout-api` returns to `HEALTHY`
   - the incident banner shows **Resolved**
9. Close with: "The key isn't that an AI can read our dashboard. CrisisDesk
   gives the agent structured capabilities through WebMCP, so it can
   investigate and act — while a human stays in control of anything that
   changes state."

## Secondary scenarios

Use **Reset Simulation** (top bar or Settings) between runs, then open:

- `/incidents/INC-1041` — Database Connection Saturation (no deployment
  involved; demonstrates the agent doesn't assume "deploy = cause").
- `/incidents/INC-1039` — Search Indexing Delay (MEDIUM severity, a backlog
  problem rather than an outage).
- `/incidents/INC-1037` — Notification API Memory Leak (steadily climbing
  memory + repeated OOM restarts).

These exist specifically so judges can see the agent reasons from whatever
evidence a scenario actually contains, rather than being hardcoded to one
narrative. `execute_remediation` fully simulates `rollback_service` (version
change + recovery) as well as any other named action against a known service
(e.g. `restart_service`, `drain_connection_pool`, `clear_queue_backlog`) —
the human approval gate applies identically either way, and all four
incidents can be taken end to end to **Resolved**.

## If the AI agent can't be demoed live

If there's no network access or no key configured at demo time, `/agent`
still shows the full list of registered tools with descriptions, and
`/incidents/INC-1042` still shows realistic, correlated data end to end. The
Settings page states plainly whether `GEMINI_API_KEY` is configured.

## Resetting between judges

**Reset Simulation** (top bar, or Settings page) restores every incident,
service, and metric to its initial deterministic state. Use it between demo
runs so each judge sees the same starting point.
