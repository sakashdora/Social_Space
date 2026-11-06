import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Shield,
  Zap,
  Feather,
  Sparkles,
  Users,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  Copy,
  EyeOff,
  Eye,
  Plus,
  Moon,
  Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { registerUser } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
import { CosmicAtmosphere } from "@/components/veil/CosmicAtmosphere";
import { cn } from "@/lib/utils";
import { startRegistration } from "@simplewebauthn/browser";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — Social Space" },
      {
        name: "description",
        content:
          "Sign up in about a minute. Choose a handle, set a passphrase — no email, no phone, no ID.",
      },
      { property: "og:title", content: "Get started — Social Space" },
      {
        property: "og:description",
        content: "Choose a handle. That's the whole signup.",
      },
    ],
  }),
  component: Onboarding,
});

const suggestions = [
  "slow-orbit",
  "quiet-linen",
  "north-of-here",
  "muted-heron",
  "half-moon",
  "grey-static",
];

// ─── Shannon Entropy Helper ──────────────────────────────────────────────────
function shannonEntropy(str: string): number {
  if (!str) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  return (
    Object.values(freq).reduce((sum, count) => {
      const p = count / len;
      return sum - p * Math.log2(p);
    }, 0) * len
  );
}

function entropyLabel(bits: number): {
  label: string;
  color: string;
  pct: number;
} {
  if (bits < 30) return { label: "Very weak", color: "#ef4444", pct: 15 };
  if (bits < 45) return { label: "Weak", color: "#f59e0b", pct: 35 };
  if (bits < 60) return { label: "Moderate", color: "#eab308", pct: 60 };
  if (bits < 80) return { label: "Strong", color: "#22c55e", pct: 85 };
  return { label: "Very strong", color: "#10b981", pct: 100 };
}

