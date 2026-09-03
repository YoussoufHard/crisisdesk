## Inspiration

Most "AI + app" projects bolt a chatbot onto an existing UI and hardcode what it's allowed to say. I wanted to build the opposite: an app designed from day one so that a real AI agent — not a scripted demo — could discover its capabilities and use them the way a human would, through a genuine protocol rather than screen-scraping or prompt engineering tricks.

Incident response felt like the perfect domain to prove it. On-call engineers already live the exact loop an agent is good at: gather evidence from five different dashboards, correlate it under time pressure, form a hypothesis, and — critically — never act alone on something risky. That last part is the whole point of CrisisDesk: the agent investigates freely, but a human always has the final say before anything changes.

## What it does

CrisisDesk is a simulated SRE platform. Four incident scenarios ship with it — a payment API regression from a bad deploy, a database connection pool exhausting itself, a search-indexing backlog, and a memory leak — each with real, correlated, time-series metrics, logs, and deployment history.

Click "Investigate with Agent" on any incident and the agent:
1. Gathers evidence (incident details, service status, deployments, logs, metrics, dependencies) through real WebMCP tools.
2. Correlates the evidence and proposes a root-cause hypothesis with a confidence score.
3. Drafts a remediation plan.
4. Proposes executing it — and then **stops**. A real approval dialog appears, and nothing happens to the simulated environment until a human clicks Approve.

Every one of those steps is a real, independently-discoverable tool registered via `document.modelContext.registerTool`, not a scripted animation. You can inspect the exact input/output JSON of every call in the live "Agent Activity" feed.

## How I built it

The stack is Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind + shadcn/ui on the frontend, Recharts for the metrics, and Google's Gemini API for the agent's reasoning. The simulation itself (incidents, services, logs, metrics, deployments) is a deterministic, resettable, entirely client-side data layer — WebMCP tools execute in the browser by definition, so that's where their data lives too.

The architecture keeps one hard rule: **Gemini never touches the app directly.** It only ever picks a tool name and arguments; the actual call always goes through `document.modelContext.executeTool(...)` — the exact path a fully independent WebMCP agent (Chrome's origin trial, ChatGPT Desktop) would use if it discovered CrisisDesk on its own with zero app-specific code. If a real WebMCP-capable browser is present, the badge in the top bar says so; if not, a same-shaped local polyfill takes over and says so just as honestly.

The one high-impact tool, `execute_remediation`, enforces human approval inside its own `execute()` function — it's a real `await` on a Promise that only resolves when a person clicks a button, not a UI convention layered on top of an agent that could technically act without it.

## Challenges I ran into

**The Gemini free tier is stricter than it looks.** My first working version asked Gemini to decide every single tool call one at a time — a natural, ReAct-style loop. It worked, but burned ~10 API requests per investigation. Testing quickly revealed the free tier caps `gemini-3.6-flash` at 5 requests/minute *and* 20 requests/day. At that rate, two full investigations exhausted an entire day's quota. I redesigned the loop: the app now gathers all the read-only evidence itself (still real WebMCP calls, just sequenced deterministically instead of decided one-by-one by the model) and asks Gemini to do its actual reasoning — correlate, hypothesize, plan, summarize — in a **single** batched call. Same real tool calls, one-tenth the API usage.

**Windows and Netlify's Next.js plugin don't get along.** `netlify deploy --build` reliably failed at "Failed publishing static content" — traced it down to the local Windows account lacking `SeCreateSymbolicLinkPrivilege` (Developer Mode off), which the plugin's static-asset publishing step seems to need. Rather than force a system-level Windows setting change, I shipped on Vercel instead, which the hackathon rules explicitly allow.

**Making the demo resilient, not just working.** A live third-party API call is a single point of failure for a judged demo. So beyond retry-with-backoff on transient rate limits, I wrote a deterministic, evidence-grounded fallback analysis for each of the four incident scenarios. If the live Gemini call fails for *any* reason — quota, outage, missing key — the exact same real tool calls execute with that content instead, and the experience doesn't visibly change. Nothing about WebMCP is faked either way; only the source of the analysis text differs.

## Accomplishments that I'm proud of

- A WebMCP implementation that's genuinely spec-compliant (researched the actual spec and hackathon-provided code sample before writing a line of tool code) and honest about native-vs-polyfill support, never misrepresenting one as the other.
- Human-in-the-loop that's enforced in the tool's own code path, not just the UI.
- A full Vitest suite — including feeding the fallback content through the *real* tool executors, human-approval flow included — that caught two real bugs before they shipped (a missing `isError` flag on failed read-tool results, and log data that didn't actually support one incident's stated root cause).
- The full loop — investigate, hypothesize, plan, approve, execute, resolve — verified end to end against the live production deployment with the real Gemini API, not just locally.

## What I learned

How much of "agentic" design is really about where you draw the line between what the model decides and what the app decides deterministically — and that pulling that line in the right place is also just good cost engineering. And that a demo's reliability is a feature you have to design for explicitly, not something you get for free from a third-party API.

## What's next for CrisisDesk

A real datastore behind the existing repository abstraction (Postgres/Supabase — the app is already structured so this is a swap, not a rewrite), a couple more analysis tools (`assign_incident`, `verify_recovery`), and validating the same tool layer against a real native WebMCP agent as browser support matures past the current origin trial.
