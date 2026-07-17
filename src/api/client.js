const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Calls our backend, which calls the LLM. Takes an AbortSignal so the caller
 * (App.jsx) can cancel an in-flight request if the user fires off a newer one
 * before this one resolves - that's what actually prevents a slow, stale
 * response from clobbering a fresher result on screen.
 */
export async function planTrip(prompt, signal) {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  // Combine the caller's abort signal with our own timeout abort.
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const res = await fetch("/api/plan-trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: timeoutController.signal,
    });

    let body;
    try {
      body = await res.json();
    } catch {
      throw new Error("The server sent back something that wasn't valid JSON.");
    }

    if (!res.ok) {
      throw new Error(body?.error || `Request failed (${res.status}).`);
    }
    if (!body?.itinerary) {
      throw new Error("The response didn't include an itinerary.");
    }

    return body.itinerary;
  } catch (err) {
    if (err.name === "AbortError") {
      // Distinguish "we cancelled this on purpose" from a real timeout so
      // the UI doesn't flash a scary error when the user just submitted again.
      const wasUserCancelled = signal?.aborted && !timeoutController.signal.reason;
      const e = new Error(wasUserCancelled ? "cancelled" : "The request timed out. Try again.");
      e.cancelled = wasUserCancelled;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}
