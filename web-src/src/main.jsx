import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/global.css";

// Route transitions use the View Transitions API where available (Chromium,
// Safari 18+); this flags browsers without it (Firefox, older Safari) so the
// CSS keyframe fallback in global.css is scoped to only those.
if (typeof document.startViewTransition !== "function") {
  document.documentElement.classList.add("no-view-transitions");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
