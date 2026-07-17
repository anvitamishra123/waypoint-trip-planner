import Stop from "./Stop.jsx";

export default function DayBlock({ day, expandedIds, onToggleStop, onRemoveStop, onMoveStop }) {
  return (
    <div className="day-block">
      <div className="day-marker" aria-hidden="true" />
      <div className="day-tab">
        <span className="day-number">Day {day.day}</span>
        <span className="day-title">{day.title}</span>
      </div>
      <div className="day-stops">
        {day.stops.length === 0 ? (
          <div className="day-empty-note">All stops removed for this day.</div>
        ) : (
          day.stops.map((stop, idx) => (
            <Stop
              key={stop.id}
              stop={stop}
              isExpanded={expandedIds.has(stop.id)}
              onToggle={() => onToggleStop(stop.id)}
              onRemove={() => onRemoveStop(day.id, stop.id)}
              onMove={(dir) => onMoveStop(day.id, idx, dir)}
              isFirst={idx === 0}
              isLast={idx === day.stops.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
