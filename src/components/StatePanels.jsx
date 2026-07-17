const LOADING_MESSAGES = [
  "Scouting the route…",
  "Checking opening hours…",
  "Balancing the pace of each day…",
  "Lining up the stops…",
];

export function LoadingPanel() {
  // Cycle through messages so a slow request doesn't feel stalled.
  const msg = LOADING_MESSAGES[Math.floor(Date.now() / 1600) % LOADING_MESSAGES.length];
  return (
    <div className="loading-panel" role="status" aria-live="polite">
      <span className="compass-spin" aria-hidden="true">🧭</span>
      <span className="loading-text">{msg}</span>
      <div className="skeleton-day" />
      <div className="skeleton-day" style={{ opacity: 0.6 }} />
    </div>
  );
}

export function ErrorPanel({ message, details, onRetry }) {
  return (
    <div className="state-panel error" role="alert">
      <strong>Couldn't build that itinerary.</strong>
      <p style={{ margin: "6px 0 0" }}>{message}</p>
      {details && details.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
          {details.slice(0, 4).map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      <button className="retry-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyPanel() {
  return (
    <div className="state-panel empty">
      <span className="state-icon" aria-hidden="true">🗺️</span>
      Describe a trip above and your route will show up here — day by day,
      stop by stop, all editable.
    </div>
  );
}
