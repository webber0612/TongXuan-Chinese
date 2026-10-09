import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";
import { LocaleProvider } from "./lib/i18n";
import { initAnalytics } from "./lib/analytics";
import { logVersionInfo } from "./version";
import "./styles/index.css";

// Log inconspicuous version badge to F12 Console & attach window.__TONGXUAN__
logVersionInfo();

// Initialize privacy-friendly anonymous analytics (GA4: G-MEZ66PMRFH)
initAnalytics();

createRoot(document.getElementById("root")!).render(<React.StrictMode><LocaleProvider><AppShell /></LocaleProvider></React.StrictMode>);

