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
    { setTrail,setSections } = useOutletContext();
  const [candidate, setCandidate] = useState("");
  const [contentHeight, setContentHeight] = useState(600);
  const [sectionPacket,setSectionPacket]=useState(null);
  useEffect(()=>{
    setSections?.(null);setSectionPacket(null);
    return ()=>setSections?.(null);
  },[locationKey,page,candidate,setSections]);
  function reportViewport() {
    const element=frame.current;
    if(!element)return;
    const main=element.closest('main'),footer=document.querySelector('.workspace-footer');
    const bottom=main?parseFloat(getComputedStyle(main).paddingBottom)||0:0;
    const availableHeight=Math.max(80,Math.floor(window.innerHeight-(element.getBoundingClientRect().top+window.scrollY)-bottom-(footer?.getBoundingClientRect().height||0)-8));
    element.contentWindow?.postMessage({type:'jrs:viewport',height:window.innerHeight,availableHeight},window.location.origin);
  }
  useEffect(() => {
    window.addEventListener('resize',reportViewport);
    const header=document.querySelector('.workspace-header');
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(reportViewport):null;
    if(header)observer?.observe(header);
    return () => {window.removeEventListener('resize',reportViewport);observer?.disconnect();};
  }, []);
  useEffect(()=>{
    if(!sectionPacket||sectionPacket.source!==frame.current?.contentWindow)return;
    sectionPacket.source.postMessage({type:'jrs:sections-mounted',key:sectionPacket.key},window.location.origin);
    reportViewport();
  },[sectionPacket]);
  useEffect(() => {
    function receive(event) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      if(event.data?.type==='jrs:sections'){
        const {items,label,key}=event.data;
        if(typeof key!=='string'||key.length>5000||typeof label!=='string'||label.length>100||!Array.isArray(items)||items.length>12||items.some(item=>typeof item?.label!=='string'||!item.label.trim()||item.label.length>100||typeof item.selected!=='boolean'))return;
        setSections?.({owner:locationKey,label,items:items.map(({label,selected})=>({label,selected})),select(index){frame.current?.contentWindow?.postMessage({type:'jrs:select-section',key,index},window.location.origin);}});
        setSectionPacket({key,source:event.source});
        return;
      }
      if (event.data?.type === 'jrs:frame') {
        const height=event.data.height;
        if (Number.isFinite(height) && height > 0 && height <= 100000) setContentHeight(Math.ceil(height));
        reportViewport();
        return;
      }
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
  }, [navigate, pathname, locationKey, setTrail, setSections, page, candidate]);
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
      {page==='candidates'&&<div hidden={Boolean(candidate)}><Candidates onOpen={setCandidate}/></div>}
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
      {(page!=='candidates'||candidate)&&<iframe
        ref={frame}
        title={title}
        src={source}
        scrolling="no"
        onLoad={reportViewport}
        style={{
          width: "100%",
          height: contentHeight + "px",
          border: 0,
          display: "block",
          background: "transparent",
        }}
      />}
    </>
  );
}
