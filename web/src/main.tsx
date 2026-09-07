import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { ImportPage } from "./pages/ImportPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SessionPage } from "./pages/SessionPage";
import { MappingAssistantPage } from "./pages/MappingAssistantPage";
import "./index.css";

function Nav() {
  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3">
      <Link to="/" className="font-semibold text-slate-900 mr-4">
        AgentScope
      </Link>
      <Link to="/dashboard" className="text-slate-600 hover:text-slate-900 mr-4">
        Dashboard
      </Link>
      <Link to="/imports" className="text-slate-600 hover:text-slate-900 mr-4">
        Importer
      </Link>
      <Link to="/assistant" className="text-slate-600 hover:text-slate-900">
        Assistant IA
      </Link>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="container mx-auto px-6 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/imports" element={<ImportPage />} />
          <Route path="/assistant" element={<MappingAssistantPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
