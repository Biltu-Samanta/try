import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function GlassCard({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <section className={cn("glass glass-glow rounded-2xl p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{t(title)}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground">{t(subtitle)}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "primary",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "primary" | "critical" | "warning" | "safe";
  icon?: ReactNode;
}) {
  const { t } = useI18n();
  const toneRing = {
    primary: "text-primary",
    critical: "text-critical",
    warning: "text-warning",
    safe: "text-safe",
  }[tone];

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{t(label)}</span>
        <span className={toneRing}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{t(hint)}</p>}
    </div>
  );
}
