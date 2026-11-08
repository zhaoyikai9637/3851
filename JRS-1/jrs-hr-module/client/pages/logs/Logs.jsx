import {useViewportRows} from "../../src/useViewportRows";
import {Link} from 'react-router-dom';
import {CommunicationContext,useApplicationContext,applicationPath} from '../../src/features/communication/ApplicationContext';
import { useRef, useState } from "react";
import { api, query } from "../../src/api";
import { LogActivity } from "../../src/features/logs/LogActivity";
import { LogFilters } from "../../src/features/logs/LogFilters";
import { initialLogFilters } from "../../src/features/logs/logUtils";
import {
  dateTime,
  ErrorBox,
  Loading,
  Modal,
  PageHeading,
  historicalDateRange,
  useLoad,
} from "../../src/shared";

export function Logs() {
  const context=useApplicationContext();
  const [filters, setFilters] = useState(initialLogFilters),
    [draft, setDraft] = useState(initialLogFilters),
    [datesOpen, setDatesOpen] = useState(false),
    [error, setError] = useState(null),
    [selected, setSelected] = useState(null);
  const host=useRef(null),loaded=useRef(null);
  const fit=useViewportRows(host,loaded.current,initialLogFilters.pageSize);
  const load = useLoad(`/api/hr/logs?${query({...filters,pageSize:fit,...(context.id?{applicationId:context.id}:{})})}`);
  loaded.current=load.data;
  const hasFilters = Boolean(filters.search || filters.trigger || filters.from || filters.to);
  function apply(event) {
    event.preventDefault();
    setError(null);
    const range = historicalDateRange(draft.from, draft.to);
    if (range.error) return setError(new Error(range.error));
    setFilters({
      ...draft,
      from: range.from,
      to: range.to,
      search: draft.search.trim(),
      trigger: draft.trigger.trim(),
      page: 1,
    });
  }
  function clear() {
    setFilters(initialLogFilters);
    setDraft(initialLogFilters);
    setDatesOpen(false);
    setError(null);
  }
  return (
    <>
      <CommunicationContext context={context}/>
      <PageHeading eyebrow={null} className="workspace-page-heading" title="Logs" />
      <section className="surface log-surface fit-panel" ref={host}>
        <LogFilters
          draft={draft}
          setDraft={setDraft}
          open={datesOpen}
          setOpen={setDatesOpen}
          onApply={apply}
          onClear={clear}
          hasFilters={hasFilters}
        />
        <div className="log-content fit-body">
          <ErrorBox error={error} />
          {load.busy ? (
            <Loading />
          ) : load.error ? (
            <ErrorBox error={load.error} retry={load.reload} />
          ) : (
            load.data && (
              <LogActivity
                data={load.data}
                onSelect={setSelected}
                onPage={(page) => setFilters((value) => ({ ...value, page }))}
              />
            )
          )}
        </div>
      </section>
      {selected && <LogDetail id={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function LogDetail({ id, onClose }) {
  const load = useLoad(`/api/hr/logs/${id}`),
    [error, setError] = useState(null),
    [downloading, setDownloading] = useState(false);
  async function download(file) {
    setError(null);
    setDownloading(true);
    try {
      await api.download(file.attachmentId, file.fileName);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setDownloading(false);
    }
  }
  const row = load.data;
  return (
    <Modal title="Email details" onClose={onClose} drawer>
      {load.busy ? (
        <Loading />
      ) : load.error ? (
        <ErrorBox error={load.error} retry={load.reload} />
      ) : (
        row && (
          <>
            {row.applicationId?<nav className="communication-context-links" aria-label="Email application links"><Link to={applicationPath(row.applicationId)}>Open application</Link><Link to={"/notifications?application="+row.applicationId}>Related notifications</Link><Link to={"/templates?application="+row.applicationId}>Templates</Link><Link to={applicationPath(row.applicationId,{compose:true})}>Write email</Link><Link to={"/logs?application="+row.applicationId}>Application email history</Link></nav>:null}
            <dl className="detail-grid">
              <div>
                <dt>Recipient</dt>
                <dd>
                  {row.candidateName}
                  <br />
                  {row.recipientEmail}
                </dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>{row.positionTitle}</dd>
              </div>
              <div>
                <dt>Event / Source</dt>
                <dd>
                  {row.triggerEvent}
                  <br />
                  {row.sourceModule}
                </dd>
              </div>
              <div>
                <dt>Template at time of sending</dt>
                <dd>{row.templateName}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Sent · Provider accepted</dd>
              </div>
              <div>
                <dt>Sent at (UTC+08:00)</dt>
                <dd>{dateTime(row.sentAt)}</dd>
              </div>
            </dl>
            <div className="snapshot-heading">Original email snapshot</div>
            <h3 className="email-subject">{row.emailSubject}</h3>
            <div className="email-snapshot">{row.emailBody}</div>
            <h3 className="small-heading">Attachments</h3>
            <ErrorBox error={error} />
            {row.attachments?.length ? (
              <ul className="attachment-list">
                {row.attachments.map((file) => (
                  <li key={file.attachmentId}>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      disabled={downloading}
                      onClick={() => download(file)}
                    >
                      Download {file.fileName}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="subtle">No attachments for this email.</p>
            )}
          </>
        )
      )}
    </Modal>
  );
}
