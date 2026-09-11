import { useState } from "react";
import { api, query } from "../api";
import {
  DateFields,
  dateTime,
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  parseUsDate,
  useLoad,
} from "../shared";

const initial = {
  search: "",
  trigger: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 10,
};
export function Logs() {
  const [filters, setFilters] = useState(initial),
    [draft, setDraft] = useState(initial),
    [error, setError] = useState(null),
    [selected, setSelected] = useState(null);
  const load = useLoad(`/api/hr/logs?${query(filters)}`);
  function apply(e) {
    e.preventDefault();
    setError(null);
    const from = parseUsDate(draft.from);
    const to = parseUsDate(draft.to);
    if (from === null || to === null)
      return setError(new Error("Enter dates as MM/DD/YYYY."));
    if (from && to && from > to)
      return setError(new Error("From date must not be after To date."));
    setFilters({
      ...draft,
      from,
      to,
      search: draft.search.trim(),
      trigger: draft.trigger.trim(),
      page: 1,
    });
  }
  return (
    <>
      <PageHeading
        title="Notification Log"
        description="A clear record of your sent recruitment emails."
      />
      <section className="surface">
        <div className="section-heading">
          <h2>Email history</h2>
          <span className="badge-soft green">Sent records</span>
        </div>
        <p className="log-explanation">
          Sent means accepted by the mail provider, not confirmed inbox
          delivery. Simulated records are labeled. Previews and unsuccessful
          attempts are excluded.
        </p>
        <form className="filter-form log-filters" onSubmit={apply}>
          <Field label="Candidate or position">
            {(id) => (
              <input
                id={id}
                type="search"
                className="form-control"
                placeholder="Search history…"
                maxLength={150}
                value={draft.search}
                onChange={(e) =>
                  setDraft((v) => ({ ...v, search: e.target.value }))
                }
              />
            )}
          </Field>
          <Field label="Trigger event" help="Exact event name">
            {(id) => (
              <input
                id={id}
                className="form-control"
                placeholder="All events"
                maxLength={100}
                list="trigger-events"
                value={draft.trigger}
                onChange={(e) =>
                  setDraft((v) => ({ ...v, trigger: e.target.value }))
                }
              />
            )}
          </Field>
          <datalist id="trigger-events">
            <option value="Moved to Interview" />
            <option value="Offer Sent" />
            <option value="Status Updated" />
          </datalist>
          <DateFields values={draft} setValues={setDraft} />
          <div className="filter-actions">
            <button className="btn btn-primary">Apply filters</button>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                setFilters(initial);
                setDraft(initial);
                setError(null);
              }}
            >
              Clear
            </button>
          </div>
        </form>
        <div className="surface-content">
          <ErrorBox error={error} />
          {load.busy ? (
            <Loading />
          ) : load.error ? (
            <ErrorBox error={load.error} retry={load.reload} />
          ) : (
            load.data && (
              <>
                {load.data.items.length ? (
                  <div
                    className="table-responsive"
                    tabIndex={0}
                    role="region"
                    aria-label="Scrollable email history"
                  >
                    <table className="table log-table">
                      <caption className="visually-hidden">
                        Successfully submitted emails; all times UTC+08:00
                      </caption>
                      <thead>
                        <tr>
                          <th>Candidate / Position</th>
                          <th>Trigger event</th>
                          <th>Template</th>
                          <th>Sent at</th>
                          <th>
                            <span className="visually-hidden">Details</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {load.data.items.map((row) => (
                          <tr key={row.logId}>
                            <td>
                              <strong>{row.candidateName}</strong>
                              <small>{row.positionTitle}</small>
                              {row.isDemo && (
                                <span className="badge-soft amber">
                                  Simulated · No email sent
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="event-label">
                                {row.triggerEvent}
                              </span>
                            </td>
                            <td>{row.templateName}</td>
                            <td>{dateTime(row.sentAt)}</td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => setSelected(row.logId)}
                                aria-label={`View email to ${row.candidateName}`}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="No sent emails found">
                    Try adjusting your search or date filters.
                  </Empty>
                )}
                <Pagination
                  data={load.data}
                  onPage={(page) => setFilters((v) => ({ ...v, page }))}
                />
              </>
            )
          )}
        </div>
      </section>
      {selected && (
        <LogDetail id={selected} onClose={() => setSelected(null)} />
      )}
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
    } catch (e) {
      setError(e);
    } finally {
      setDownloading(false);
    }
  }
  const row = load.data;
  return (
    <Modal title="Email details" onClose={onClose}>
      {load.busy ? (
        <Loading />
      ) : load.error ? (
        <ErrorBox error={load.error} retry={load.reload} />
      ) : (
        row && (
          <>
            {row.isDemo && (
              <p className="notice">Simulated history · No email was sent.</p>
            )}
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
                <dt>Trigger / Source</dt>
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
                <dd>
                  {row.isDemo
                    ? "Simulated SENT record"
                    : "SENT · Provider accepted"}
                </dd>
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
