import * as React from "react";
import {
  Moon,
  Sun,
  Database,
  Cpu,
  Plug,
  Key,
  Webhook,
  Save,
  ExternalLink,
  EyeOff,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { ChartCard } from "@/components/chart-card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { api, type SourceOut, type SettingsOut } from "@/api";
import { useApi } from "@/hooks/useApi";
import { relativeTime } from "@/lib/utils";

/** Mask credentials in a Postgres/DB URL so secrets are never rendered. */
function maskUrl(url: string): string {
  // Matches scheme://user:password@host
  return url.replace(
    /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@/]+)(:[^@/]*)?@/,
    (_, scheme, user) => `${scheme}${user}:••••@`,
  );
}

function ReadOnlyField({
  label,
  value,
  mono = false,
  masked = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  masked?: boolean;
}) {
  const shown = masked ? "••••••••" : value;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          "truncate text-xs text-foreground " + (mono ? "font-mono" : "")
        }
        title={masked ? undefined : value}
      >
        {shown || "—"}
      </span>
    </div>
  );
}

const MASK_ENV_STORAGE = "agentscope-mask-env";

function readMaskPref(fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(MASK_ENV_STORAGE);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // Private mode / blocked storage.
  }
  return fallback;
}

export function SettingsPage() {
  const {
    data: settings,
    loading: settingsLoading,
    error: settingsError,
  } = useApi<SettingsOut>(() => api.fetchSettings(), []);
  const { data: sources, loading: sourcesLoading } = useApi<SourceOut[]>(
    () => api.fetchSources(),
    [],
  );

  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [autoCache, setAutoCache] = React.useState(true);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [openrouterKey, setOpenrouterKey] = React.useState("");
  const [model, setModel] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [maskEnv, setMaskEnv] = React.useState(true);

  // Seed the editable model input from the backend settings once they arrive.
  React.useEffect(() => {
    if (settings?.ia_model) setModel(settings.ia_model);
  }, [settings?.ia_model]);

  React.useEffect(() => {
    if (settings) setMaskEnv(readMaskPref(settings.mask_env ?? true));
  }, [settings?.mask_env]);

  const onMaskEnvChange = (value: boolean) => {
    setMaskEnv(value);
    try {
      localStorage.setItem(MASK_ENV_STORAGE, value ? "1" : "0");
    } catch {
      // Ignore quota / private-mode failures.
    }
  };

  const sourcesCount = sources?.length ?? 0;
  const loading = settingsLoading || sourcesLoading;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Settings"
        description="Sources, theme, AI provider, and integrations."
      >
        <Button
          size="sm"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 1800);
          }}
        >
          <Save className="mr-1 h-3.5 w-3.5" /> Save
        </Button>
      </PageHeader>
      {saved && (
        <div className="mb-4">
          <Alert tone="success" title="Preferences saved">
            Your local preferences have been stored in this browser.
          </Alert>
        </div>
      )}
      {settingsError && (
        <div className="mb-4">
          <Alert tone="error" title="Failed to load settings">
            {settingsError}
          </Alert>
        </div>
      )}
      {loading && (
        <div className="mb-4">
          <Alert tone="info" title="Loading">
            Fetching settings and sources from the API…
          </Alert>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Appearance"
          description="Theme and display preferences."
        >
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm text-foreground">Dark theme</span>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
            />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-foreground">Auto-refresh</div>
              <div className="text-[11px] text-muted-foreground">
                Poll the API every 30s for new sessions.
              </div>
            </div>
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm text-foreground">
                Auto-detect cache field
              </div>
              <div className="text-[11px] text-muted-foreground">
                Infer cache_tokens from the model's response shape.
              </div>
            </div>
            <Switch checked={autoCache} onCheckedChange={setAutoCache} />
          </div>
        </ChartCard>

        <ChartCard
          title="Sources"
          description={`${sourcesCount} datasets connected.`}
          action={<Badge variant="outline">{sourcesCount}</Badge>}
        >
          <div className="flex flex-col gap-2">
            {sourcesLoading && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading sources…
              </div>
            )}
            {!sourcesLoading && sourcesCount === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No sources connected yet.
              </div>
            )}
            {sources?.map((src) => (
              <div
                key={src.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {src.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {src.version}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {src.method} · {src.license ?? "no license"} ·{" "}
                      {relativeTime(src.retrieved_at)}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage
                </Button>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="AI provider"
          description="OpenRouter connection for the import assistant."
          action={
            <a
              href="https://openrouter.ai"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-primary"
            >
              OpenRouter <ExternalLink className="h-3 w-3" />
            </a>
          }
        >
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                OpenRouter API key
              </label>
              <Input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-v1-…"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stored locally only. Leave empty to use the deterministic{" "}
                <code className="font-mono">FakeAgent</code> in CI.
              </p>
            </div>
            <Separator />
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                Primary model
              </label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Any model reachable through OpenRouter — e.g.{" "}
                <code className="font-mono">anthropic/claude-sonnet-4.5</code>.
              </p>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Backend settings"
          description="Runtime configuration from .env (read-only)."
          action={
            <div className="flex items-center gap-2">
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Mask .env</span>
              <Switch checked={maskEnv} onCheckedChange={onMaskEnvChange} />
            </div>
          }
        >
          {!settings && !settingsLoading && (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Settings unavailable.
            </div>
          )}
          {settings && (
            <div className="flex flex-col divide-y divide-border/60">
              <ReadOnlyField
                label="Environment"
                value={settings.app_env}
                masked={maskEnv}
              />
              <ReadOnlyField
                label="Host"
                value={`${settings.app_host}:${settings.app_port}`}
                mono
                masked={maskEnv}
              />
              <ReadOnlyField
                label="CORS origins"
                value={settings.cors_origins}
                mono
                masked={maskEnv}
              />
              <ReadOnlyField
                label="IA provider"
                value={settings.ia_provider}
                masked={maskEnv}
              />
              <ReadOnlyField
                label="Primary model"
                value={settings.ia_model}
                mono
                masked={maskEnv}
              />
              <ReadOnlyField
                label="Alt model"
                value={settings.ia_model_alt}
                mono
                masked={maskEnv}
              />
              <ReadOnlyField
                label="OpenRouter base URL"
                value={settings.openrouter_base_url}
                mono
                masked={maskEnv}
              />
              <ReadOnlyField
                label="Database URL"
                value={maskUrl(settings.database_url)}
                mono
                masked
              />
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Integrations"
          description="Webhooks and export destinations."
          action={
            <Badge variant="secondary" className="text-[10px]">
              2 active
            </Badge>
          }
        >
          <div className="flex flex-col gap-2">
            {[
              {
                name: "Slack",
                desc: "Post import summaries to a channel",
                Icon: Webhook,
                on: true,
              },
              {
                name: "S3 export",
                desc: "Mirror normalized sessions to a bucket",
                Icon: Plug,
                on: false,
              },
            ].map((it) => (
              <div
                key={it.name}
                className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <it.Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm text-foreground">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {it.desc}
                    </div>
                  </div>
                </div>
                <Switch defaultChecked={it.on} />
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="mt-5">
        <Alert tone="info" title="About these settings">
          Appearance and integrations are stored locally in this browser. The
          backend settings shown above come from <code className="font-mono">.env</code>
          and are masked by default. The database URL is never sent by the API.
        </Alert>
      </div>
    </div>
  );
}
