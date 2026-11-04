import {Link} from 'react-router-dom';
import {applicationPath} from '../communication/ApplicationContext';
import { dateTime, ErrorBox, Modal, useLoad } from "../../shared";

export function ApplicationSummary({ id, onClose }) {
  const { data, busy, error, reload } = useLoad(`/api/hr/applications/${id}`);
  return (
    <Modal title="Application summary" onClose={onClose}>
      <p className="notice">
        Review this application or prepare an email using its current status.
      </p>
      {busy ? (
        <div className="loading-state" role="status">
          Loading…
        </div>
      ) : error ? (
        <ErrorBox error={error} retry={reload} />
      ) : (
        <><nav className="communication-context-links" aria-label="Application links"><Link to={applicationPath(id)}>Open application</Link><Link to={applicationPath(id,{compose:true})}>Write email</Link><Link to={"/notifications?application="+id}>Related notifications</Link><Link to={"/templates?application="+id}>Templates</Link><Link to={"/logs?application="+id}>Sent emails</Link></nav><dl className="detail-grid">
          <div>
            <dt>Candidate</dt>
            <dd>{data.candidateName}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>{data.positionTitle}</dd>
          </div>
          <div>
            <dt>Current status</dt>
            <dd>{data.currentStatus}</dd>
          </div>
          <div>
            <dt>Applied at</dt>
            <dd>{dateTime(data.appliedAt)}</dd>
          </div>
        </dl></>
      )}
    </Modal>
  );
}
