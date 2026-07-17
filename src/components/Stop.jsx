const CATEGORY_ICON = {
  sight: "🏛️",
  food: "🍽️",
  activity: "🎟️",
  transport: "🚗",
  lodging: "🛏️",
};

export default function Stop({ stop, isExpanded, onToggle, onRemove, onMove, isFirst, isLast }) {
  return (
    <div className="stop">
      <div className={`stop-cat ${stop.category}`} aria-hidden="true">
        {CATEGORY_ICON[stop.category] || "📍"}
      </div>

      <div className="stop-main">
        <div
          className="stop-top-row"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}
          aria-expanded={isExpanded}
        >
          <div>
            <div className="stop-time">{stop.time}</div>
            <p className="stop-name">{stop.name}</p>
          </div>
          <span className={`expand-caret ${isExpanded ? "expanded" : ""}`} aria-hidden="true">▼</span>
        </div>
        <p className={`stop-desc ${isExpanded ? "expanded" : ""}`}>{stop.description}</p>
      </div>

      <div className="stop-controls">
        <button
          type="button"
          className="icon-btn"
          title="Move up"
          aria-label={`Move ${stop.name} earlier`}
          onClick={() => onMove(-1)}
          disabled={isFirst}
        >
          ▲
        </button>
        <button
          type="button"
          className="icon-btn"
          title="Move down"
          aria-label={`Move ${stop.name} later`}
          onClick={() => onMove(1)}
          disabled={isLast}
        >
          ▼
        </button>
        <button
          type="button"
          className="icon-btn remove"
          title="Remove stop"
          aria-label={`Remove ${stop.name}`}
          onClick={onRemove}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
