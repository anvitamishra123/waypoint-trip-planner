import { useState } from "react";
import DayBlock from "./DayBlock.jsx";

export default function Itinerary({ itinerary, onChange, onReset }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleStop = (stopId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(stopId) ? next.delete(stopId) : next.add(stopId);
      return next;
    });
  };

  const removeStop = (dayId, stopId) => {
    onChange({
      ...itinerary,
      days: itinerary.days.map((d) =>
        d.id === dayId ? { ...d, stops: d.stops.filter((s) => s.id !== stopId) } : d
      ),
    });
  };

  const moveStop = (dayId, index, direction) => {
    onChange({
      ...itinerary,
      days: itinerary.days.map((d) => {
        if (d.id !== dayId) return d;
        const target = index + direction;
        if (target < 0 || target >= d.stops.length) return d;
        const stops = [...d.stops];
        [stops[index], stops[target]] = [stops[target], stops[index]];
        return { ...d, stops };
      }),
    });
  };

  return (
    <section>
      <div className="itinerary-header">
        <div className="itinerary-heading">
          <div className="destination-eyebrow">{itinerary.destination}</div>
          <h2>{itinerary.tripTitle}</h2>
          <p className="summary">{itinerary.summary}</p>
        </div>
        <button type="button" className="new-plan-button" onClick={onReset}>
          ↺ Plan a different trip
        </button>
      </div>

      <div className="route">
        {itinerary.days.map((day) => (
          <DayBlock
            key={day.id}
            day={day}
            expandedIds={expandedIds}
            onToggleStop={toggleStop}
            onRemoveStop={removeStop}
            onMoveStop={moveStop}
          />
        ))}
      </div>
    </section>
  );
}
