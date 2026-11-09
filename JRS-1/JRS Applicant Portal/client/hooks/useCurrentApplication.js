import { useEffect, useState } from "react";
import api from "../api/client";

// Match the shared backend: closed or accepted applications allow a new submission.
export const isActiveApplication = application => Boolean(application) && !["Withdrawn", "Rejected", "Accepted"].includes(application.status);

export default function useCurrentApplication(enabled = true) {
  const [state, setState] = useState({ loading: enabled, application: null, active: false });
  useEffect(() => {
    if (!enabled) { setState({ loading: false, application: null, active: false }); return; }
    let cancelled = false;
    api.get("/applications/me")
      .then(({ data }) => { if (!cancelled) setState({ loading: false, application: data.application, active: isActiveApplication(data.application) }); })
      .catch(() => {
        // As in the reference, lookup failures do not block browsing; submission is still checked by the server.
        if (!cancelled) setState({ loading: false, application: null, active: false });
      });
    return () => { cancelled = true; };
  }, [enabled]);
  return state;
}
