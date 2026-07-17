import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import cors from "cors";
import { itinerarySchema, validateItinerary } from "./itinerarySchema.js";

// dotenv's default `import "dotenv/config"` only looks for a `.env` file in
// the process's current working directory - which is the project root when
// launched via `npm start` (concurrently -> node server/index.js), NOT the
// server/ folder where the file actually lives. Resolve the path explicitly
// relative to this file instead, so it works regardless of where the
// process was launched from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
// Overridable so the failure-handling paths below can be integration-tested
// against a local mock server instead of the real API (see server/__tests__).
const GROQ_URL = process.env.GROQ_URL || "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30_000;

// --- The core trick for reliable structured output -----------------------
// Instead of asking the model to "please return JSON" in a text prompt (which
// invites markdown fences, chatty preambles, or truncated JSON), we give it a
// single tool whose parameters ARE the itinerary shape, and force tool_choice
// to that tool (OpenAI-compatible function calling, which Groq implements).
// The model then has no path to respond except by filling in that schema,
// which makes malformed output far less likely - though not impossible:
// tool arguments arrive as a raw JSON *string* the model generated, which can
// still be truncated or malformed, so we JSON.parse defensively and then
// re-validate the shape before trusting it (see itinerarySchema.js).
const buildItineraryTool = {
  type: "function",
  function: {
    name: "build_itinerary",
    description: "Return a structured day-by-day trip itinerary that matches the schema exactly.",
    parameters: itinerarySchema,
  },
};

app.post("/api/plan-trip", async (req, res) => {
  const { prompt } = req.body || {};

  if (typeof prompt !== "string" || prompt.trim().length < 3) {
    return res.status(400).json({ error: "Tell me a bit more about the trip first." });
  }
  if (prompt.length > 4000) {
    return res.status(400).json({ error: "That description is too long — try trimming it down." });
  }
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "Server is missing GROQ_API_KEY. Check server/.env." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a meticulous trip-planning assistant. Given a free-form trip description " +
              "(destination, length, interests, budget, pace - whatever the user includes), call " +
              "build_itinerary with a realistic, well-paced, day-by-day plan. Ground stops in real " +
              "or plausible places for the destination. Vary categories across a day (don't stack " +
              "five museums in a row). Keep descriptions concrete and short (one or two sentences).",
          },
          { role: "user", content: prompt.trim() },
        ],
        tools: [buildItineraryTool],
        tool_choice: { type: "function", function: { name: "build_itinerary" } },
      }),
    });

    clearTimeout(timeout);

    if (!groqRes.ok) {
      const status = groqRes.status;
      let bodyText = "";
      try { bodyText = await groqRes.text(); } catch { /* ignore */ }
      console.error("Groq API error:", status, bodyText);

      if (status === 401) {
        return res.status(500).json({ error: "Groq rejected the API key. Check server/.env." });
      }
      if (status === 429) {
        return res.status(429).json({ error: "Rate limited by Groq. Wait a moment and retry." });
      }
      return res.status(502).json({ error: "The model provider returned an error. Try again." });
    }

    const payload = await groqRes.json();
    const toolCall = payload?.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // The model responded without using the tool at all (rare, but never
      // guaranteed - e.g. it could hit a length cutoff mid-decision).
      return res.status(502).json({ error: "The model didn't return a structured plan. Try again." });
    }

    let parsedArgs;
    try {
      // Tool arguments come back as a JSON string the model generated -
      // this is exactly the "malformed JSON" failure mode the assignment
      // calls out, so it gets its own explicit try/catch rather than
      // letting a SyntaxError fall through to the generic error handler.
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("Failed to parse tool arguments as JSON:", toolCall.function.arguments);
      return res.status(502).json({
        error: "The model's response wasn't valid JSON.",
        details: [parseErr.message],
      });
    }

    const { valid, errors, data } = validateItinerary(parsedArgs);

    if (!valid) {
      console.error("Itinerary failed validation:", errors);
      return res.status(502).json({
        error: "The model's plan came back in an unexpected shape.",
        details: errors,
      });
    }

    return res.json({ itinerary: data });
  } catch (err) {
    clearTimeout(timeout);
    console.error("plan-trip error:", err);

    if (err.name === "AbortError") {
      return res.status(504).json({ error: "The model took too long to respond. Try again." });
    }
    return res.status(500).json({ error: "Something went wrong generating the trip. Try again." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, model: MODEL }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
  if (!GROQ_API_KEY) {
    console.warn("⚠️  GROQ_API_KEY is not set - copy server/.env.example to server/.env and add your key.");
  }
});
