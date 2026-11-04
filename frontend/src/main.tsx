import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./AppShell";
import { LocaleProvider } from "./lib/i18n";
import { initAnalytics } from "./lib/analytics";
import { logVersionInfo } from "./version";
import { loadVoiceClips } from "./lib/voiceClips";
import { migrate } from "./lib/storage";
import "./styles/index.css";

// Log inconspicuous version badge to F12 Console & attach window.__TONGXUAN__
migrate();
logVersionInfo();

// Recorded lesson audio; until it loads (or if it is missing) speech falls back to the browser voice.
void loadVoiceClips();

// Initialize privacy-friendly anonymous analytics (GA4: G-MEZ66PMRFH)
initAnalytics();

createRoot(document.getElementById("root")!).render(<React.StrictMode><LocaleProvider><AppShell /></LocaleProvider></React.StrictMode>);

