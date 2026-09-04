import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import App from "./App";
import { BRAND } from "../brand.config";

// Single source of truth for the name (see brand.config.ts): set tab title +
// meta description at runtime so index.html never hard-codes the brand.
document.title = BRAND.name;
document
  .querySelector('meta[name="description"]')
  ?.setAttribute("content", BRAND.description);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
