import React from "react";
import { createRoot } from "react-dom/client";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { LearningPage } from "./pages/LearningPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CurriculumPage } from "./pages/CurriculumPage";
import { TutorPage } from "./pages/TutorPage";
import { CommercializationPage } from "./pages/CommercializationPage";
import "./styles.css";

const page = window.location.pathname === "/diagnostics" ? <DiagnosticsPage /> : window.location.pathname === "/parent-dashboard" ? <DashboardPage /> : window.location.pathname === "/curriculum" ? <CurriculumPage /> : window.location.pathname === "/tutor" ? <TutorPage /> : window.location.pathname === "/admin/commercialization" ? <CommercializationPage /> : <LearningPage />;
createRoot(document.getElementById("root")!).render(<React.StrictMode>{page}</React.StrictMode>);
