import { Check, AlertTriangle, ShieldAlert, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type SafetyState = "safe" | "warn" | "danger" | "neutral";

const config: Record<
  SafetyState,
  {
    icon: React.ComponentType<{ className?: string }>;
    ring: string;
    fg: string;
    bg: string;
  }
> = {
  safe: {
    icon: Check,
    ring: "ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--safe)_40%,transparent)]",
    fg: "text-[color:var(--safe)]",
    bg: "bg-[color:color-mix(in_oklab,var(--safe)_14%,transparent)]",
  },
  warn: {
    icon: AlertTriangle,
    ring: "ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--warn)_40%,transparent)]",
    fg: "text-[color:var(--warn)]",
    bg: "bg-[color:color-mix(in_oklab,var(--warn)_14%,transparent)]",
  },
  danger: {
    icon: ShieldAlert,
    ring: "ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--danger)_45%,transparent)]",
    fg: "text-[color:var(--danger)]",
    bg: "bg-[color:color-mix(in_oklab,var(--danger)_15%,transparent)]",
  },
  neutral: {
    icon: Minus,
    ring: "ring-1 ring-inset ring-white/10",
    fg: "text-muted-foreground",
    bg: "bg-white/[0.04]",
  },
};

export function SafetyStateChip({
  state,
  label,
  className,
}: {
  state: SafetyState;
  label: string;
  className?: string;
}) {
  const { icon: Icon, ring, fg, bg } = config[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight",
        ring,
        fg,
        bg,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
