import { dateTime, ErrorBox, Modal, useLoad } from "../../shared";

export function ApplicationSummary({ id, onClose }) {
  const { data, busy, error, reload } = useLoad(`/api/hr/applications/${id}`);
  return (
    <Modal title="Application summary" onClose={onClose}>
      <p className="notice">
        Read-only summary. Recruitment actions are managed by the Applications team.
      </p>
      {busy ? (
        <div className="loading-state" role="status">
          Loading…
        </div>
      ) : error ? (
        <ErrorBox error={error} retry={reload} />
      ) : (
        <dl className="detail-grid">
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
        </dl>
      )}
    </Modal>
  );
}
