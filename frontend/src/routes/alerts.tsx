import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Check, Filter } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlassCard } from "@/components/GlassCard";
import { useSimulation } from "@/hooks/useSimulation";
import { useRole } from "@/lib/role";
import { districts } from "@/data/districts";
import { timeAgo } from "@/lib/format";
import type { AlertLevel } from "@/data/alerts";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Logistics Alerts — NER Access" },
      {
        name: "description",
        content:
          "Simulated landslide, flood, road, bridge and logistics alerts across North East India.",
      },
      { property: "og:title", content: "Logistics Alerts — NER Access" },
      {
        property: "og:description",
        content: "Severity-filtered logistics and accessibility alerts across North East India.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

const levels: Array<AlertLevel | "all"> = ["all", "critical", "warning", "watch", "info"];

const levelTone: Record<AlertLevel, string> = {
  critical: "border-critical/50 text-critical",
  warning: "border-warning/50 text-warning",
  watch: "border-watch/50 text-watch",
  info: "border-primary/50 text-primary",
};

function AlertsPage() {
  const { liveAlerts, acknowledge, now } = useSimulation();
  const { isAdmin } = useRole();
  const [filter, setFilter] = useState<AlertLevel | "all">("all");
  const { t } = useI18n();

  const visible = useMemo(
    () => (filter === "all" ? liveAlerts : liveAlerts.filter((a) => a.level === filter)),
    [liveAlerts, filter],
  );

  const counts = useMemo(() => {
    const base: Record<string, number> = { critical: 0, warning: 0, watch: 0, info: 0 };
    liveAlerts.forEach((a) => (base[a.level] = (base[a.level] ?? 0) + 1));
    return base;
  }, [liveAlerts]);

  return (
    <AppShell
      title="Logistics & Accessibility Alerts"
      description="Landslide, flood, road, bridge, congestion and delivery notices arrive through local simulation."
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["critical", "warning", "watch", "info"] as AlertLevel[]).map((l) => (
          <div key={l} className="rounded-xl border border-border bg-secondary/35 p-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{t(l)}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
              {counts[l] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <GlassCard
        title={t("Alert stream")}
        subtitle={`${visible.length} ${t("shown")}`}
        action={
          <div className="flex flex-wrap items-center gap-1">
            <Filter size={14} className="mr-1 text-muted-foreground" />
            {levels.map((l) => (
              <button
                key={l}
                onClick={() => setFilter(l)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs capitalize transition-colors",
                  filter === l
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {t(l)}
              </button>
            ))}
          </div>
        }
      >
        <ul className="space-y-3">
          {visible.map((a) => (
            <li
              key={a.id}
              className={cn(
                "rounded-xl border bg-secondary/25 p-3",
                levelTone[a.level],
                a.level === "critical" && !a.acknowledged && "animate-pulse-ring",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <BellRing size={14} />
                  {t(a.level)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {timeAgo(a.issuedAt, now.getTime())} · {a.channel}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">{t(a.title)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(a.message)}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {districts.find((d) => d.id === a.districtId)?.name ?? t("Region-wide")}
                </span>
                {a.acknowledged ? (
                  <span className="flex items-center gap-1 text-xs text-safe">
                    <Check size={14} /> {t("acknowledged")}
                  </span>
                ) : isAdmin ? (
                  <button
                    onClick={() => acknowledge(a.id)}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {t("Acknowledge")}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("awaiting control room")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </AppShell>
  );
}
