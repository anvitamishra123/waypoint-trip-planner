import express from "express";

// A stand-in for Groq's API that deliberately misbehaves in the ways the
// assignment calls out - malformed JSON, wrong shape, empty, slow/timeout,
// and outright HTTP failures - so the real failure-handling code in
// server/index.js can be exercised without depending on a live model
// actually returning bad output (which is unreliable to trigger on demand).
// Which scenario to simulate is picked by a keyword in the user's prompt.
const app = express();
app.use(express.json());

const GOOD_ITINERARY_ARGS = JSON.stringify({
  destination: "Testville",
  tripTitle: "A Fine Test Trip",
  summary: "A short trip for automated testing.",
  days: [
    {
      day: 1,
      title: "Arrival",
      stops: [
        { time: "Morning", name: "Test Landmark", description: "A place.", category: "sight" },
      ],
    },
  ],
});

function toolCallResponse(argsString) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            { function: { name: "build_itinerary", arguments: argsString } },
          ],
        },
      },
    ],
  };
}

app.post("/chat/completions", async (req, res) => {
  const prompt = req.body?.messages?.find((m) => m.role === "user")?.content || "";

  if (prompt.includes("SCENARIO_MALFORMED_JSON")) {
    // Truncated / broken JSON string, as if the model got cut off mid-generation
    return res.json(toolCallResponse('{"destination": "Nowhere", "days": [ { "day": 1, '));
  }

  if (prompt.includes("SCENARIO_WRONG_SHAPE")) {
    // Valid JSON, but missing required fields / empty days
    return res.json(toolCallResponse(JSON.stringify({ destination: "Nowhere", days: [] })));
  }

  if (prompt.includes("SCENARIO_NO_TOOL_CALL")) {
    // Model ignored tool_choice and just chatted instead
    return res.json({ choices: [{ message: { content: "Sure, let's talk about your trip!" } }] });
  }

  if (prompt.includes("SCENARIO_EMPTY")) {
    return res.json({ choices: [] });
  }

  if (prompt.includes("SCENARIO_401")) {
    return res.status(401).json({ error: "invalid_api_key" });
  }

  if (prompt.includes("SCENARIO_429")) {
    return res.status(429).json({ error: "rate_limited" });
  }

  if (prompt.includes("SCENARIO_500")) {
    return res.status(500).json({ error: "internal_error" });
  }

  if (prompt.includes("SCENARIO_SLOW")) {
    // Never responds - used to test the timeout path. REQUEST_TIMEOUT_MS
    // is set short during this specific test so it doesn't hang for real.
    return; // deliberately hang
  }

  if (prompt.includes("SCENARIO_PARTIAL_BAD")) {
    // Realistic partial failure: one day has a stop with no name, one day
    // has zero stops - validator should repair/drop rather than reject outright
    return res.json(
      toolCallResponse(
        JSON.stringify({
          destination: "Partial City",
          tripTitle: "Mostly Fine Trip",
          summary: "Some of this is broken.",
          days: [
            {
              day: 1,
              title: "Day one",
              stops: [
                { time: "9am", name: "", description: "no name, should be dropped", category: "food" },
                { time: "10am", name: "Real Place", description: "This one is fine.", category: "sight" },
              ],
            },
            { day: 2, title: "Empty day", stops: [] },
          ],
        })
      )
    );
  }

  // default: a good response
  return res.json(toolCallResponse(GOOD_ITINERARY_ARGS));
});

const PORT = process.env.MOCK_PORT || 4001;
app.listen(PORT, () => console.log(`Mock Groq server on :${PORT}`));
