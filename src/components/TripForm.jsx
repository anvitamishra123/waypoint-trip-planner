import { useState } from "react";

const EXAMPLES = [
  "5 days in Lisbon, slow pace, love pastries and viewpoints, no museums",
  "Weekend in the Scottish Highlands, hiking-focused, budget-friendly",
  "10-day Japan trip: Tokyo, Kyoto, Osaka, first time visiting, mid-range budget",
];

const MAX_LEN = 4000;

export default function TripForm({ onSubmit, isLoading }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  };

  const overLimit = value.length > MAX_LEN;

  return (
    <form className="trip-form" onSubmit={handleSubmit}>
      <label htmlFor="trip-input" style={{ display: "none" }}>
        Describe your trip
      </label>
      <textarea
        id="trip-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Where are you headed, for how long, and what do you want out of it? e.g. “4 days in Rome, first visit, want history and great food, not a huge walker”"
        disabled={isLoading}
      />
      <div className={`char-hint ${overLimit ? "over" : ""}`}>
        {value.length}/{MAX_LEN}
      </div>

      <div className="trip-form-footer">
        <div className="example-chips">
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              className="example-chip"
              onClick={() => setValue(ex)}
              disabled={isLoading}
            >
              {ex.length > 38 ? ex.slice(0, 38) + "…" : ex}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="plan-button"
          disabled={isLoading || !value.trim() || overLimit}
        >
          {isLoading ? "Planning…" : "Plan the trip →"}
        </button>
      </div>
    </form>
  );
}
