import React from "react";
import { createRoot } from "react-dom/client";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { LearningPage } from "./pages/LearningPage";
import "./styles.css";

const page = window.location.pathname === "/diagnostics" ? <DiagnosticsPage /> : <LearningPage />;
createRoot(document.getElementById("root")!).render(<React.StrictMode>{page}</React.StrictMode>);
