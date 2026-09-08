import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardPage } from "@/pages/DashboardPage";
import { ImportPage } from "@/pages/ImportPage";
import { MappingAssistantPage } from "@/pages/MappingAssistantPage";
import { SessionPage } from "@/pages/SessionPage";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={150}>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/imports" element={<ImportPage />} />
            <Route path="/assistant" element={<MappingAssistantPage />} />
            <Route path="/sessions/:id" element={<SessionPage />} />
          </Routes>
        </AppShell>
      </TooltipProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
