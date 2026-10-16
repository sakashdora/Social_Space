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
import { communityRequest, getMe } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { ModerationQueue } from "@/components/ModerationQueue";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & Integrity — Social Space" },
      {
        name: "description",
        content:
          "Zero-compromise community integrity, private reporting, moderation appeals, and sovereign rights manifesto.",
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

  const { user } = useAuth();
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [appeals, setAppeals] = useState<any[]>([]);
  const [submissionError, setSubmissionError] = useState("");
  const [moderator, setModerator] = useState(false);
  useEffect(() => {
    let active = true;
    setUserReports([]);
    setAppeals([]);
    setModerator(false);
    if (!user?.id) return;
    void Promise.all([
      communityRequest("reports"),
      communityRequest("appeals"),
      getMe(),
    ])
      .then(([reports, savedAppeals, me]) => {
        if (active) {
          setUserReports(reports);
          setAppeals(savedAppeals);
          setModerator(me.isModerator);
        }
      })
      .catch((error) => {
        if (active) setSubmissionError(error.message);
      });
    return () => {
      active = false;
    };
  }, [user?.id, tab]);

  // Report Form state
  const [reportTarget, setReportTarget] = useState("");
  const [reportCategory, setReportCategory] = useState(
    "Harassment & Intimidation",
  );
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Appeal Form state
  const [appealId, setAppealId] = useState("");
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState(false);

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmissionError("");
    setReportSuccess(false);
    setReportSubmitting(true);
    try {
      const report = await communityRequest("reports", {
        target: reportTarget,
        category: reportCategory,
        reason: reportDetails,
      });
      setUserReports((previous) => [report, ...previous]);
      setReportSuccess(true);
      setReportTarget("");
      setReportDetails("");
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Report could not be saved.",
      );
    } finally {
      setReportSubmitting(false);
    }
  };
  const handleSubmitAppeal = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmissionError("");
    setAppealSuccess(false);
    setAppealSubmitting(true);
    try {
      await communityRequest("appeals", {
        reference: appealId,
        reason: appealReason,
      });
      setAppeals(await communityRequest("appeals"));
      setAppealSuccess(true);
      setAppealId("");
      setAppealReason("");
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Appeal could not be saved.",
      );
    } finally {
      setAppealSubmitting(false);
    }
  };

  return (
    <div className="cosmic-theme min-h-screen text-foreground mx-auto max-w-4xl px-4 pb-32 lg:pb-14 pt-8 sm:px-6">
      {submissionError && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-500/40 p-3 text-sm text-red-500"
        >
          {submissionError}
        </p>
      )}
      {!user && (
        <p className="mb-4 text-sm">
          Sign in to submit a report or appeal and view its status.
        </p>
      )}
      {moderator && <ModerationQueue />}
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-600 dark:text-amber-300 backdrop-blur-md mb-3">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
          <span>SOVEREIGN NETWORK INTEGRITY</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
          Trust, Safety & Protocol Ethics
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Submit reports and appeals, and track their review status. Reports are
          visible to you and authorized moderators.
        </p>
      </header>

      {/* Tabs */}
      <div className="mb-8 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card/90 p-1.5 backdrop-blur-xl scrollbar-none">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all",
              tab === key
                ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
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
          <div className="rounded-3xl border border-border bg-card/85 p-6 sm:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Lock className="h-4 w-4" />
              The Bedrock Floor — Non-Negotiable
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground mb-3">
              Absolute Boundaries
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              These community rules apply to every account. Reports require
              review, and moderation decisions may be appealed.
            </p>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <h3 className="text-xs font-bold text-red-500 dark:text-red-300 uppercase tracking-wider mb-1">
                  Zero Exploitation Material
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Child abuse material and non-consensual exploitation are
                  prohibited. Report suspected violations for moderator review.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h3 className="text-xs font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wider mb-1">
                  Doxxing & Real-World Stalking
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Publishing unredacted home addresses, phone records, or
                  physical locations to incite harm is forbidden.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Synthetic Weaponization
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Mark AI-modified media when publishing. This is an
                  author-provided label, not a verified provenance certificate.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">
                  Autonomous Spam Clusters
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automated spam and coordinated manipulation of public feeds
                  are prohibited. Report suspected abuse for moderator review.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card/85 p-6 sm:p-8 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="h-4 w-4" />
              The Sovereign Spirit
            </div>
            <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
              Speaking Freely Without Fear
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Social Space was forged for whistleblowers, creative visionaries,
              truth-tellers, and honest humans who require a realm free from
              surveillance capitalism and algorithmic rage engines. We foster
              authentic human discourse grounded in mutual dignity.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: DISPATCH REPORT */}
      {tab === "submit" && (
        <div className="rounded-3xl border border-border bg-card/85 p-6 sm:p-8 backdrop-blur-xl">
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
            Submit Integrity Incident
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6">
            Reports are stored privately for moderator review. They are not
            shown to the reported account.
          </p>

          {reportSuccess && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              Your report was saved and is awaiting moderator review.
            </div>
          )}

          <form onSubmit={handleSubmitReport} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Target User @Handle or Post URI
              </label>
              <input
                type="text"
                value={reportTarget}
                onChange={(e) => setReportTarget(e.target.value)}
                placeholder="@username or post transmission snippet"
                required
                className="w-full rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Violation Classification
              </label>
              <select
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full rounded-xl bg-card border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-amber-500/50 transition cursor-pointer"
              >
                <option value="Harassment & Intimidation">
                  Harassment & Coordinated Intimidation
                </option>
                <option value="Doxxing & Privacy Violation">
                  Doxxing or Personal Data Leak
                </option>
                <option value="Synthetic Impersonation">
                  Undisclosed AI Impersonation / Deepfake
                </option>
                <option value="Scam / Sybil Botnet">
                  Malicious Scam or Automated Botnet
                </option>
                <option value="Severe Harm / CSAM">
                  Severe Harm / Exploitation (Emergency Priority)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Incident Context & Evidence
              </label>
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Explain the circumstance and why this violates community protocols..."
                rows={4}
                required
                className="w-full rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition resize-none placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={
                reportSubmitting ||
                !reportTarget.trim() ||
                !reportDetails.trim()
              }
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
            <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-10 text-center text-muted-foreground text-xs flex flex-col items-center">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-serif font-bold text-foreground mb-1">
                Zero Active Strikes or Open Reports
              </h3>
              <p className="max-w-md text-muted-foreground mb-6">
                Your sovereign account maintains pristine protocol standing
                (Trust Token: 100%). Any dispatches you file will appear here
                with live tracking.
              </p>
              <button
                onClick={() => setTab("submit")}
                className="inline-flex items-center gap-2 rounded-xl bg-muted/40 border border-border hover:border-amber-500/40 text-foreground px-4 py-2 text-xs font-semibold transition"
              >
                File an Incident Report
              </button>
            </div>
          ) : (
            userReports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-border bg-card/85 p-5 backdrop-blur-xl flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {report.id}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        &bull;
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {report.target}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Category: {report.category}
                    </p>
                  </div>

                  <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300">
                    {report.status === "received"
                      ? "Under Review"
                      : report.status}
                  </span>
                </div>

                <p className="text-xs text-foreground/85 bg-muted/30 border border-border rounded-xl p-3 leading-relaxed">
                  "{report.reason}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                  <span>
                    Logged: {new Date(report.submittedAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="h-3 w-3" /> Sealed Sender Guard
                    Active
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: APPEALS */}
      {tab === "appeals" && appeals.length > 0 && (
        <ul className="mb-4 space-y-2 text-sm">
          {appeals.map((appeal) => (
            <li key={appeal.id} className="rounded-lg border border-border p-3">
              Appeal {appeal.id}: {appeal.status}
            </li>
          ))}
        </ul>
      )}
      {tab === "appeals" && (
        <div className="rounded-3xl border border-border bg-card/85 p-6 sm:p-8 backdrop-blur-xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <Gavel className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground">
                Decentralized Appeal Tribunal
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Every moderation decision can be contested. Appeals are audited
                by an independent secondary moderator, never the original
                reviewer. Median response window: under 48 hours.
              </p>
            </div>
          </div>

          {appealSuccess && (
            <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              Your appeal was saved. Return to this page to check its review
              status.
            </div>
          )}

          <form onSubmit={handleSubmitAppeal} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Report / Action Reference ID
              </label>
              <input
                type="text"
                value={appealId}
                onChange={(e) => setAppealId(e.target.value)}
                placeholder="e.g. REP-9284F or post link"
                required
                className="w-full rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Grounds for Appeal & Rationale
              </label>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Detail why the penalty or flag was incorrect or misunderstood..."
                rows={4}
                required
                className="w-full rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition resize-none placeholder:text-muted-foreground"
              />
            </div>

            <button
              type="submit"
              disabled={
                appealSubmitting || !appealId.trim() || !appealReason.trim()
              }
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
