import { Icon } from "../../icons";
import { dateTime, Empty, Pagination } from "../../shared";
import { groupLogs } from "./logUtils";

export function LogActivity({ data, onSelect, onPage }) {
  if (!data.items.length) return <Empty title="No sent emails found">Try adjusting your search or date filters.</Empty>;
  return <>
    <div className="log-groups">
      {groupLogs(data.items).map((group) => <section className="log-group" key={group.label} aria-labelledby={`log-group-${group.label.replace(/\W+/g, "-")}`}>
        <h2 id={`log-group-${group.label.replace(/\W+/g, "-")}`}>{group.label}</h2>
        <ol className="log-list">
          {group.items.map((row) => <li key={row.logId} className="log-row">
            <span className="log-symbol"><Icon name="mail" size={18} /></span>
            <div className="log-copy"><strong>{row.candidateName}</strong><span>{row.positionTitle}</span><small>{row.triggerEvent} · {row.templateName}</small></div>
            <div className="log-time"><span className="status-label">Sent</span><time>{dateTime(row.sentAt)}</time></div>
            <button className="btn btn-sm btn-outline-primary" onClick={() => onSelect(row.logId)} aria-label={`View email to ${row.candidateName}`}>View email</button>
          </li>)}
        </ol>
      </section>)}
    </div>
    <Pagination data={data} onPage={onPage} />
  </>;
}
