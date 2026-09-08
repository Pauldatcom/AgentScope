import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OverviewPage } from "@/pages/OverviewPage";
import { SessionsPage } from "@/pages/SessionsPage";
import { SessionPage } from "@/pages/SessionPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { ToolsPage } from "@/pages/ToolsPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { ImportsPage } from "@/pages/ImportsPage";
import { DataQualityPage } from "@/pages/DataQualityPage";
import { SettingsPage } from "@/pages/SettingsPage";

import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={150}>
        <AppShell>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:id" element={<SessionPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/data-quality" element={<DataQualityPage />} />
            <Route path="/settings" element={<SettingsPage />} />
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
