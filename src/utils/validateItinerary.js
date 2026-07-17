// The backend already validates the model's output before sending it here,
// but the frontend re-checks the shape it actually receives rather than
// trusting the network hop blindly. This is intentionally light - the heavy
// validation/repair lives server-side (server/itinerarySchema.js) since
// that's where we have the raw model output to repair from.
export function isRenderableItinerary(it) {
  if (!it || typeof it !== "object") return false;
  if (!Array.isArray(it.days) || it.days.length === 0) return false;
  return it.days.every(
    (d) => d && Array.isArray(d.stops) && d.stops.length > 0 && d.stops.every((s) => s && s.name)
  );
}
