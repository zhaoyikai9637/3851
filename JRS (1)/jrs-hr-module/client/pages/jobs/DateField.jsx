import { useEffect, useId, useRef, useState } from "react";
import { displayDate, isoDate } from "./model";
import { Icon } from "../../src/icons";

const businessDate = () => new Date(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())+"T12:00:00Z");
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

export function DateField({ label, value, onChange, disabled, min, max }) {
  const id = useId(),
    host = useRef(null),
    trigger = useRef(null);
  const [open, setOpen] = useState(false),
    [view, setView] = useState("days"),
    [month, setMonth] = useState(businessDate);
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
    setMonth(selected ? new Date(`${selected}T12:00:00Z`) : businessDate());
    setView("days");
    setOpen((current) => !current);
  }
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1, 12));
  const year = month.getUTCFullYear(),
    decade = Math.floor(year / 10) * 10;
  const heading =
    view === "days"
      ? monthName(month)
      : view === "months"
        ? String(year)
        : `${decade}–${decade + 9}`;
  const unit = view === "days" ? "month" : view === "months" ? "year" : "decade";
  function move(direction) {
    const next = new Date(first);
    if (view === "days") next.setUTCMonth(next.getUTCMonth() + direction);
    else next.setUTCFullYear(year + direction * (view === "years" ? 10 : 1));
    if (next.getUTCFullYear() >= 1 && next.getUTCFullYear() <= 9999) setMonth(next);
  }
  const start = (first.getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12)).getUTCDate();
  function choose(day) {
    onChange(
      displayDate(`${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`),
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
          placeholder="DD MM YYYY"
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
            <button type="button" aria-label={`Previous ${unit}`} onClick={() => move(-1)}>
              ‹
            </button>
            <button
              type="button"
              className="calendar-level"
              aria-label={
                view === "days" ? "Choose month" : view === "months" ? "Choose year" : "Year range"
              }
              onClick={() => setView(view === "days" ? "months" : "years")}
            >
              {heading}
            </button>
            <button type="button" aria-label={`Next ${unit}`} onClick={() => move(1)}>
              ›
            </button>
          </div>
          {view !== "days" ? (
            <div className="job-calendar-options">
              {Array.from({ length: view === "months" ? 12 : 10 }, (_, index) => {
                const number = view === "months" ? index : decade + index;
                const label =
                  view === "months"
                    ? new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
                        new Date(Date.UTC(2024, index, 1)),
                      )
                    : String(number);
                return (
                  <button
                    key={number}
                    type="button"
                    disabled={number < 0 || (view === "years" && (number < 1 || number > 9999))}
                    onClick={() => {
                      const next = new Date(first);
                      if (view === "months") next.setUTCMonth(number);
                      else next.setUTCFullYear(number);
                      setMonth(next);
                      setView(view === "months" ? "days" : "months");
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
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
                    disabled={
                      (min && date.toISOString().slice(0, 10) < min) ||
                      (max && date.toISOString().slice(0, 10) > max)
                    }
                    onClick={() => choose(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          )}
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
