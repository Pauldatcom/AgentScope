import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  LayoutDashboard,
  Boxes,
  Wrench,
  Cpu,
  Upload,
  ShieldCheck,
  Settings as SettingsIcon,
  ScrollText,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Observability",
    items: [
      {
        to: "/",
        label: "Overview",
        icon: LayoutDashboard,
        description: "KPIs, activity, top models",
      },
      {
        to: "/sessions",
        label: "Sessions",
        icon: ScrollText,
        description: "All agent sessions",
      },
    ],
  },
  {
    section: "Catalogs",
    items: [
      {
        to: "/agents",
        label: "Agents",
        icon: Boxes,
        description: "Per-agent breakdown",
      },
      {
        to: "/tools",
        label: "Tools",
        icon: Wrench,
        description: "Per-tool usage & latency",
      },
      {
        to: "/models",
        label: "Models",
        icon: Cpu,
        description: "Token usage & spend",
      },
    ],
  },
  {
    section: "Data",
    items: [
      {
        to: "/imports",
        label: "Imports",
        icon: Upload,
        description: "AI import assistant",
      },
      {
        to: "/data-quality",
        label: "Data quality",
        icon: ShieldCheck,
        description: "Completeness & rejections",
      },
    ],
  },
  {
    section: "System",
    items: [
      {
        to: "/settings",
        label: "Settings",
        icon: SettingsIcon,
        description: "Sources, theme, integrations",
      },
    ],
  },
];

function isActive(current: string, to: string): boolean {
  if (to === "/") return current === "/";
  return current.startsWith(to);
}

export function Sidebar() {
  const location = useLocation();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/80 bg-card/40 backdrop-blur-sm lg:flex">
      <Link
        to="/"
        className="flex h-14 items-center gap-2.5 border-b border-border/80 px-5"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
          <Activity className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            AgentScope
          </span>
          <span className="text-[10px] text-muted-foreground">
            Observability for AI agents
          </span>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.section} className="mb-5">
            <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.section}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(location.pathname, item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-primary"
                            : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border/80 px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          <span>3 sources connected · 312 sessions</span>
        </div>
      </div>
    </aside>
  );
}
