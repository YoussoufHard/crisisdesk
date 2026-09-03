# Development

## Requirements

- Node.js 20.9+ (Next.js 16 minimum; this project was built on Node 24)
- npm

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack, Next.js 16 default) |
| `npm run build` | Production build; also runs the TypeScript check |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Project conventions

- **`lib/data/`** is the only place that knows about the simulation's shape.
  UI components and WebMCP tool executors both go through
  `lib/data/repository.ts` — never import `lib/data/store.ts` directly from a
  component.
- **`lib/webmcp/toolDefinitions.ts`** has no `execute` implementations and is
  safe to import from server code. **`lib/webmcp/toolExecutors.ts`** is
  client-only (it touches `lib/data/store.ts`, which is browser-based).
- Every new tool needs an entry in both files, plus a case in
  `docs/webmcp-research.md` if it changes the human-in-the-loop story.
- Pages that render simulation data are Client Components using
  `useSyncExternalStore` (see `src/hooks/useSimulation.ts`) with `null` as the
  server snapshot — this avoids SSR/client hydration mismatches for state that
  is inherently browser-only (WebMCP tools execute in the browser).

## Gemini free-tier rate limits

The free tier for `gemini-3.6-flash` enforces two separate caps, discovered
by hitting both during development:

- **5 `generateContent` requests per minute** per project
- **20 `generateContent` requests per day** per project (this is the binding
  one in practice)

A naive agent loop that asks Gemini to decide every single tool call one at a
time burns ~10 requests on a *single* investigation — at 20/day, that's two
investigations before the key is dead for the rest of the day. So
`lib/ai/orchestrator.ts` does not do that:

1. It fetches every read-only tool result itself first (`get_incident`,
   `get_service_status`, `get_recent_deployments`, `get_logs`, `get_metrics`,
   `get_dependencies` for each affected service) — still real WebMCP tool
   calls, still visible in Agent Activity, just sequenced by the client
   instead of decided one-by-one by the model. There's no real judgment call
   in "should I fetch this incident's logs" for a given incident, so nothing
   is lost by not asking.
2. It makes **exactly one** Gemini call with all of that evidence attached,
   restricted to the three analysis tools (`correlate_evidence`,
   `create_root_cause_hypothesis`, `create_remediation_plan`), asking the
   model to call all three plus produce its text summary in the same turn.
3. If a plan comes back, it calls `execute_remediation` for the first step
   itself (still gated by human approval as always) — no second Gemini call
   needed, since attempting the recommended fix was already the model's
   evident intent.

Net effect: **one Gemini request per full investigation** instead of ~10 —
20 investigations/day instead of ~2. `lib/ai/gemini.ts` still retries on a
per-minute 429 (parsing the API's `retryDelay` hint), but fails fast with a
clear message on a per-day quota error instead of retrying pointlessly (that
quota doesn't reset within any retry window worth waiting for).

If you're on a paid Gemini tier, none of this hurts — it's just fewer, denser
requests either way.

## Testing an incident scenario by hand

The four seeded incidents (`INC-1042`, `INC-1041`, `INC-1039`, `INC-1037`) are
generated relative to "now" every time the simulation resets, so they always
look fresh. To inspect the raw seed data, read `src/lib/data/seed.ts`.

## Verifying WebMCP without a supporting browser

Everything under `src/lib/webmcp/*.test.ts` exercises the polyfill's contract
(`registerTool` / `getTools` / `executeTool` / `toolchange`) directly, so CI
and local development don't depend on a WebMCP-capable browser being present.
To check the real native path, use Chrome 149+ with the origin trial (or
`chrome://flags/#enable-webmcp-testing`) or ChatGPT Desktop's in-app browser —
the top bar's WebMCP badge will read "Native" instead of "Local Fallback".
