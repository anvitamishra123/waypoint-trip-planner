// Session save/reload (stretch goal). Deliberately just localStorage, not a
// backend "sessions" table - the assignment's stretch goal is "save and
// reload sessions", and for a single-user tool with no auth, persisting the
// current plan client-side meets that without adding a database for a
// throwaway internship project.
const SESSION_KEY = "waypoint:session:v1";

export function saveSession({ prompt, itinerary }) {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ prompt, itinerary, savedAt: Date.now() })
    );
  } catch {
    // Storage can fail (private browsing, quota, disabled) - losing
    // persistence isn't worth surfacing an error to the user over.
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.itinerary || !parsed?.prompt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // no-op
  }
}
