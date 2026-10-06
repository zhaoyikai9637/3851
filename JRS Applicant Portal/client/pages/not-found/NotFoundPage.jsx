import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="full-page-message">
      <p className="eyebrow text-primary">404</p>
      <h1>Page not found</h1>
      <p>The page you requested is not part of the applicant portal.</p>
      <Link className="btn btn-primary btn-lg" to="/jobs">Return to jobs</Link>
    </main>
  );
}
