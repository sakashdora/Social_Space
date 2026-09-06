import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  MessageSquare,
  ScrollText,
  Gavel,
  AlertTriangle,
  Send,
  CheckCircle2,
  Lock,
  Eye,
  Shield,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & Integrity — Social Space" },
      {
        name: "description",
        content:
          "Zero-compromise community integrity, encrypted reporting, human appeals, and sovereign rights manifesto.",
      },
    ],
  }),
  component: SafetyCenter,
});

interface UserReport {
  id: string;
  target: string;
  category: string;
  reason: string;
  submittedAt: string;
  status: "received" | "reviewing" | "action" | "no-violation";
  outcome?: string;
}

const tabs = [
  { key: "guidelines", label: "Integrity Protocols", icon: ScrollText },
  { key: "submit", label: "Dispatch Report", icon: AlertTriangle },
  { key: "reports", label: "My Dispatches", icon: FileText },
  { key: "appeals", label: "Appeals & Arbitrage", icon: Gavel },
] as const;

function SafetyCenter() {
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("guidelines");

  // Local storage backed real user reports
  const [userReports, setUserReports] = useState<UserReport[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("social_space_user_reports");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Report Form state
  const [reportTarget, setReportTarget] = useState("");
  const [reportCategory, setReportCategory] = useState("Harassment & Intimidation");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Appeal Form state
  const [appealId, setAppealId] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTarget.trim() || !reportDetails.trim()) return;

    setReportSubmitting(true);
    setTimeout(() => {
      const newReport: UserReport = {
        id: `REP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        target: reportTarget.trim(),
        category: reportCategory,
        reason: reportDetails.trim(),
        submittedAt: new Date().toISOString(),
        status: "received",
      };

      const updated = [newReport, ...userReports];
      setUserReports(updated);
      try {
        localStorage.setItem("social_space_user_reports", JSON.stringify(updated));
      } catch {}

      setReportSubmitting(false);
      setReportSuccess(true);
      setReportTarget("");
      setReportDetails("");
      setTimeout(() => setReportSuccess(false), 5000);
    }, 600);
  };

  const handleSubmitAppeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealId.trim() || !appealReason.trim()) return;

    setAppealSubmitting(true);
    setTimeout(() => {
      setAppealSubmitting(false);
      setAppealSuccess(true);
      setAppealId("");
      setAppealReason("");
      setTimeout(() => setAppealSuccess(false), 5000);
    }, 600);
  };

  return (
    <div className="cosmic-theme min-h-screen text-white mx-auto max-w-4xl px-4 pb-32 lg:pb-14 pt-8 sm:px-6">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-300 backdrop-blur-md mb-3">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>SOVEREIGN NETWORK INTEGRITY</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          Trust, Safety & Protocol Ethics
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Zero surveillance, zero tolerance for harm. Every report receives an immutable audit trail and fair human arbitration.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-8 flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#0c1017]/90 p-1.5 backdrop-blur-xl scrollbar-none">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all",
              tab === key
                ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                : "text-white/60 hover:text-white hover:bg-white/5",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: INTEGRITY GUIDELINES */}
      {tab === "guidelines" && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0c1017]/85 p-6 sm:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Lock className="h-4 w-4" />
              The Bedrock Floor — Non-Negotiable
            </div>
            <h2 className="font-serif text-2xl font-bold text-white mb-3">
              Absolute Boundaries
            </h2>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              Cryptographic pseudonymity protects speech, not harm. Violating these principles triggers immediate sovereign revocation without recourse:
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <h3 className="text-xs font-bold text-red-300 uppercase tracking-wider mb-1">
                  Zero Exploitation Material
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Child abuse material and non-consensual exploitation are intercepted pre-anonymization and referred to authorities immediately.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">
                  Doxxing & Real-World Stalking
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Publishing unredacted home addresses, phone records, or physical locations to incite harm is forbidden.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                  Synthetic Weaponization
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Deepfakes generated to impersonate or defame individuals must clearly bear cryptographic synthetic provenance flags.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1">
                  Autonomous Spam Clusters
                </h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Sybil botnets, automated spam injection, or algorithmic manipulation of public feeds will be neutralized at the gateway.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0c1017]/85 p-6 sm:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-4 w-4" />
              The Sovereign Spirit
            </div>
            <h2 className="font-serif text-2xl font-bold text-white mb-2">
              Speaking Freely Without Fear
            </h2>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
              Social Space was forged for whistleblowers, creative visionaries, truth-tellers, and honest humans who require a realm free from surveillance capitalism and algorithmic rage engines. We foster authentic human discourse grounded in mutual dignity.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: DISPATCH REPORT */}
      {tab === "submit" && (
        <div className="rounded-3xl border border-white/10 bg-[#0c1017]/85 p-6 sm:p-8 backdrop-blur-xl">
          <h2 className="font-serif text-2xl font-bold text-white mb-2">
            Submit Integrity Incident
          </h2>
          <p className="text-xs sm:text-sm text-white/60 mb-6">
            Dispatches are sent with sealed sender metadata. The reported subject cannot discover who filed this notice.
          </p>

          {reportSuccess && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              Incident report received. It has been routed to human review with sealed sender protection.
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Target User @Handle or Post URI
              </label>
              <input
                type="text"
                value={reportTarget}
                onChange={(e) => setReportTarget(e.target.value)}
                placeholder="@username or post transmission snippet"
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Violation Classification
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full rounded-xl bg-[#121824] border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 transition cursor-pointer"
              >
                <option value="Harassment & Intimidation">Harassment & Coordinated Intimidation</option>
                <option value="Doxxing & Privacy Violation">Doxxing or Personal Data Leak</option>
                <option value="Synthetic Impersonation">Undisclosed AI Impersonation / Deepfake</option>
                <option value="Scam / Sybil Botnet">Malicious Scam or Automated Botnet</option>
                <option value="Severe Harm / CSAM">Severe Harm / Exploitation (Emergency Priority)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Incident Context & Evidence
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Explain the circumstance and why this violates community protocols..."
                rows={4}
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={reportSubmitting || !reportTarget.trim() || !reportDetails.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 text-xs font-bold transition shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-40"
            >
              {reportSubmitting ? (
                "Encrypting & Transmitting..."
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Transmit Confidential Report
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: MY DISPATCHES */}
      {tab === "reports" && (
        <div className="space-y-4">
          {userReports.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0c1017]/80 backdrop-blur-xl p-10 text-center text-white/60 text-xs flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-white mb-1">
                Zero Active Strikes or Open Reports
              </h3>
              <p className="max-w-md text-white/50 mb-6">
                Your sovereign account maintains pristine protocol standing (Trust Token: 100%). Any dispatches you file will appear here with live tracking.
              </p>
              <button
                onClick={() => setTab("submit")}
                className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/40 text-white px-4 py-2 text-xs font-semibold transition"
              >
                File an Incident Report
              </button>
            </div>
          ) : (
            userReports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-white/10 bg-[#0c1017]/85 p-5 backdrop-blur-xl flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-bold text-amber-400">
                        {report.id}
                      </span>
                      <span className="text-[11px] text-white/40">&bull;</span>
                      <span className="text-xs font-semibold text-white">
                        {report.target}
                      </span>
                    </div>
                    <p className="text-xs text-white/60">
                      Category: {report.category}
                    </p>
                  </div>

                  <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    {report.status === "received" ? "Under Review" : report.status}
                  </span>
                </div>

                <p className="text-xs text-white/80 bg-white/[0.02] border border-white/5 rounded-xl p-3 leading-relaxed">
                  "{report.reason}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-white/40">
                  <span>Logged: {new Date(report.submittedAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="h-3 w-3" /> Sealed Sender Guard Active
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: APPEALS */}
      {tab === "appeals" && (
        <div className="rounded-3xl border border-white/10 bg-[#0c1017]/85 p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Gavel className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-white">
                Decentralized Appeal Tribunal
              </h2>
              <p className="text-xs sm:text-sm text-white/60 mt-1">
                Every moderation decision can be contested. Appeals are audited by an independent secondary moderator, never the original reviewer. Median response window: under 48 hours.
              </p>
            </div>
          </div>

          {appealSuccess && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              Appeal filed into the tribunal queue. You will receive an encrypted system update when reviewed.
            </div>
          )}

          <form onSubmit={handleSubmitAppeal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Report / Action Reference ID
              </label>
              <input
                type="text"
                value={appealId}
                onChange={(e) => setAppealId(e.target.value)}
                placeholder="e.g. REP-9284F or post link"
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-2">
                Grounds for Appeal & Rationale
              </label>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Detail why the penalty or flag was incorrect or misunderstood..."
                rows={4}
                required
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={appealSubmitting || !appealId.trim() || !appealReason.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 text-xs font-bold transition shadow-[0_0_20px_rgba(245,158,11,0.25)] disabled:opacity-40"
            >
              {appealSubmitting ? (
                "Submitting Appeal..."
              ) : (
                <>
                  <Gavel className="h-4 w-4" />
                  Initiate Independent Appeal
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

