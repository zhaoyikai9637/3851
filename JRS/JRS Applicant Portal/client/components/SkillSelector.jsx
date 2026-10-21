import { useState } from "react";
import { Search, X } from "lucide-react";
import { skillOptions } from "../../shared/contactFields";

export default function SkillSelector({ value, onChange }) {
  const [search, setSearch] = useState("");
  const options = Object.entries(skillOptions).filter(([code, label]) =>
    `${label} ${code}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function toggle(code) {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  }

  return <fieldset className="skill-selector">
    <legend>Skills</legend>
    {value.length > 0 && <div className="selected-skills" aria-label="Selected skills">
      {value.map((code) => <button className="selected-skill" type="button" key={code} onClick={() => toggle(code)} title={`Remove ${skillOptions[code]}`}>
        {skillOptions[code]}<X size={16} aria-hidden="true" />
      </button>)}
    </div>}
    <div className="skill-search">
      <Search size={19} aria-hidden="true" />
      <input className="form-control" type="search" aria-label="Search skills" placeholder="Search skills" value={search} onChange={(event) => setSearch(event.target.value)} />
    </div>
    <div className="skill-options">
      {options.map(([code, label]) => <label className="skill-option" key={code}>
        <input className="form-check-input" type="checkbox" checked={value.includes(code)} disabled={!value.includes(code) && value.length >= 20} onChange={() => toggle(code)} />
        <span>{label}</span>
      </label>)}
      {options.length === 0 && <span className="skill-empty">No matching skill</span>}
    </div>
    <small>{value.length}/20 selected</small>
  </fieldset>;
}
