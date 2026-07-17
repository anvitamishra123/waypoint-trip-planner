// This is the schema handed to Claude as a tool's input_schema (forces the
// shape of what it returns), AND the shape we defensively re-check on the
// way out. Forcing tool use makes malformed JSON unlikely, but "unlikely"
// isn't "impossible" - the model can still send a day with zero stops, a
// wrong type, an empty destination, etc. - so we validate anyway rather than
// trusting the wire format blindly.

export const itinerarySchema = {
  type: "object",
  properties: {
    destination: { type: "string", description: "Short destination name, e.g. 'Kyoto, Japan'." },
    tripTitle: { type: "string", description: "A short, appealing title for the trip." },
    summary: { type: "string", description: "1-2 sentence overview of the trip's vibe and pace." },
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          day: { type: "integer", description: "1-indexed day number." },
          title: { type: "string", description: "Short theme for the day, e.g. 'Old Town & river walk'." },
          stops: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                time: { type: "string", description: "e.g. 'Morning', '9:00 AM'." },
                name: { type: "string" },
                description: { type: "string", description: "1-2 sentences, concrete." },
                category: {
                  type: "string",
                  enum: ["sight", "food", "activity", "transport", "lodging"],
                },
              },
              required: ["time", "name", "description", "category"],
            },
          },
        },
        required: ["day", "title", "stops"],
      },
    },
  },
  required: ["destination", "tripTitle", "summary", "days"],
};

const CATEGORIES = new Set(["sight", "food", "activity", "transport", "lodging"]);

/**
 * Hand-rolled validator (no ajv dependency needed for a schema this small).
 * Returns { valid, errors, data } - `data` is the input with ids attached
 * to every stop and day so the frontend has stable keys for reorder/remove,
 * and with obviously-broken fields dropped rather than failing the whole
 * response for one bad field where reasonable.
 */
export function validateItinerary(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Response was not an object."], data: null };
  }

  const { destination, tripTitle, summary, days } = input;

  if (typeof destination !== "string" || !destination.trim()) errors.push("Missing destination.");
  if (typeof tripTitle !== "string" || !tripTitle.trim()) errors.push("Missing tripTitle.");
  if (typeof summary !== "string") errors.push("Missing summary.");
  if (!Array.isArray(days) || days.length === 0) errors.push("Missing or empty days array.");

  if (errors.length) return { valid: false, errors, data: null };

  const cleanDays = [];
  days.forEach((day, dIdx) => {
    if (!day || typeof day !== "object") {
      errors.push(`Day ${dIdx + 1} is not an object.`);
      return;
    }
    const stopsIn = Array.isArray(day.stops) ? day.stops : [];
    const cleanStops = [];

    stopsIn.forEach((stop, sIdx) => {
      if (!stop || typeof stop !== "object") return;
      const name = typeof stop.name === "string" ? stop.name.trim() : "";
      const description = typeof stop.description === "string" ? stop.description.trim() : "";
      if (!name) return; // drop stops with no name rather than failing the whole plan
      cleanStops.push({
        id: `d${dIdx + 1}-s${sIdx + 1}-${Math.random().toString(36).slice(2, 8)}`,
        time: typeof stop.time === "string" && stop.time.trim() ? stop.time.trim() : "—",
        name,
        description: description || "No details provided.",
        category: CATEGORIES.has(stop.category) ? stop.category : "activity",
      });
    });

    if (cleanStops.length === 0) {
      errors.push(`Day ${dIdx + 1} ("${day.title || "untitled"}") has no usable stops.`);
      return;
    }

    cleanDays.push({
      id: `day-${dIdx + 1}`,
      day: Number.isInteger(day.day) ? day.day : dIdx + 1,
      title: typeof day.title === "string" && day.title.trim() ? day.title.trim() : `Day ${dIdx + 1}`,
      stops: cleanStops,
    });
  });

  if (cleanDays.length === 0) {
    errors.push("No usable days in the plan.");
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors,
    data: {
      destination: destination.trim(),
      tripTitle: tripTitle.trim(),
      summary: summary.trim(),
      days: cleanDays,
    },
  };
}
