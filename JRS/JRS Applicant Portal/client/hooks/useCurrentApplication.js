import { useEffect, useState } from "react";
import api from "../api/client";
import { isActiveApplication } from "../utils/navigation";

// Loads the applicant's current application so pages can explain the
// one-active-application rule before the applicant starts filling a form.
export default function useCurrentApplication(enabled = true) {
  const [state, setState] = useState({ loading: enabled, application: null, active: false });

  useEffect(() => {
    if (!enabled) {
      setState({ loading: false, application: null, active: false });
      return undefined;
    }
    let cancelled = false;
    api
      .get("/applications/me")
      .then(({ data }) => {
        if (!cancelled) setState({ loading: false, application: data.application, active: isActiveApplication(data.application) });
      })
      .catch(() => {
        // A failed lookup must not block browsing; the server still enforces the rule on submit.
        if (!cancelled) setState({ loading: false, application: null, active: false });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
