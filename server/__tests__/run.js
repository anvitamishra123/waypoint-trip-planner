// Integration test for the "handles bad AI output" requirement. Boots the
// REAL server/index.js (not a reimplementation of it) with GROQ_URL pointed
// at the mock server above, then fires a request for each failure mode and
// asserts the server responds with a clean JSON error + sane status code
// instead of crashing or hanging. Run with: node server/__tests__/run.js
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const MOCK_PORT = 4001;
const APP_PORT = 4002;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await wait(150);
  }
  throw new Error(`Server at ${url} never came up`);
}

async function planTrip(promptSuffix) {
  const res = await fetch(`http://localhost:${APP_PORT}/api/plan-trip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `3 days somewhere nice ${promptSuffix}` }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON response would itself be a failure worth reporting */
  }
  return { status: res.status, body };
}

const results = [];
function check(name, condition, detail) {
  results.push({ name, pass: !!condition, detail });
  console.log(`${condition ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function main() {
  const mock = spawn("node", ["server/__tests__/mock-groq-server.js"], {
    cwd: ROOT,
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT) },
    stdio: "inherit",
  });

  const appServer = spawn("node", ["server/index.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      GROQ_API_KEY: "test-key-not-real",
      GROQ_URL: `http://localhost:${MOCK_PORT}/chat/completions`,
      PORT: String(APP_PORT),
      REQUEST_TIMEOUT_MS: "1500", // short, so the timeout test doesn't take 30s
    },
    stdio: "inherit",
  });

  try {
    await waitForServer(`http://localhost:${MOCK_PORT}/chat/completions`, 20).catch(() => {});
    await waitForServer(`http://localhost:${APP_PORT}/api/health`);

    // 1. Happy path - sanity check the harness itself works
    {
      const { status, body } = await planTrip("SCENARIO_DEFAULT_GOOD");
      check("Happy path returns 200 with itinerary", status === 200 && body?.itinerary?.days?.length > 0);
    }

    // 2. Malformed JSON in tool arguments
    {
      const { status, body } = await planTrip("SCENARIO_MALFORMED_JSON");
      check(
        "Malformed JSON -> clean error, not a crash",
        status === 502 && typeof body?.error === "string",
        `status=${status} error="${body?.error}"`
      );
    }

    // 3. Wrong shape / empty days
    {
      const { status, body } = await planTrip("SCENARIO_WRONG_SHAPE");
      check(
        "Wrong shape (empty days) -> clean error",
        status === 502 && typeof body?.error === "string",
        `status=${status} error="${body?.error}"`
      );
    }

    // 4. Model didn't use the tool at all
    {
      const { status, body } = await planTrip("SCENARIO_NO_TOOL_CALL");
      check(
        "No tool call -> clean error",
        status === 502 && typeof body?.error === "string",
        `status=${status} error="${body?.error}"`
      );
    }

    // 5. Empty response
    {
      const { status, body } = await planTrip("SCENARIO_EMPTY");
      check(
        "Empty choices[] -> clean error, no crash",
        status === 502 && typeof body?.error === "string",
        `status=${status} error="${body?.error}"`
      );
    }

    // 6. Upstream 401
    {
      const { status, body } = await planTrip("SCENARIO_401");
      check("Upstream 401 -> mapped to clean 500 error", status === 500 && typeof body?.error === "string");
    }

    // 7. Upstream 429
    {
      const { status, body } = await planTrip("SCENARIO_429");
      check("Upstream 429 -> mapped to 429 with error", status === 429 && typeof body?.error === "string");
    }

    // 8. Upstream 500
    {
      const { status, body } = await planTrip("SCENARIO_500");
      check("Upstream 500 -> mapped to 502 error", status === 502 && typeof body?.error === "string");
    }

    // 9. Timeout / hanging response
    {
      const start = Date.now();
      const { status, body } = await planTrip("SCENARIO_SLOW");
      const elapsed = Date.now() - start;
      check(
        "Slow/hanging upstream -> times out cleanly (not stuck forever)",
        status === 504 && elapsed < 5000,
        `status=${status} elapsed=${elapsed}ms`
      );
    }

    // 10. Partial bad data that should be repaired, not rejected
    {
      const { status, body } = await planTrip("SCENARIO_PARTIAL_BAD");
      const day1 = body?.itinerary?.days?.[0];
      const namelessDropped = day1 && day1.stops.every((s) => s.name);
      const emptyDayDropped = body?.itinerary?.days?.length === 1;
      check(
        "Partial-bad data: nameless stop dropped, empty day dropped, rest kept",
        status === 200 && namelessDropped && emptyDayDropped,
        `status=${status} days=${body?.itinerary?.days?.length} stopsInDay1=${day1?.stops?.length}`
      );
    }

    // 11. Empty prompt rejected before ever calling the model
    {
      const res = await fetch(`http://localhost:${APP_PORT}/api/plan-trip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "" }),
      });
      check("Empty prompt rejected client-side with 400", res.status === 400);
    }
  } finally {
    mock.kill();
    appServer.kill();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(failed.length ? 1 : 0);
}

main();
