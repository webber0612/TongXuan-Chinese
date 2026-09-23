import React from "react";
import { createRoot } from "react-dom/client";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { LearningPage } from "./pages/LearningPage";
import { DashboardPage } from "./pages/DashboardPage";
import "./styles.css";

const page = window.location.pathname === "/diagnostics" ? <DiagnosticsPage /> : window.location.pathname === "/parent-dashboard" ? <DashboardPage /> : <LearningPage />;
createRoot(document.getElementById("root")!).render(<React.StrictMode>{page}</React.StrictMode>);
