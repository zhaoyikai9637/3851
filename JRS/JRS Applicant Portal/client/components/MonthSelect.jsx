import { currentMonth } from "../../shared/applicantFields";

export default function MonthSelect({ name, value, onChange, disabled = false, required = true }) {
  const [year = "", month = ""] = value.split("-");
  const now = currentMonth();
  const years = Array.from({ length: Number(now.slice(0, 4)) - 1900 + 1 }, (_, i) => Number(now.slice(0, 4)) - i);
  function change(part, selected) {
    onChange({ target: { name, value: part === "year" ? `${selected}-${month}` : `${year}-${selected}`, type: "select-one" } });
  }
  return <span className="d-flex gap-2">
    <select aria-label={`${name === "startDate" ? "Start" : "End"} year`} className="form-select form-select-lg" value={year} onChange={(event) => change("year", event.target.value)} disabled={disabled} required={required && !disabled}>
      <option value="">Year</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
    <select aria-label={`${name === "startDate" ? "Start" : "End"} month`} className="form-select form-select-lg" value={month} onChange={(event) => change("month", event.target.value)} disabled={disabled} required={required && !disabled}>
      <option value="">Month</option>{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((item) => <option key={item} value={item}>{item}</option>)}
    </select>
  </span>;
}
