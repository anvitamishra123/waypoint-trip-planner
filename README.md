# Waypoint — trip planner

A small React app: describe a trip in plain words, get back a day-by-day
itinerary you can expand, reorder, and trim down — not a chat transcript.

## What it does

* Free-form textarea â†’ sent to Groq (Llama/OSS models via Groq's fast
inference API) through a tiny Express backend.
* The model is forced to respond through a **tool call** whose parameters
schema *is* the itinerary shape (`build_itinerary`), using OpenAI-style
function calling, rather than being asked to "please output JSON" in a
text prompt. This is the main defense against malformed output — the
model has no path to reply except by filling in the schema.
* Tool arguments still arrive as a raw JSON *string* the model generated,
which can be truncated or malformed on its own — that gets parsed in its
own `try/catch` (see `server/index.js`) so a `JSON.parse` failure returns
a clean error instead of crashing the server.
* The server re-validates the parsed result anyway
(`server/itinerarySchema.js`) before it ever reaches the frontend —
dropping stops that are missing a name, dropping days with no usable
stops, and failing loudly (with a specific error) if the whole thing is
unusable.

 **Demo video:** https://drive.google.com/file/d/1y2IHgwUDhlKyxhgFwj48fs0CG0MVhX6H/view?usp=drive_link



### How the failure-handling is actually verified

Rather than just asserting the error-handling code is correct, there's a
small integration test suite (`server/__tests__/`) that boots the real
backend against a mock stand-in for Groq's API, and forces every failure
mode the assignment calls out one at a time: malformed JSON, wrong
shape/empty days, the model skipping the tool call entirely, an empty
response, upstream 401/429/500 errors, a hanging request (timeout path),
and partial-bad data that should be repaired rather than rejected. Run it
with:

```bash
npm test
```

All 11 checks currently pass. This doesn't replace testing the real app in
a browser (see "Setup" above) — it's there so the failure paths are
provably exercised rather than just trusted by inspection, and so a bug in
one of them shows up immediately instead of only during a live demo.

* The frontend renders the result as a route: one card per day, each stop
expandable for details, removable, and reorderable within its day.
* The current plan (and any edits you make to it — removed or reordered
stops) is saved to `localStorage` and restored automatically if you
refresh or close the tab and come back (`src/utils/storage.js`). "Plan a
different trip" clears it.

## Setup

Requires Node 18+.

```bash
npm install
cp server/.env.example server/.env
# then edit server/.env and add your GROQ_API_KEY (free at console.groq.com/keys)
npm start
```

`npm start` runs the Vite dev server (`:5173`) and the Express API
(`:3001`) together via `concurrently`. Vite proxies `/api/*` requests to
the Express server, so the frontend never sees the API key. Open
`http://localhost:5173`.

If you'd rather run them separately: `npm run server` in one terminal,
`npx vite` in another.

### Using a different provider

The FAQ says any provider is fine. Only `server/index.js` is
Groq-specific — it builds one tool schema and forces `tool_choice` to it
via Groq's OpenAI-compatible `/chat/completions` endpoint. Swapping
providers means swapping that one file: Anthropic's Messages API (`tools`

* `tool_choice: {type:"tool", name:...}`), OpenAI directly, or Gemini's
`responseSchema` all do the equivalent job. `server/itinerarySchema.js`
(the schema + validator) doesn't need to change — it's already
provider-agnostic JSON Schema.

## AI-usage note

Being upfront about this one: I used Claude extensively while building
this — for scaffolding the project structure, writing the forced
tool-call schema approach in the backend, the reorder/remove state logic
in `Itinerary.jsx`, and the CSS. I reviewed, tested, and adjusted it
rather than pasting it in blind (see the manual test run against the
validator in the commit history / terminal output), but I want to be
honest that AI did a large share of the first draft here, not just
autocomplete-level assistance.

**Before you submit this as your own work:** read through
`server/index.js`, `server/itinerarySchema.js`, `App.jsx`, and
`Itinerary.jsx` until you could rebuild the stale-response guard and the
forced-tool-call approach from memory — the interview explicitly involves
explaining decisions, fixing a bug, and extending this live, and generic
familiarity won't hold up under that. Small, honest commits as you make
it your own (tweak the schema, change the design tokens, restructure a
component) will also read better than one large AI-generated commit.

## Known limitations

* Reordering is up/down buttons, not drag-and-drop (more reliable on
mobile, less code, but less fluid).
* Session persistence is a single slot in `localStorage` (one saved trip
per browser), not multiple named/saved sessions — good enough for "come
back later," not a trip history list.
* Only one "block type" (a stop card) — the stretch goal of the model
returning different block kinds (chart, checklist, etc.) isn't done.
* No streaming; the full itinerary appears once the tool call completes.
For a multi-day trip this is usually a few seconds, not long enough to
clearly need it, but it's the first thing I'd add next.
* The stale-response guard is tested by inspection (rapid double-submit
cancels the first request's controller) rather than by an automated test.
* Category icons/colors are a fixed enum (`sight`, `food`, `activity`,
`transport`, `lodging`) — the validator falls back to `activity` for
anything the model invents outside that set, which is safe but slightly
lossy.



## Time spent



*Roughly 5-6 hours total, across:*

*- Initial project scaffold, backend design (forced tool-call schema),*

  *frontend components, and styling: ~2.5-3 hours*

*- Switching the backend from Anthropic to Groq, and fixing a dotenv*

  *path bug that was silently ignoring the API key: ~45 min*

*- Building and running the automated failure-handling test suite*

  *(server/__tests__) against 11 simulated bad-output scenarios: ~45 min*

*- Local environment setup, debugging (Node install, PowerShell/.env*

  *encoding issues), and end-to-end testing with a real API key: ~1 hour*

*- Mobile testing, README, git/GitHub setup: ~30 min*