// ─── Recovery Code Display Grid ──────────────────────────────────────────────
function RecoveryCodeGrid({
  codes,
  onCopyAll,
}: {
  codes: string[];
  onCopyAll: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    onCopyAll();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        {codes.map((code, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5"
          >
            <span className="text-[10px] text-muted-foreground w-4 shrink-0 font-mono">
              {i + 1}.
            </span>
            <span className="font-mono text-xs text-amber-600 dark:text-amber-300 select-all font-medium">
              {code}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 hover:bg-muted px-4 py-2.5 text-sm text-foreground transition cursor-pointer"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
        {copied ? "Copied to clipboard!" : "Copy all codes"}
      </button>
    </div>
  );
}

// ─── Main Onboarding Component ───────────────────────────────────────────────
function Onboarding() {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("quiet-linen");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();

  // Recovery codes (shown once after registration)

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);

  const entropy = shannonEntropy(passphrase);
  const {
    label: entropyLbl,
    color: entropyColor,
    pct: entropyPct,
  } = entropyLabel(entropy);

  const STEPS_NAV = [
    { num: 1, label: "Choose a handle" },
    { num: 2, label: "Age assurance" },
    { num: 3, label: "Set passphrase" },
  ];

  // ─── Registration Submit ───────────────────────────────────────────────────
  const handleRegister = async () => {
    setIsLoading(true);
    setError("");
    setLoadingStatus("Verifying breach safety...");
    const timer = setTimeout(() => {
      setLoadingStatus("Deriving sovereign keys...");
    }, 400);

    try {
      const result = await registerUser(handle, passphrase);
      clearTimeout(timer);
      if (result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
      }
      setStep(3); // Recovery codes step
    } catch (err: any) {
      clearTimeout(timer);
      setError(err.message || "Registration failed.");
      setStep(2); // Back to passphrase step on error
    } finally {
      setIsLoading(false);
      setLoadingStatus("");
    }
  };

  const handleBack = () => {
    setError("");
    if (step > 0) {
      setStep((s) => s - 1);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  // ─── Passkey Setup (Step 4) ────────────────────────────────────────────────
  const handlePasskeySetup = async () => {
    const { getPasskeyRegisterOptions, verifyPasskeyRegistration } =
      await import("@/lib/api");
    setIsLoading(true);
    setError("");
    try {
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      await verifyPasskeyRegistration(credential, "My primary passkey");
      navigate({ to: "/social" });
    } catch (err: any) {
      const cancelled =
        err?.name === "NotAllowedError" ||
        err?.message?.toLowerCase().includes("cancelled") ||
        err?.message?.toLowerCase().includes("user denied");
      setError(
        cancelled
          ? "Passkey setup was skipped. You can add one anytime in Profile."
          : "Passkey setup failed. You can try again later in Profile.",
      );
      setTimeout(() => navigate({ to: "/social" }), 2500);
    } finally {
      setIsLoading(false);
    }
  };

  const pickRandomSuggestion = () => {
    const pool = suggestions.filter((s) => s !== handle);
    const chosen =
      pool[Math.floor(Math.random() * pool.length)] || suggestions[0];
    setHandle(chosen);
  };

  return (
    <div className="cosmic-theme relative min-h-screen w-full bg-background text-foreground flex flex-col justify-between overflow-x-hidden select-text">
      {/* ─── Ambient Cosmic Background ─────────────────────────────────── */}
      <CosmicAtmosphere />

      {/* ─── Top Header & Progress Stepper ─────────────────────────────── */}
      <header className="relative z-10 w-full px-6 sm:px-12 py-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Brand Logo & Tagline */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <SocialSpaceEmblem className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-sans text-xl font-bold tracking-tight text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                Social Space
              </span>
              <span className="text-[9px] tracking-[0.22em] text-amber-600/70 dark:text-amber-200/60 uppercase font-semibold">
                REAL PEOPLE · REAL CONNECTIONS
              </span>
            </div>
          </Link>

          {/* Stepper Navigation (visible during 3-step registration) */}
          {step < 3 && (
            <div className="flex items-center gap-3 sm:gap-4 text-xs">
              {STEPS_NAV.map((s, idx) => {
                const isActive = step === idx;
                const isCompleted = step > idx;

                return (
                  <React.Fragment key={s.num}>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-full text-xs font-semibold transition-all duration-300",
                          isActive
                            ? "border border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                            : isCompleted
                              ? "border border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                              : "border border-border text-muted-foreground bg-muted/20",
                        )}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : s.num}
                      </span>
                      <span
                        className={cn(
                          "text-xs transition-colors duration-300 whitespace-nowrap",
                          isActive
                            ? "font-medium text-amber-600 dark:text-amber-300"
                            : isCompleted
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>

                    {idx < STEPS_NAV.length - 1 && (
                      <span
                        className={cn(
                          "h-px w-8 sm:w-12 transition-colors duration-300",
                          step > idx ? "bg-amber-500/50" : "bg-border",
                        )}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Right Action: Sleek circular Theme toggle + Cancel */}
          <div className="flex items-center gap-4 self-end md:self-auto">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="h-9 w-9 rounded-full bg-muted/50 hover:bg-muted border border-border flex items-center justify-center text-foreground transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
            <Link
              to="/"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Main Content Body ─────────────────────────────────────────── */}
      <main className="relative z-10 w-full flex-1 flex items-center px-6 sm:px-12 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl w-full">
          {/* Global Error Notification */}
          {error && (
            <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300 backdrop-blur-md flex items-start gap-3 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ════════════════════════════════════════════════════════════
                STEP 0: CHOOSE A HANDLE (EXACT REFERENCE DESIGN)
               ════════════════════════════════════════════════════════════ */}
            {step === 0 && (
              <motion.div
                key="step-0-handle"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column: Hero & Value Propositions */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Join Our Community</span>
                  </div>

                  {/* Punchy Headline */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Pick a handle.
                    <br />
                    <span className="text-blue-600 dark:text-[#3b82f6]">
                      That’s the whole
                    </span>{" "}
                    signup.
                  </h1>

                  {/* Subtitle */}
                  <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
                    No email. No phone. Nothing that ties this account to the
                    rest of your life.
                  </p>

                  {/* 3 Key Pillars */}
                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-border">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Private
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Your identity, your choice.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Fast
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Get started in seconds.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Anonymous
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Just you, your space.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Glassmorphic Handle Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-card/90 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] relative overflow-hidden">
                    {/* Ambient Amber Glow inside Card corner */}
                    <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

                    {/* Card Header */}
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-600 dark:text-amber-400 uppercase">
                      CREATE YOUR HANDLE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-2 flex items-center gap-2">
                      Choose a unique handle
                      <Sparkles className="h-5 w-5 text-amber-500 dark:text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed">
                      This will be your identity in Social Space. Keep it
                      simple, creative, or completely random — it’s up to you.
                    </p>

                    {/* Handle Input Field */}
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                      <span className="text-muted-foreground text-lg font-mono select-none pl-1">
                        @
                      </span>
                      <input
                        autoFocus
                        id="register-handle"
                        value={handle}
                        onChange={(e) =>
                          setHandle(
                            e.target.value
                              .replace(/[^a-z0-9-]/gi, "")
                              .toLowerCase(),
                          )
                        }
                        placeholder="quiet-linen"
                        className="min-w-0 flex-1 bg-transparent text-foreground font-medium placeholder:text-muted-foreground text-base sm:text-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={pickRandomSuggestion}
                        className="shrink-0 whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer hover:shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Suggest</span>
                      </button>
                    </div>

                    {/* Suggestion Chips */}
                    <div className="mt-4 flex flex-wrap gap-2 sm:gap-2.5">
                      {suggestions.map((s) => {
                        const isSelected = handle === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setHandle(s)}
                            className={cn(
                              "rounded-full px-4 py-1.5 text-xs font-mono transition-all cursor-pointer",
                              isSelected
                                ? "border border-amber-400/60 bg-amber-400/15 text-amber-600 dark:text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                                : "border border-border bg-muted/30 hover:bg-muted hover:border-amber-400/40 text-muted-foreground hover:text-foreground",
                            )}
                          >
                            @{s}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer link to Login */}
                    <div className="mt-8 pt-4 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                          to="/login"
                          className="text-amber-600 dark:text-amber-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Log in <ArrowRight className="h-3 w-3 inline" />
                        </Link>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 1: AGE ASSURANCE
               ════════════════════════════════════════════════════════════ */}
            {step === 1 && (
              <motion.div
                key="step-1-age"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Privacy-Preserving Verification</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Age assurance.
                    <br />
                    <span className="text-blue-600 dark:text-[#3b82f6]">
                      Zero ID
                    </span>{" "}
                    required.
                  </h1>

                  <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
                    We verify you are old enough directly on your device. No
                    government ID, no photo uploads, and no identity databases.
                  </p>

                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-border">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        On-Device
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Zero data leaves your browser.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Immediate
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Confirmed in milliseconds.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Zero Traces
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        No biometric retention.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-card/90 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-600 dark:text-amber-400 uppercase">
                      STEP 02 — AGE ASSURANCE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-2 flex items-center gap-2">
                      Age check confirmation
                      <ShieldCheck className="h-6 w-6 text-amber-500 dark:text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed">
                      Social Space requires users to be of legal age. Our
                      zero-knowledge on-device assurance confirms this without
                      storing or transmitting personal data.
                    </p>

                    <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-5 flex items-start gap-4">
                      <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          On-device cryptographic check
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          Only a binary pass/fail cryptographic signal is
                          registered with your handle.
                        </p>

                        <label className="mt-5 flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={ageConfirmed}
                            onChange={(e) => setAgeConfirmed(e.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="grid h-6 w-6 place-items-center rounded-lg border border-border bg-muted/30 transition-all peer-checked:border-amber-500 peer-checked:bg-amber-500/20 peer-checked:shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                            {ageConfirmed && (
                              <Check className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                            )}
                          </span>
                          <span className="text-sm text-foreground font-medium">
                            I confirm I am of legal age to join Social Space.
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 2: SET PASSPHRASE
               ════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <motion.div
                key="step-2-passphrase"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <KeyRound className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Cryptographic Protection</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Set your passphrase.
                    <br />
                    <span className="text-blue-600 dark:text-[#3b82f6]">
                      Uncrackable
                    </span>{" "}
                    security.
                  </h1>

                  <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
                    Your passphrase is your master key. It is stored only as a
                    salted, one-way hash, so it protects your identity without
                    backdoors or recovery emails.
                  </p>

                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-border">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        PBKDF2-SHA256
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        600,000 iterations with a unique salt.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Shannon Entropy
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        Live strength analysis.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-600 dark:text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-foreground text-sm mt-2">
                        Self-Sovereign
                      </h4>
                      <p className="text-xs text-muted-foreground leading-snug">
                        You hold the only keys.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-card/90 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-600 dark:text-amber-400 uppercase">
                      STEP 03 — SET PASSPHRASE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-2 flex items-center gap-2">
                      Choose a passphrase
                      <KeyRound className="h-6 w-6 text-amber-500 dark:text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground mt-3 leading-relaxed">
                      Use several words or a memorable sentence. Aim for at
                      least 60 bits of entropy.
                    </p>

                    {/* Passphrase Input */}
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all shadow-inner">
                      <KeyRound className="h-5 w-5 text-muted-foreground shrink-0" />
                      <input
                        id="register-passphrase"
                        type={showPassphrase ? "text" : "password"}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="long strong memorable phrase"
                        className="min-w-0 flex-1 bg-transparent text-foreground font-medium placeholder:text-muted-foreground text-base sm:text-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase((v) => !v)}
                        className="text-muted-foreground hover:text-foreground transition cursor-pointer p-1"
                      >
                        {showPassphrase ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Shannon Entropy Bar */}
                    {passphrase && (
                      <div className="mt-3 space-y-1.5">
                        <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${entropyPct}%`,
                              backgroundColor: entropyColor,
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span
                            style={{ color: entropyColor }}
                            className="font-medium"
                          >
                            {entropyLbl} ({Math.round(entropy)} bits)
                          </span>
                          <span className="text-muted-foreground">
                            Target: 60+ bits
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
                      💡 <strong>Tip:</strong> Combining 4 or 5 random words
                      creates an ultra-strong phrase that is easy for you to
                      remember and impossible for machines to crack.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 3: RECOVERY CODES
               ════════════════════════════════════════════════════════════ */}
            {step === 3 && (
              <motion.div
                key="step-3-recovery"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400 w-fit mb-6 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    <span>Critical Safety Backup</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Save your codes.
                    <br />
                    <span className="text-amber-600 dark:text-amber-400">
                      One-time
                    </span>{" "}
                    emergency key.
                  </h1>

                  <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
                    There are no reset emails or customer support resets. If you
                    ever forget your passphrase, these 8 recovery codes are your
                    only lifeline.
                  </p>

                  <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 text-xs text-foreground/80 leading-relaxed flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-foreground">
                        Permanent loss warning:
                      </strong>{" "}
                      Store these codes in a password manager or on printed
                      paper. They are displayed only once.
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-border bg-card/90 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.15)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-600 dark:text-amber-400 uppercase">
                      BACKUP SECURITY CODES
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-2 flex items-center gap-2">
                      Your 8 recovery codes
                    </h2>

                    <div className="mt-6">
                      <RecoveryCodeGrid
                        codes={recoveryCodes}
                        onCopyAll={() => setCodesAcknowledged(true)}
                      />
                    </div>

                    <label className="mt-6 flex cursor-pointer items-start gap-3 pt-4 border-t border-border">
                      <input
                        type="checkbox"
                        checked={codesAcknowledged}
                        onChange={(e) => setCodesAcknowledged(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="grid h-5 w-5 place-items-center rounded-md border border-border bg-muted/40 transition-all peer-checked:border-amber-500 peer-checked:bg-amber-500/20 shrink-0 mt-0.5">
                        {codesAcknowledged && (
                          <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        I have saved these recovery codes in a secure place and
                        understand they cannot be retrieved later.
                      </span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 4: PASSKEY SETUP (OPTIONAL)
               ════════════════════════════════════════════════════════════ */}
            {step === 4 && (
              <motion.div
                key="step-4-passkey"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-500 dark:text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Fingerprint className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Biometric Authentication</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                    Add a passkey.
                    <br />
                    <span className="text-blue-600 dark:text-blue-400">
                      Instant access
                    </span>{" "}
                    with Face ID.
                  </h1>

                  <p className="mt-5 text-muted-foreground text-base sm:text-lg leading-relaxed max-w-lg">
                    Sign in seamlessly using Touch ID, Face ID, or Windows
                    Hello. Passkeys eliminate phishing risks and let you log in
                    with a single touch.
                  </p>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-border bg-card/90 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.15)] relative space-y-6">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-600 dark:text-amber-400 uppercase">
                      OPTIONAL BIOMETRIC CREDENTIAL
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                      Register your device passkey
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Syncs securely with your device's biometric keychain. You
                      will never need to type your passphrase on this machine.
                    </p>

                    <button
                      onClick={handlePasskeySetup}
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-6 py-3.5 text-sm shadow-[0_0_25px_rgba(245,158,11,0.35)] transition cursor-pointer"
                    >
                      <Fingerprint className="h-5 w-5" />
                      {isLoading
                        ? "Enrolling passkey…"
                        : "Register device passkey"}
                    </button>

                    <button
                      onClick={() => navigate({ to: "/social" })}
                      className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-4 cursor-pointer"
                    >
                      Skip for now and enter Social Space →
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                LOGIN VIEW
               ════════════════════════════════════════════════════════════ */}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Bottom Navigation Bar ─────────────────────────────────────── */}
      <footer
        className="relative z-10 w-full px-4 sm:px-12 py-4 sm:py-6 border-t border-border bg-card/85 backdrop-blur-md"
        style={{
          paddingBottom:
            "max(1rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)))",
        }}
      >
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          {/* Bottom Left Motto with Logo */}
          <div className="hidden sm:flex items-center gap-3">
            <SocialSpaceEmblem className="h-5 w-5 opacity-75" glow={false} />
            <span className="text-xs text-muted-foreground tracking-wide font-medium">
              Connect · Share · Be Yourself
            </span>
          </div>

          {/* Bottom Right Navigation Actions */}
          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 hover:bg-muted text-foreground px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-medium transition cursor-pointer backdrop-blur-sm active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {/* Action for Step 0, 1, 2 */}
            {step < 3 && (
              <button
                type="button"
                onClick={async () => {
                  if (step === 2) {
                    if (entropy < 60) {
                      setError(
                        "Passphrase is too weak. Aim for at least 60 bits of entropy.",
                      );
                      return;
                    }
                    await handleRegister();
                  } else {
                    setStep((s) => s + 1);
                  }
                }}
                disabled={
                  isLoading ||
                  (step === 0 && handle.length < 3) ||
                  (step === 1 && !ageConfirmed) ||
                  (step === 2 && (passphrase.length < 12 || entropy < 60))
                }
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-6 sm:px-8 py-2.5 text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading
                  ? loadingStatus || "Creating account…"
                  : step === 2
                    ? "Create account"
                    : "Continue"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {/* Action for Step 3 (Recovery code saved confirmation) */}
            {step === 3 && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(4);
                }}
                disabled={!codesAcknowledged}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-6 sm:px-8 py-2.5 text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98]"
              >
                I’ve saved my codes
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {/* Action for Step 4 (Passkey Setup / Enter Space) */}
            {step === 4 && (
              <button
                type="button"
                onClick={() => navigate({ to: "/social" })}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-6 sm:px-8 py-2.5 text-xs sm:text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer active:scale-[0.98]"
              >
                Enter Social Space
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
