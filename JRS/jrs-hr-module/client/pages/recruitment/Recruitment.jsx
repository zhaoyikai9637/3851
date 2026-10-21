import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { Candidates } from "./Candidates";

const validRoute = (value) =>
  typeof value === "string" &&
  /^(?:dashboard|jobs|interviews|reports|applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?|(?:review|results)\/[A-Za-z0-9_-]+|candidate\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?)$/.test(
    value,
  );
export function Recruitment({ page, title }) {
  const frame = useRef(null),
    navigate = useNavigate();
  const { pathname, search, key: locationKey } = useLocation(),
    { setTrail } = useOutletContext();
  const [candidate, setCandidate] = useState("");
  useEffect(() => {
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      if (event.data?.type === "jrs:workspace" && event.data.intent === true && validRoute(event.data.route)) {
        const route = event.data.route,
          base = route.split("/")[0];
        const target =
          base === "jobs"
            ? "/job-postings"
            : ["review", "results", "candidate"].includes(base)
              ? "/applications"
              : "/" + base;
        if (target !== pathname)
          navigate(target + (base === "jobs" ? "" : "?view=" + encodeURIComponent(route)));
      }
      if (event.data?.type === "jrs:location" && Array.isArray(event.data.items)) {
        let items = event.data.items
          .slice(0, 5)
          .filter(
            (item) =>
              typeof item?.label === "string" && item.label.length > 0 && item.label.length <= 100,
          )
          .map(({ label, route }) => ({ label, route: typeof route === "string" ? route : null }));
        if(page === "candidates" && candidate && items.length) items=[{label:"Candidates",route:"candidates"},{label:items.at(-1).label,route:null}];
        if (!items.length) setTrail(null);
        if (items.length)
          setTrail({
            owner: locationKey,
            items,
            open(route) {
              if(route==="candidates"){setTrail(null);setCandidate("");return;}
              if (
                !/^applications(?:\/(?:applications-review|pending-review|interview|interview-results|offer|rejected|hired))?$/.test(
                  route,
                )
              )
                return;
              if (route === "applications" && pathname !== "/applications")
                navigate("/applications");
              else
                frame.current?.contentWindow.postMessage(
                  { type: "jrs:open", route },
                  window.location.origin,
                );
            },
          });
      }
      if (event.data?.type === "jrs:dialog") {
        const bounds = frame.current.getBoundingClientRect();
        if (bounds.top < 0 || bounds.top > window.innerHeight / 2)
          frame.current.scrollIntoView({ block: "start" });
      }
      if (
        event.data?.type === "jrs:navigate" &&
        ["/notifications", "/templates", "/logs", "/profile", "/applications"].includes(
          event.data.path,
        )
      )
        navigate(event.data.path);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [navigate, pathname, locationKey, setTrail, page, candidate]);
  if (page === "candidates" && !candidate) return <Candidates onOpen={setCandidate} />;
  const requested = new URLSearchParams(search).get("view");
  const embeddedPage = candidate
    ? `candidate/${encodeURIComponent(candidate)}`
    : validRoute(requested)
      ? requested
      : page;
  const filter = page === "applications" ? new URLSearchParams(search).get("job") : null;
  const source = `/recruitment/${filter ? "?job=" + encodeURIComponent(filter) : ""}#/${embeddedPage}`;
  return (
    <>
      {candidate && (
        <button
          className="btn btn-outline-secondary mb-3"
          onClick={() => {
            setTrail(null);
            setCandidate("");
          }}
        >
          Back to candidates
        </button>
      )}
      <iframe
        ref={frame}
        title={title}
        src={source}
        style={{
          width: "100%",
          height: "max(600px, calc(100dvh - 200px))",
          border: 0,
          display: "block",
          background: "transparent",
        }}
      />
    </>
  );
}
