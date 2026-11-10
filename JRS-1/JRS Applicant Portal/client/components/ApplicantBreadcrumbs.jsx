import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function ApplicantBreadcrumbs({ items }) {
  return <nav className="applicant-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => <li key={index}>
        {index > 0 && <ChevronRight size={16} aria-hidden="true" />}
        {index === items.length - 1
          ? <span aria-current="page">{item.label}</span>
          : <Link to={item.to}>{item.label}</Link>}
      </li>)}
    </ol>
  </nav>;
}
