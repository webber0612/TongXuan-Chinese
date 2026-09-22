import React from "react";
import { createRoot } from "react-dom/client";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><DiagnosticsPage /></React.StrictMode>);
