import { Info } from "lucide-react";
import { Link } from "react-router-dom";

export default function ActiveApplicationNotice({ application, compact = false, previous = false }) {
  if (!application) return null;
  return (
    <div className={"alert alert-info active-application-notice" + (compact ? " mb-0" : "")} role="status">
      <Info size={20} aria-hidden="true" />
      <div>
        <strong>{previous ? "You have already applied for this role" : "You already have an active application"}</strong>
        <p className="mb-0">
          {previous ? "Each role accepts one application per candidate. You can apply for a different role." : <>Your application for {application.job?.title || "another role"} is in progress. You can apply for a different role after it is withdrawn or closed.</>}
        </p>
      </div>
      <Link className="btn btn-sm btn-outline-primary" to={previous ? "/applicant/jobs" : "/applicant/status"}>{previous ? "Browse jobs" : "View status"}</Link>
    </div>
  );
}
