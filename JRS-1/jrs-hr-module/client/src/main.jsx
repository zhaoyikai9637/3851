import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/hr-reference-tokens.css";
import "../assets/css/styles.css";
// Legacy HR look for pages moved out of the iframe; must load before workspace-ui.css,
// as it does inside the iframe.
import "./legacy/legacy-scope.css";
import "../../../JRS HR/dist/scrollbars.css";
import { App } from "./App";
import "../../../JRS HR/dist/workspace-ui.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/hr">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
