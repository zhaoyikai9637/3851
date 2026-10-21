import { useSearchParams } from "react-router-dom";
import {useEffect,useRef,useState} from 'react';
import {useViewportRows} from '../../src/useViewportRows';
import { ErrorBox, Loading, Pagination, useLoad } from "../../src/shared";

export function Candidates({ onOpen }) {
  const [params, setParams] = useSearchParams();
  const list=useRef(null),[limit,setLimit]=useState(()=>Math.max(1,Math.min(10,Number(params.get('pageSize'))||10)));
  const search = params.get("q") || "",
    page = Math.max(1, Number(params.get("page")) || 1);
  const load = useLoad(
    `/recruitment/api/hr/candidates?${new URLSearchParams({ q: search, page: String(page), limit: String(limit) })}`,
  );
  const size=useViewportRows(list,load.data,limit);
  useEffect(()=>{
    if(size===limit)return;
    const nextPage=Math.floor((page-1)*limit/size)+1;
    setLimit(size);
    setParams(current=>{const next=new URLSearchParams(current);next.set('pageSize',String(size));if(nextPage>1)next.set('page',String(nextPage));else next.delete('page');return next;},{replace:true});
  },[size,limit,page,setParams]);
  function update(key, value) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, String(value));
        else next.delete(key);
        if (key === "q") next.delete("page");
        return next;
      },
      { replace: key === "q" },
    );
  }
  return (
    <div className="candidate-list-workspace" ref={list}>
      <div className="workspace-toolbar" role="search" aria-label="Candidate filters">
        <input
          type="search"
          className="form-control"
          aria-label="Search candidates"
          placeholder="Search name or email"
          value={search}
          onChange={(event) => update("q", event.target.value)}
        />
        {search && (
          <button className="btn btn-light" onClick={() => update("q", "")}>
            Clear filters
          </button>
        )}
      </div>
      <section className="surface candidate-surface">
        {load.busy ? (
          <Loading />
        ) : load.error ? (
          <ErrorBox error={load.error} retry={load.reload} />
        ) : (
          load.data && (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0" aria-label="Candidates">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Contact</th>
                      <th>Location</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {load.data.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button type="button" className="candidate-name" aria-label={`View profile for ${row.name}`} onClick={()=>onOpen(row.id)}>{row.name}</button>
                        </td>
                        <td>
                          {row.email}
                          {row.phone && <small className="d-block subtle">{row.phone}</small>}
                        </td>
                        <td>{row.location || "Not provided"}</td>
                        <td>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => onOpen(row.id)}
                          >
                            View candidate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!load.data.items.length && (
                <div className="empty-state">
                  {search ? "No candidates match your search." : "No candidates yet."}
                </div>
              )}
              <Pagination
                data={{ ...load.data, pageSize: load.data.limit }}
                onPage={(value) => update("page", value)}
              />
            </>
          )
        )}
      </section>
    </div>
  );
}
