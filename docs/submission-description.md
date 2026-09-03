# Devpost Submission — Text Description

*(Draft for the "Enter a Submission" form. Trim/paste sections as the form's fields require.)*

## Why WebMCP is a strong fit for this use case

Incident response is fundamentally a "gather evidence, decide, act" loop performed under time pressure by a human who usually has to click through five separate dashboards to do it. That loop is exactly what WebMCP is for: instead of scraping a UI or hardcoding a chatbot's responses, CrisisDesk exposes every one of its real capabilities — get_incident, get_metrics, get_logs, get_recent_deployments, get_dependencies, correlate_evidence, create_root_cause_hypothesis, create_remediation_plan, and the human-approval-gated execute_remediation — as genuine, independently discoverable `document.modelContext` tools with real JSON-Schema inputs. Any WebMCP-capable agent, not just the one CrisisDesk ships with, can discover and call them with zero app-specific glue. That's the actual test of "agent-native": can an agent that has never seen this app before use it correctly just from its tool schemas? CrisisDesk is built to pass that test.

## How it creates a better user experience

Instead of a wall of dashboards, an on-call engineer opens one incident and clicks "Investigate with Agent." They watch real tool calls happen live — not an animation, an actual `document.modelContext.executeTool` trace with inspectable input/output JSON — while the agent correlates evidence, proposes a root-cause hypothesis with a confidence score, and drafts a remediation plan. Nothing changes in the environment, real or simulated, until the human clicks Approve on a concrete, itemized action. That's the whole product thesis: the agent does the investigative legwork; the human keeps the authority to act.

## What people and agents can do together that was difficult or impossible before

Before: an engineer manually correlates a deployment timestamp against a metrics dashboard against a log stream against a dependency graph, in their head, under pressure. After: the agent does that correlation in seconds using the same structured tools a human-facing dashboard is built from, and hands the engineer a reviewable, evidence-cited conclusion instead of a hunch. Crucially, the agent never gets unsupervised write access — `execute_remediation`'s own `execute()` function literally blocks on a human decision via a real Promise, not a UI convention layered on top. That's a collaboration pattern (agent proposes with evidence, human approves with one click) that's much harder to build convincingly without a real tool-calling substrate like WebMCP underneath it.

## How WebMCP was implemented

Every tool is registered for real via `document.modelContext.registerTool(...)` (see `lib/webmcp/register.tsx` and `lib/webmcp/toolDefinitions.ts`), following the spec at github.com/webmachinelearning/webmcp (research notes and citations in `docs/webmcp-research.md`). Because native browser support is still an origin trial (Chrome 149+, Edge 150+) or limited to ChatGPT Desktop's in-app browser, CrisisDesk also ships a same-shaped local polyfill (`lib/webmcp/polyfill.ts`) used only when `document.modelContext` isn't present — the UI always labels honestly which one is active ("WebMCP: Native" vs "WebMCP: Local Fallback"), never misrepresenting the fallback as native.

CrisisDesk's own "Investigate with Agent" button is powered by Gemini, but Gemini never touches application state directly: it only ever decides which tool to call and with what arguments (in a single batched call for cost efficiency — see `docs/development.md`), and the client dispatches that decision through `document.modelContext.executeTool(...)`, the same path a fully independent WebMCP agent would use. If the live model call fails for any reason, the app falls back to a deterministic, evidence-grounded analysis of the same real data — the tool calls that follow are identical either way, because WebMCP itself, not the model behind it, is the actual product surface.

## Tech stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui, Recharts, Google Gemini (`@google/genai`), an in-browser deterministic simulation layer (no database needed for the demo), Vitest for the tool/data-layer test suite, deployed on Netlify.
