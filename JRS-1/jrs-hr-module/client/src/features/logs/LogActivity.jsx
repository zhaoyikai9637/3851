import { dateTime, Empty, Pagination } from "../../shared";

export function LogActivity({ data, onSelect, onPage }) {
  if (!data.items.length)
    return <Empty title="No sent emails found">Try adjusting your search or date filters.</Empty>;
  return (
    <>
      <div className="table-responsive">
        <table className="table align-middle log-table" aria-label="Sent email history">
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Position</th>
              <th>Event</th>
              <th>Sent at</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.logId}>
                <td>
                  <strong>{row.candidateName}</strong>
                </td>
                <td>{row.positionTitle}</td>
                <td>
                  {row.triggerEvent}
                  <small className="d-block subtle">{row.templateName}</small>
                </td>
                <td>
                  <span className="status-label">Sent</span>
                  <time className="d-block">{dateTime(row.sentAt)}</time>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => onSelect(row.logId)}
                    aria-label={`View email to ${row.candidateName}`}
                  >
                    View email
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination data={data} onPage={onPage} />
    </>
  );
}
