import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../assets/css/styles.css";
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
