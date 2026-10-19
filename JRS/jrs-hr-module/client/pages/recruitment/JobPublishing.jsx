import { useEffect, useState } from 'react';
import { api } from '../../src/api';
import { ErrorBox, Loading } from '../../src/shared';
const empty = { salaryRange: '', closingDate: '', publishDate: '', unpublishDate: '' };
export function JobPublishing() {
  const [open, setOpen] = useState(false), [items, setItems] = useState(null), [id, setId] = useState('');
  const [fields, setFields] = useState(empty), [busy, setBusy] = useState(false), [error, setError] = useState(null), [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open || items) return;
    const controller = new AbortController();
    api.request('/api/hr/job-publications', { signal: controller.signal }).then(data => setItems(data.items)).catch(e => { if (e.name !== 'AbortError') setError(e); });
    return () => controller.abort();
  }, [open, items]);
  function choose(value) {
    setId(value); setSaved(false);
    const row = items.find(row => row.id === value);
    setFields(Object.fromEntries(Object.keys(empty).map(key => [key, row?.[key] || ''])));
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(null); setSaved(false);
    try {
      await api.request(`/api/hr/job-publications/${encodeURIComponent(id)}`, { method: 'PUT', body: fields });
      setItems(current => current.map(row => row.id === id ? { ...row, ...fields } : row)); setSaved(true);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <details className="surface mb-4 p-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="fw-semibold">Publishing settings</summary>
    {open && <div className="pt-3"><ErrorBox error={error} />{!items && !error ? <Loading /> : <form onSubmit={save}>
      <label className="form-label d-block">Job<select className="form-select mt-1" value={id} onChange={event => choose(event.target.value)} required><option value="">Select a job</option>{items?.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
      <div className="row g-3">{[['salaryRange', 'Salary range', 'text'], ['closingDate', 'Closing date', 'date'], ['publishDate', 'Publish date', 'date'], ['unpublishDate', 'Unpublish date', 'date']].map(([key, label, type]) => <label key={key} className="col-md-6 form-label">{label}<input className="form-control mt-1" type={type} maxLength={key === 'salaryRange' ? 80 : undefined} value={fields[key]} disabled={!id || busy} onChange={event => { setFields(current => ({ ...current, [key]: event.target.value })); setSaved(false); }} /></label>)}</div>
      <button className="btn btn-primary mt-3" disabled={!id || busy}>{busy ? 'Saving…' : 'Save publishing settings'}</button>{saved && <span className="ms-3" role="status">Publishing settings saved.</span>}
    </form>}</div>}
  </details>;
}
