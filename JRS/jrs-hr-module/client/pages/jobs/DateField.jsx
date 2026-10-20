import { useEffect, useId, useRef, useState } from "react";
import { isoDate } from "./model";
import { Icon } from "../../src/icons";

const monthName = (date) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
const dayName = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

export function DateField({ label, value, onChange, disabled }) {
  const id = useId(),
    host = useRef(null),
    trigger = useRef(null);
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!host.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function toggle() {
    let selected;
    try {
      selected = isoDate(value);
    } catch {}
    setMonth(selected ? new Date(`${selected}T12:00:00Z`) : new Date());
    setOpen((current) => !current);
  }
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
  const start = (first.getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12)).getUTCDate();
  function choose(day) {
    onChange(
      `${String(day).padStart(2, "0")}/${String(month.getUTCMonth() + 1).padStart(2, "0")}/${month.getUTCFullYear()}`,
    );
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="job-field" ref={host}>
      <label htmlFor={id}>{label}</label>
      <div className="job-date-control">
        <input
          id={id}
          type="text"
          placeholder="DD/MM/YYYY"
          inputMode="numeric"
          maxLength={10}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={trigger}
          type="button"
          className="job-date-trigger"
          disabled={disabled}
          aria-label={`Open ${label} calendar`}
          aria-expanded={open}
          onClick={toggle}
        >
          <Icon name="calendar" />
        </button>
      </div>
      {open && (
        <div
          className="job-calendar"
          role="dialog"
          aria-label={`Choose ${label}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          <div className="job-calendar-heading">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 12)))
              }
            >
              ‹
            </button>
            <strong>{monthName(month)}</strong>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12)))
              }
            >
              ›
            </button>
          </div>
          <div className="job-calendar-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <span key={day}>{day}</span>
            ))}
            {Array.from({ length: start }, (_, i) => (
              <span key={`space-${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1,
                date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 12));
              return (
                <button
                  key={day}
                  type="button"
                  aria-label={dayName(date)}
                  onClick={() => choose(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="job-calendar-clear"
            onClick={() => {
              onChange("");
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            Clear date
          </button>
        </div>
      )}
    </div>
  );
}
