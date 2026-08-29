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
