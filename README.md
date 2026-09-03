# CrisisDesk

**Give the agent a problem, not a prompt.**

CrisisDesk is an agent-native incident-response platform: a simulated SRE
environment where an AI agent investigates operational incidents, gathers
structured evidence, forms a root-cause hypothesis, proposes a remediation
plan, and — with explicit human approval — executes it. Built for the
[OpenAI WebMCP Challenge](https://webmcp.devpost.com/).

**Live demo:** [crisisdesk-webmcp.vercel.app](https://crisisdesk-webmcp.vercel.app)

## 1. What is CrisisDesk?

A payment API is degrading in production. Instead of manually checking five
dashboards, an engineer opens CrisisDesk and asks the agent to investigate.
The agent doesn't get a wall of text — it gets **tools**: `get_incident`,
`get_metrics`, `get_logs`, `get_recent_deployments`, and so on, each a real,
schema-defined capability the browser exposes. It calls them, correlates what
it finds, and proposes a fix. A human approves before anything changes.

## 2. Why WebMCP?

Most "AI + app" demos bolt a chatbot onto an existing UI and hardcode what it
can say. CrisisDesk is built the other way around: every capability the agent
uses is a real, independently-discoverable [WebMCP](https://github.com/webmachinelearning/webmcp)
tool, registered via `document.modelContext.registerTool`. A native
WebMCP-capable browser or agent (Chrome 149+, ChatGPT Desktop) could discover
and call CrisisDesk's tools with zero CrisisDesk-specific code — which is the
actual test of whether an app is "agent-native" or just agent-decorated.

## 3. How WebMCP works in CrisisDesk

- **10 tools**, each with a name, description, and JSON-Schema input, defined
  once in `lib/webmcp/toolDefinitions.ts` and registered for real in
  `lib/webmcp/register.tsx`.
- **Investigation tools** (`get_incident`, `get_service_status`,
  `get_metrics`, `get_logs`, `get_recent_deployments`, `get_dependencies`) are
  read-only (`annotations.readOnlyHint: true`).
- **Analysis tools** (`correlate_evidence`, `create_root_cause_hypothesis`,
  `create_remediation_plan`) record the agent's findings into the incident.
- **`execute_remediation`** is the one high-impact tool. It always pauses —
  inside its real `execute()` function, via an `await`ed Promise — for a
  human to click Approve or Cancel in the UI before any state changes.
- CrisisDesk's own "Investigate with Agent" button uses Gemini to decide
  *which* tool to call next, but the call itself always goes through
  `document.modelContext.executeTool(...)` — the same dispatch path a fully
  independent WebMCP agent would use. See **`docs/webmcp-research.md`** for
  the full spec research and design rationale, including how the app behaves
  when the browser doesn't support WebMCP natively (a clearly-labeled local
  polyfill, never presented as the real thing).

## 4. Architecture

See **`docs/architecture.md`** for the full diagram. In short:

```
Human ⇄ CrisisDesk UI ⇄ Simulation/data layer ⇄ WebMCP tools ⇄ AI Agent (Gemini)
```

## 5. Tech stack

- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind CSS v4 + shadcn/ui
- Recharts for metrics
- Google Gemini API (`@google/genai`) for agent reasoning, via a clean
  provider-agnostic abstraction under `lib/ai/`
- In-browser deterministic simulation state (`lib/data/`) — no database
  required for the hackathon build; swapping in Postgres/Supabase later only
  touches `lib/data/repository.ts`
- Vitest for the data/tool-layer test suite
- Deploys to Netlify

## 6. Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 7. Environment variables

See `.env.example`. Only `GEMINI_API_KEY` is required for the AI agent;
everything else in the app (dashboard, incidents, services, WebMCP tool
registration) works without it.

## 8. Running locally

```bash
npm run dev      # http://localhost:3000
npm run build    # production build + typecheck
npm run test     # Vitest suite
npm run lint     # ESLint
```

## 9. Demo scenario

See **`docs/demo.md`** for the full script. Short version: open
`/incidents/INC-1042`, click **Investigate with Agent**, watch the real tool
calls run, approve the proposed rollback, watch the metrics recover and the
incident resolve. **Reset Simulation** (top bar) restores the starting state
for the next run. Three more scenarios (`INC-1041`, `INC-1039`, `INC-1037`)
exist so the agent isn't just pattern-matching one hardcoded story.

## 10. Testing

`npm run test` runs the Vitest suite: the data/repository layer, every
WebMCP tool executor (including the human-approval-gated
`execute_remediation`, both approved and declined paths), and a contract test
for the local WebMCP polyfill. See `docs/development.md`.

## 11. Deployment

Live at **[crisisdesk-webmcp.vercel.app](https://crisisdesk-webmcp.vercel.app)**,
deployed on Vercel (zero-config for Next.js). `GEMINI_API_KEY` and
`GEMINI_MODEL` are set as encrypted production environment variables.

The app is also deployable to Netlify — `netlify.toml` pins
`@netlify/plugin-nextjs` — but Netlify's local-build CLI path
(`netlify deploy --build`) currently fails on Windows with "Failed publishing
static content", a reproducible upstream issue tied to the account lacking
`SeCreateSymbolicLinkPrivilege` (Windows Developer Mode off). Deploying via a
Netlify-linked GitHub repo (server-side Linux build) avoids this; per the
hackathon rules, any host is acceptable (ChatGPT Sites, Cloudflare, Vercel,
Render, Netlify, or otherwise), so this build ships on Vercel instead.

## 12. Limitations

- WebMCP's native browser support is still an origin trial (Chrome 149+,
  Edge 150+) or limited to ChatGPT Desktop's in-app browser as of this
  writing — most visitors will see the local polyfill badge, which is always
  labeled honestly rather than presented as native. See
  `docs/webmcp-research.md` §3–4.
- The spec's experimental `requestUserInteraction()` isn't implemented
  anywhere yet, so human approval is implemented as a blocking Promise inside
  the tool's own `execute()` instead — see `docs/webmcp-research.md` §5.
- All infrastructure is simulated. No real Kubernetes, cloud provider, or
  database is ever touched — see `docs/security.md`.
- `execute_remediation` supports `rollback_service` (with a real version
  change) and a generic recovery path for any other named action against a
  known service; it does not model arbitrary infrastructure operations.

## 13. Future vision

Real WebMCP support keeps shipping (Edge, Firefox, Safari are all in some
stage of adoption). As that lands, CrisisDesk's tool layer needs zero changes
— the same `document.modelContext.registerTool` calls that work with the
local polyfill today start working with any compliant browser or agent
tomorrow. The natural next step is a real datastore behind
`lib/data/repository.ts` (Postgres/Supabase, per the abstraction already in
place) and a few more analysis tools (`assign_incident`, `verify_recovery`)
once the core loop has been validated against real incidents.

## License

MIT — see `LICENSE`.
