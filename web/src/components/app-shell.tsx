import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { Activity, Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const MOBILE_NAV = [
  { to: "/", label: "Overview" },
  { to: "/sessions", label: "Sessions" },
  { to: "/agents", label: "Agents" },
  { to: "/tools", label: "Tools" },
  { to: "/models", label: "Models" },
  { to: "/imports", label: "Imports" },
  { to: "/data-quality", label: "Data quality" },
  { to: "/settings", label: "Settings" },
  { to: "/docs", label: "Docs" },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetClose className="absolute right-3 top-3" />
                  <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary/70">
                      <Activity className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-semibold">AgentScope</span>
                  </div>
                  <nav className="flex flex-col gap-0.5 p-3">
                    {MOBILE_NAV.map((item) => (
                      <SheetClose asChild key={item.to}>
                        <Link
                          to={item.to}
                          className={cn(
                            "rounded-md px-3 py-2 text-sm transition-colors",
                            location.pathname === item.to ||
                            (item.to !== "/" &&
                              location.pathname.startsWith(item.to))
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      </SheetClose>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Last refresh
              </span>
              <span className="hidden text-xs font-medium text-foreground sm:inline">
                {new Date().toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                ● live
              </span>
              <span className="text-[11px] text-muted-foreground">
                v0.1.0
              </span>
            </div>
          </header>
          <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
            <div className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
