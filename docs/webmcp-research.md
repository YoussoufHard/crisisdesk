# WebMCP Research — CrisisDesk

Findings from researching the official WebMCP specification and the OpenAI WebMCP Challenge rules, done before writing any application code. This document is the source of truth for how CrisisDesk implements WebMCP — nothing here is invented.

## 1. Official references

- Spec source: [webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp) (W3C Web Machine Learning Community Group draft)
- Chrome docs: [developer.chrome.com/docs/ai/webmcp](https://developer.chrome.com/docs/ai/webmcp)
- Imperative API reference: [developer.chrome.com/docs/ai/webmcp/imperative-api](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- Security guidance: [developer.chrome.com/docs/ai/webmcp/secure-tools](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- Implementation status: [webmachinelearning/webmcp/implementation-status.md](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
- Hackathon rules: [webmcp.devpost.com/rules](https://webmcp.devpost.com/rules)
- Hackathon resources: [webmcp.devpost.com/resources](https://webmcp.devpost.com/resources)
- Community React wrapper (referenced from Chrome docs/hackathon resources): `@mcp-b/react-webmcp`

## 2. The API used

The current (post–March 2026 revision) spec exposes a single global:

```
document.modelContext
```

`navigator.modelContext` and the earlier `provideContext()`/`clearContext()` methods are **deprecated / removed**. CrisisDesk targets `document.modelContext` only.

### `registerTool(toolDefinition, options)`

```js
await document.modelContext.registerTool({
  name: "get_incident",
  description: "Retrieve structured details for an incident by ID.",
  inputSchema: {
    type: "object",
    properties: {
      incident_id: { type: "string", description: "e.g. INC-1042" }
    },
    required: ["incident_id"]
  },
  annotations: {
    readOnlyHint: true,        // does not change state
    untrustedContentHint: false
  },
  async execute(input, signal) {
    // ... application logic ...
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
}, { signal: controller.signal });
```

- `execute` receives parsed input and an `AbortSignal`.
- Return shape follows MCP tool-result convention: `{ content: [{ type: "text", text: "..." }] }`. CrisisDesk always puts a JSON string in `text` so structured data round-trips cleanly.
- `annotations.readOnlyHint` / `untrustedContentHint` are used to mark investigation tools (read-only) vs. remediation tools (state-changing) — this is a spec-native way to flag high-impact actions, and CrisisDesk relies on it for the approval gate (see §5).
- `options.signal` — passing an `AbortSignal` lets us call `controller.abort()` to unregister a tool (e.g., on unmount).
- `options.exposedTo` — restricts cross-origin visibility. Not needed for CrisisDesk (single-origin app).

### Other methods

- `unregisterTool` — via aborting the `signal` passed at registration.
- `getTools(options?)` — returns the alphabetically ordered list of currently registered tools (`{ fromOrigins }` for cross-origin discovery).
- `executeTool(tool, inputJSON, options?)` — invokes a tool object obtained from `getTools()`.
- `"toolchange"` event on `document.modelContext` — fires when the registered tool set changes.

### Iframes / cross-origin

Tool registration is disabled by default inside cross-origin iframes; a page must opt in with `<iframe allow="tools">`. Not relevant to CrisisDesk (no iframes), noted for completeness.

## 3. Browser / platform support (as researched)

| Platform | Status |
|---|---|
| Chrome 149+ | Origin Trial live |
| Edge 150+ | Origin Trial live |
| ChatGPT Desktop (in-app browser) | Full native support, no flag needed |
| Chrome (local dev, no origin trial token) | `chrome://flags/#enable-webmcp-testing` |
| Brave | Experimental, Leo AI chat only |
| Firefox / Safari | Under standards consideration, not shipped |

**Implication:** most hackathon judges opening a plain Netlify URL in an arbitrary browser will **not** have a WebMCP-capable browser/agent. The spec is real and CrisisDesk implements it for real, but the product cannot assume the browser will supply the calling agent. See §4 for how this is handled.

## 4. Architectural decision: who is "the agent"?

WebMCP's design assumes the **browser itself** (or a browser-embedded agent, like ChatGPT's in-app browser) discovers a page's tools via `document.modelContext.getTools()` and calls them via `executeTool()` — the page never talks to the LLM directly.

CrisisDesk also ships its own in-product "Investigate with Agent" experience, powered by Gemini, so the demo is self-contained and doesn't require a judge to install a special browser. To keep this **honest** (per the "do not fake WebMCP" requirement), the two pieces are wired together for real rather than being parallel/duplicate implementations:

```
Gemini (decides WHICH tool + WHAT arguments)
        │  function-calling loop, server-side
        ▼
Client orchestrator (browser)
        │  calls the SAME dispatch path a native WebMCP agent would use:
        ▼
document.modelContext.getTools() / executeTool()
        │
        ▼
Real registered tool.execute() → simulation/data layer
```

- **Every** tool CrisisDesk defines is registered exactly once, via `document.modelContext.registerTool`, in `lib/webmcp/tools.ts`.
- Gemini is only ever given tool **schemas + names**, never direct access to application internals. It picks a tool and arguments; the actual call is dispatched through `document.modelContext.executeTool()`.
- If a WebMCP-capable browser/agent (Chrome 149+, ChatGPT desktop) is present, it can **independently** discover and call the exact same tools with no CrisisDesk-specific glue — that's the "real, non-trivial WebMCP implementation" the judging criteria ask for.
- If `document.modelContext` does not exist in the current browser, CrisisDesk installs a same-shaped **local polyfill** (`lib/webmcp/polyfill.ts`) implementing `registerTool` / `unregisterTool` / `getTools` / `executeTool` / `toolchange`, so the orchestrator code path never branches on which is active.
- The UI always shows a badge — **"WebMCP: Native (Chrome/ChatGPT)"** or **"WebMCP: Local Fallback"** — read from `'modelContext' in document` at load time. This is never hidden or misrepresented (Rule 46).

## 5. Human-in-the-loop for high-impact actions

The spec has an experimental `requestUserInteraction()` under discussion but **not yet implemented** anywhere — CrisisDesk does not depend on it.

Instead, `execute_remediation` (the only state-changing, high-impact tool) is marked `annotations.readOnlyHint: false` and, on invocation, its `execute()`:

1. Publishes a "pending approval" record to app state and renders the approval modal.
2. `await`s a promise that only resolves when the human clicks Approve/Cancel in the UI.
3. On Approve, performs the simulated state mutation and resolves the tool call with the result. On Cancel, resolves with a structured `{ approved: false }` result.

This means the tool call genuinely blocks — mid-flight, inside a real `execute()` — on a human decision. No infrastructure command ever runs without a person clicking Approve. This satisfies Rule 4 (simulate, never execute real infra) and Rule 23 (human-in-the-loop as a first-class product feature) using only stable, shipped spec surface.

## 6. Testing strategy

- Unit tests for each tool's `execute()` against the data/simulation layer (valid input, invalid input, error shape) — independent of whether `document.modelContext` exists.
- A small `lib/webmcp/polyfill.test.ts` verifying the polyfill's `registerTool/getTools/executeTool/toolchange` behavior matches the documented contract, so orchestration logic is testable in any environment (including CI, which has no browser WebMCP support at all).
- Manual verification path documented in `docs/demo.md` for anyone testing on an actual Chrome 149+/origin-trial or ChatGPT desktop browser.

## 7. Limitations (stated plainly, not hidden)

- CrisisDesk cannot control whether a judge's browser has native WebMCP; the badge always tells the truth about which path is active.
- `outputSchema` exists in spec discussion but is not finalized — CrisisDesk does not rely on it; structured output is conveyed as a JSON string inside `content[0].text`, per the shipped example in the spec repo.
- `exposedTo` / cross-origin sharing is implemented by neither path since CrisisDesk is single-origin.
