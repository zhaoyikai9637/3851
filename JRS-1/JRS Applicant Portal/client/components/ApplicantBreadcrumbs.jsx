import { createContext, Fragment, useContext } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export const ApplicantBreadcrumbTarget = createContext(null);

export default function ApplicantBreadcrumbs({ items }) {
  const target = useContext(ApplicantBreadcrumbTarget);
  const Current = target ? "h1" : "span";
  const breadcrumb = <nav className="applicant-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      {items.map((item, index) => <Fragment key={index}>
        {index > 0 && <li className="applicant-path-separator" aria-hidden="true">/</li>}
        <li>{index === items.length - 1
          ? <Current aria-current="page">{item.label}</Current>
          : <Link to={item.to}>{item.label}</Link>}</li>
      </Fragment>)}
    </ol>
  </nav>;
  return target ? createPortal(breadcrumb, target) : breadcrumb;
}
