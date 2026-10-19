import { useEffect, useRef, useState } from 'react';
import { PageHeading, Loading, ErrorBox } from '../../src/shared';
import { api } from '../../src/api';
import { JobPublishing } from './JobPublishing';

export function Recruitment({ page, title }) {
  const frame = useRef(null);
  const [height, setHeight] = useState(760), [candidate, setCandidate] = useState('');
  const [rows, setRows] = useState(null), [error, setError] = useState(null);
  useEffect(() => {
    if (page !== 'candidates') return;
    const controller = new AbortController();
    api.request('/recruitment/api/hr/candidates?limit=100', { signal: controller.signal }).then(data => setRows(data.items)).catch(e => { if (e.name !== 'AbortError') setError(e); });
    return () => controller.abort();
  }, [page]);
  useEffect(() => {
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'jrs:frame') return;
      if (Number.isFinite(event.data.height)) setHeight(Math.max(600, Math.min(6000, event.data.height)));
      const target = { notifications: '/hr/notifications', templates: '/hr/templates', 'mail-log': '/hr/logs', 'hr-profile': '/hr/profile' }[event.data.route];
      if (target) window.location.assign(target);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  if (page === 'candidates' && !candidate) return <><PageHeading title="Candidates" /><ErrorBox error={error} />{!rows && !error ? <Loading /> : <section className="surface"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Name</th><th>Email</th><th>Location</th><th>Profile</th></tr></thead><tbody>{rows?.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.location}</td><td><button className="btn btn-outline-primary btn-sm" onClick={() => setCandidate(row.id)}>View candidate</button></td></tr>)}</tbody></table></div>{rows?.length === 0 && <div className="empty-state">No candidates yet.</div>}</section>}</>;
  const embeddedPage = candidate ? `candidate/${encodeURIComponent(candidate)}` : page;
  return <>{page === 'jobs' && <JobPublishing />}{candidate && <button className="btn btn-outline-secondary mb-3" onClick={() => setCandidate('')}>Back to candidates</button>}<iframe ref={frame} title={title} src={`/recruitment/#/${embeddedPage}`} style={{ width: '100%', height, border: 0, display: 'block', background: 'transparent' }} /></>;
}
