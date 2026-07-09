import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, FileText, MessageSquare, ScrollText, Gavel } from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { reports, type Report } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety Center — Veil" },
      {
        name: "description",
        content:
          "Track your reports, read the community guidelines, and appeal decisions. Every report gets a status — no dead ends.",
      },
      { property: "og:title", content: "Safety Center — Veil" },
      { property: "og:description", content: "Report. Track. Appeal. Never a dead end." },
    ],
  }),
  component: SafetyCenter,
});

const tabs = [
  { key: "reports", label: "My Reports", icon: FileText },
  { key: "guidelines", label: "Community Guidelines", icon: ScrollText },
  { key: "appeals", label: "Appeals", icon: Gavel },
] as const;

function SafetyCenter() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("reports");

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 lg:pb-10 pt-10 sm:px-6 lg:pt-14">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Safety Center</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">
          Report, track, appeal — in plain language.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Reporting a piece of content should feel like relief, not another form. Every report gets a status. Every decision can be appealed.
        </p>
      </header>

      <div className="mb-6 flex gap-1 rounded-full border border-white/5 bg-white/[0.02] p-1 text-sm">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 transition",
              tab === key ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "reports" && (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}

      {tab === "guidelines" && (
        <FrostedPanel className="space-y-6 p-8">
          <div>
            <h3 className="font-serif text-2xl">The floor.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              These are non-negotiable. Break them and your Trust Token is revoked — no exceptions, no warnings.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>&bull; No child sexual abuse material. Detected pre-anonymization, reported to authorities.</li>
              <li>&bull; No targeted harassment, doxxing, or coordinated intimidation.</li>
              <li>&bull; No non-consensual intimate imagery.</li>
              <li>&bull; No incitement to violence.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-2xl">The spirit.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Veil exists for people who need to speak without cost. Do not use it as a laundering path — for fake media, for hate, or for harm to others hiding here for the same reasons you are.
            </p>
          </div>
        </FrostedPanel>
      )}

      {tab === "appeals" && (
        <FrostedPanel className="p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[color:var(--veil-glow)]">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-serif text-2xl">Every decision can be challenged.</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Appeals are read by a second human moderator, not the one who made the initial decision. Median response time is under 48 hours.
              </p>
              <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110">
                Start an appeal
              </button>
            </div>
          </div>
        </FrostedPanel>
      )}
    </div>
  );
}

const statusMap: Record<Report["status"], { label: string; color: string }> = {
  received: { label: "Received", color: "var(--muted-foreground)" },
  reviewing: { label: "Reviewing", color: "var(--warn)" },
  action: { label: "Action taken", color: "var(--safe)" },
  "no-violation": { label: "No violation", color: "var(--muted-foreground)" },
};

function ReportCard({ report }: { report: Report }) {
  const s = statusMap[report.status];
  const steps: Report["status"][] = ["received", "reviewing", report.status === "no-violation" ? "no-violation" : "action"];
  const currentIdx = steps.indexOf(report.status);

  return (
    <FrostedPanel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{report.target}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {report.reason} · Submitted {report.submitted}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium"
          style={{
            color: s.color,
            background: `color-mix(in oklab, ${s.color} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${s.color} 35%, transparent)`,
          }}
        >
          {s.label}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-2">
        {steps.map((step, i) => {
          const done = i <= currentIdx;
          return (
            <div key={step} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border text-[10px] transition",
                  done
                    ? "border-[color:var(--veil-glow)]/50 bg-[color:var(--veil-glow)]/15 text-[color:var(--veil-glow)]"
                    : "border-white/10 text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-[11px]", done ? "text-foreground" : "text-muted-foreground")}>
                {statusMap[step].label}
              </span>
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    "ml-1 h-px flex-1",
                    i < currentIdx ? "bg-[color:var(--veil-glow)]/40" : "bg-white/10",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {report.outcome && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--safe)]" />
          {report.outcome}
        </p>
      )}

      {report.appealable && (
        <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--veil-glow)] transition hover:brightness-110">
          <MessageSquare className="h-3 w-3" />
          Appeal this decision
        </button>
      )}
    </FrostedPanel>
  );
}
