import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";
import { LocaleProvider } from "./lib/i18n";
import { initAnalytics } from "./lib/analytics";
import "./styles.css";

// Initialize privacy-friendly anonymous analytics (GA4: G-MEZ66PMRFH)
initAnalytics();

createRoot(document.getElementById("root")!).render(<React.StrictMode><LocaleProvider><AppShell /></LocaleProvider></React.StrictMode>);

