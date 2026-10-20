import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { PageHeading, Loading, ErrorBox } from '../../src/shared';
import { api } from '../../src/api';
import { JobPublishing } from './JobPublishing';

export function Recruitment({ page, title }) {
  const frame = useRef(null), navigate = useNavigate();
  const { pathname, key: locationKey } = useLocation(), { setTrail } = useOutletContext();
  const [candidate, setCandidate] = useState('');
  const [rows, setRows] = useState(null), [error, setError] = useState(null);
  useEffect(() => {
    if (page !== 'candidates') return;
    const controller = new AbortController();
    api.request('/recruitment/api/hr/candidates?limit=100', { signal: controller.signal }).then(data => setRows(data.items)).catch(e => { if (e.name !== 'AbortError') setError(e); });
    return () => controller.abort();
  }, [page]);
  useEffect(() => {
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'jrs:location' && Array.isArray(event.data.items)) {
        const items = event.data.items.slice(0, 5).filter(item => typeof item?.label === 'string' && item.label.length > 0 && item.label.length <= 100).map(({ label, route }) => ({ label, route: typeof route === 'string' ? route : null }));
        if (!items.length) setTrail(null);
        if (items.length) setTrail({ owner: locationKey, items, open(route) {
          if (!/^applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(route)) return;
          if (route === 'applications' && pathname !== '/applications') navigate('/applications');
          else frame.current?.contentWindow.postMessage({ type: 'jrs:open', route }, window.location.origin);
        } });
      }
      if (event.data?.type === 'jrs:dialog') { const bounds = frame.current.getBoundingClientRect(); if (bounds.top < 0 || bounds.top > window.innerHeight / 2) frame.current.scrollIntoView({ block: 'start' }); }
      if (event.data?.type === 'jrs:navigate' && ['/notifications', '/templates', '/logs', '/profile', '/applications'].includes(event.data.path)) navigate(event.data.path);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [navigate, pathname, locationKey, setTrail]);
  if (page === 'candidates' && !candidate) return <><PageHeading title="Candidates" /><ErrorBox error={error} />{!rows && !error ? <Loading /> : <section className="surface"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Name</th><th>Email</th><th>Location</th><th>Profile</th></tr></thead><tbody>{rows?.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}</td><td>{row.location}</td><td><button className="btn btn-outline-primary btn-sm" onClick={() => setCandidate(row.id)}>View candidate</button></td></tr>)}</tbody></table></div>{rows?.length === 0 && <div className="empty-state">No candidates yet.</div>}</section>}</>;
  const embeddedPage = candidate ? `candidate/${encodeURIComponent(candidate)}` : page;
  return <>{page === 'jobs' && <JobPublishing />}{candidate && <button className="btn btn-outline-secondary mb-3" onClick={() => { setTrail(null); setCandidate(''); }}>Back to candidates</button>}<iframe ref={frame} title={title} src={`/recruitment/#/${embeddedPage}`} style={{ width: '100%', height: 'max(600px, calc(100dvh - 200px))', border: 0, display: 'block', background: 'transparent' }} /></>;
}
