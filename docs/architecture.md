# CrisisDesk Architecture

## Layers

```
Browser
  │
  ├── React UI (dashboard, incidents, services, agent, settings)
  │      reads/writes ──────────────┐
  │                                 ▼
  ├── Simulation store (lib/data/store.ts)
  │      in-memory + localStorage, the single source of truth for
  │      incidents, services, deployments, logs, metrics
  │                                 ▲
  │                                 │ read/mutate
  ├── WebMCP tool executors (lib/webmcp/toolExecutors.ts)
  │      the only code allowed to touch the simulation store on the
  │      agent's behalf
  │                                 ▲
  │                                 │ registerTool()
  ├── document.modelContext (native) — or —
  │   lib/webmcp/polyfill.ts (local fallback)
  │                                 ▲
  │                                 │ getTools() / executeTool()
  └── lib/ai/orchestrator.ts (client-side agent loop)
         │
         │ POST /api/agent { history }
         ▼
Next.js Route Handler (server, src/app/api/agent/route.ts)
         │
         ▼
lib/ai/gemini.ts → Gemini API (function calling, AUTO mode)
```

## Why the tool call actually goes through WebMCP

Gemini never touches the simulation directly. Each turn, the server route asks
Gemini "given this conversation and this tool catalog, what's next?" and gets
back either a final answer or one or more `functionCall`s (name + arguments).
The **client** orchestrator is the one that resolves those into real tool
objects via `document.modelContext.getTools()` and invokes them with
`document.modelContext.executeTool(...)` — exactly the call a native WebMCP
agent (Chrome 149+, ChatGPT Desktop) would make if it discovered CrisisDesk's
tools on its own. Gemini supplies the reasoning; WebMCP supplies the hands.
See `docs/webmcp-research.md` for the full rationale and spec citations.

## Human-in-the-loop

```
Human                          UI                         execute_remediation()
  │                             │                                  │
  │                             │  <── create_remediation_plan ────┤ (safe, just records a proposal)
  │                             │                                  │
  │                             │  <── execute_remediation call ───┤
  │                             │  approval modal appears          │  (blocked, awaiting a Promise)
  │──── clicks Approve ────────►│                                  │
  │                             │──── approvalBroker.respond(true)►│
  │                             │                                  │  mutates simulation, returns result
  │                             │  <── metrics recover, resolved ──┤
```

`execute_remediation`'s `execute()` function is a real `async` function that
`await`s a Promise from `lib/webmcp/approval.ts`; that promise only resolves
when a human clicks Approve or Cancel in `components/agent/approval-dialog.tsx`.
No infrastructure — real or simulated — changes state until that happens.

## Data flow: human vs. agent

```
Human
  ↕
CrisisDesk UI  (dashboard, incident workspace, service topology)
  ↕
Simulation / data layer  (lib/data — deterministic, in-browser, resettable)
  ↕
WebMCP tools  (lib/webmcp — the only path into the layer above for an agent)
  ↕
AI Agent  (Gemini, orchestrated client-side, never bypasses the tool layer)
```

The same tool layer serves both a native WebMCP agent and CrisisDesk's own
Gemini-powered "Investigate with Agent" button — there is exactly one set of
capabilities, not a UI path and a separate "agent path."

## Key modules

| Path | Responsibility |
|---|---|
| `lib/data/types.ts` | Domain types shared by the whole app |
| `lib/data/seed.ts` | Deterministic initial state for all 4 incident scenarios |
| `lib/data/store.ts` | In-memory + localStorage simulation state, pub/sub |
| `lib/data/repository.ts` | Typed read/write functions over the store, structured errors |
| `lib/webmcp/types.ts` | WebMCP-spec-shaped TypeScript interfaces |
| `lib/webmcp/toolDefinitions.ts` | Name/description/schema for all 10 tools (server-safe) |
| `lib/webmcp/toolExecutors.ts` | Client-only `execute()` implementations over the repository |
| `lib/webmcp/polyfill.ts` | Local stand-in for `document.modelContext` |
| `lib/webmcp/client.ts` | Resolves native vs. polyfill at call time |
| `lib/webmcp/approval.ts` | Human-in-the-loop broker for high-impact actions |
| `lib/webmcp/register.tsx` | Registers every tool on mount; exposes native/ready status |
| `lib/ai/systemPrompt.ts` | The agent's role, goals, and constraints |
| `lib/ai/gemini.ts` | Server-only Gemini client wrapper |
| `lib/ai/orchestrator.ts` | Client-side agent loop (Gemini ⇄ WebMCP) |
| `app/api/agent/route.ts` | The only server code that calls Gemini |

## Why client-side simulation state?

WebMCP tools execute **in the browser** by definition — that's the whole
point of the API. So the simulation they read and write lives in the browser
too (in-memory + `localStorage` for persistence across reloads), rather than
behind a database API. This keeps the demo self-contained, keeps Gemini calls
cheap (no server round-trip just to fetch mock data), and matches the
repository-function abstraction (`lib/data/repository.ts`) closely enough that
swapping in Postgres/Supabase later would mean changing that one file, not the
UI or the WebMCP layer.
