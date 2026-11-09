import { Info } from "lucide-react";
import { Link } from "react-router-dom";

export default function ActiveApplicationNotice({ application, compact = false }) {
  if (!application) return null;
  return (
    <div className={"alert alert-info active-application-notice" + (compact ? " mb-0" : "")} role="status">
      <Info size={20} aria-hidden="true" />
      <div>
        <strong>You already have an active application</strong>
        <p className="mb-0">
          Your application for {application.job?.title || "another role"} is in progress. You can apply for a new role after it is withdrawn or closed.
        </p>
      </div>
      <Link className="btn btn-sm btn-outline-primary" to="/applicant/status">View status</Link>
    </div>
  );
}
