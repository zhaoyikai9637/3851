import { DateFields, Field } from "../../shared";

const events = ["Moved to Interview", "Offer Sent", "Status Updated"];

export function LogFilters({ draft, setDraft, open, setOpen, onApply, onClear, hasFilters }) {
  return <form className="log-toolbar" onSubmit={onApply}>
    <div className="log-tools">
      <Field label="Search">
        {(id) => <input id={id} type="search" className="form-control" placeholder="Candidate or position" maxLength={150} value={draft.search} onChange={(event) => setDraft((value) => ({ ...value, search: event.target.value }))} />}
      </Field>
      <Field label="Event">
        {(id) => <select id={id} className="form-select" value={draft.trigger} onChange={(event) => setDraft((value) => ({ ...value, trigger: event.target.value }))}><option value="">All events</option>{events.map((event) => <option key={event}>{event}</option>)}</select>}
      </Field>
      <button type="button" className={`btn btn-light log-date-toggle${open ? " active" : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>Dates</button>
      <button className="btn btn-primary">Apply</button>
      {hasFilters && <button type="button" className="btn btn-link clear-filters" onClick={onClear}>Clear</button>}
    </div>
    {open && <div className="log-date-panel"><DateFields values={draft} setValues={setDraft} /></div>}
  </form>;
}
