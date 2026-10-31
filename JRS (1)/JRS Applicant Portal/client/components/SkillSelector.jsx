import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_SKILLS, normaliseSkill } from "../../shared/contactFields";

export default function SkillSelector({ value, onChange }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  function addSkill() {
    try {
      const skill = normaliseSkill(draft);
      if (value.length >= MAX_SKILLS) throw new Error(`You can add up to ${MAX_SKILLS} skills.`);
      if (value.some((item) => item.toLocaleLowerCase("en") === skill.toLocaleLowerCase("en"))) throw new Error("This skill has already been added.");
      onChange([...value, skill]);
      setDraft("");
      setError("");
    } catch (validationError) {
      setError(validationError.message);
    }
  }

  function removeSkill(skill) {
    onChange(value.filter((item) => item !== skill));
    setError("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addSkill();
    }
  }

  return <fieldset className="skill-selector">
    <legend>Skills</legend>
    {value.length > 0 && <div className="selected-skills" aria-label="Selected skills">
      {value.map((skill) => <button className="selected-skill" type="button" key={skill.toLocaleLowerCase("en")} onClick={() => removeSkill(skill)} title={`Remove ${skill}`}>
        {skill}<X size={16} aria-hidden="true" />
      </button>)}
    </div>}
    <div className="skill-add-row">
      <input className={"form-control " + (error ? "is-invalid" : "")} type="text" aria-label="Add a skill" placeholder="Type a skill, for example React or Customer service" value={draft} maxLength={60} onChange={(event) => { setDraft(event.target.value); setError(""); }} onKeyDown={handleKeyDown} />
      <button className="btn btn-outline-primary" type="button" onClick={addSkill} disabled={value.length >= MAX_SKILLS || !draft.trim()}><Plus size={18} />Add skill</button>
    </div>
    {error && <div className="invalid-feedback d-block" role="alert">{error}</div>}
    <small>Add relevant skills one at a time. {value.length}/{MAX_SKILLS} added.</small>
  </fieldset>;
}
