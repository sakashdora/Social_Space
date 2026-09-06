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
import {
  registerUser,
  loginUser,
  loginVerifyTotp,
  getPasskeyLoginOptions,
  verifyPasskeyLogin,
} from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
import { CosmicAtmosphere } from "@/components/veil/CosmicAtmosphere";
import { cn } from "@/lib/utils";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";


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

// ─── TOTP Input Component ────────────────────────────────────────────────────
function TotpInput({
  onSubmit,
  isLoading,
  error,
}: {
  onSubmit: (code: string) => void;
  isLoading: boolean;
  error: string;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-3 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
        <KeyRound className="h-4 w-4 text-white/40" />
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="000000"
          className="flex-1 bg-transparent text-lg tracking-widest text-white outline-none placeholder:text-white/20 font-mono"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
      <button
        onClick={() => onSubmit(code)}
        disabled={isLoading || code.length !== 6}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 px-5 py-3 text-sm font-semibold text-black transition-all disabled:opacity-40 shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer"
      >
        {isLoading ? "Verifying…" : "Verify Code"}
      </button>
    </div>
  );
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
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5"
          >
            <span className="text-[10px] text-white/40 w-4 shrink-0 font-mono">
              {i + 1}.
            </span>
            <span className="font-mono text-xs text-amber-300 select-all font-medium">
              {code}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-4 py-2.5 text-sm text-white/80 hover:text-white transition cursor-pointer"
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <Copy className="h-4 w-4 text-white/60" />
        )}
        {copied ? "Copied to clipboard!" : "Copy all codes"}
      </button>
    </div>
  );
}

// ─── Main Onboarding Component ───────────────────────────────────────────────
export function Onboarding() {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("quiet-linen");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [loginHandle, setLoginHandle] = useState("");
  const [loginPassphrase, setLoginPassphrase] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();

  // Recovery codes (shown once after registration)

  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);

  // MFA step
  const [mfaChallengeToken, setMfaChallengeToken] = useState("");
  const [showMfaStep, setShowMfaStep] = useState(false);
  const [mfaError, setMfaError] = useState("");

  // Recovery code login flow
  const [loginFailed, setLoginFailed] = useState(false);
  const [showRecoveryLogin, setShowRecoveryLogin] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryNewPass, setRecoveryNewPass] = useState("");

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

  // ─── Passkey Login ─────────────────────────────────────────────────────────
  const handlePasskeyLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await getPasskeyLoginOptions();
      const { sessionToken, ...options } = response;
      const assertion = await startAuthentication({ optionsJSON: options });
      await verifyPasskeyLogin(assertion, sessionToken);
      navigate({ to: "/social" });
    } catch (err: any) {
      setError(err.message || "Passkey login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Passphrase Login ──────────────────────────────────────────────────────
  const handlePassphraseLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await loginUser(loginHandle, loginPassphrase);
      if (result.mfaRequired) {
        setMfaChallengeToken(result.challengeToken);
        setShowMfaStep(true);
        setIsLoading(false);
        return;
      }
      navigate({ to: "/social" });
    } catch (err: any) {
      setLoginFailed(true);
      setError(err.message || "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (code: string) => {
    setIsLoading(true);
    setMfaError("");
    try {
      await loginVerifyTotp(mfaChallengeToken, code);
      navigate({ to: "/social" });
    } catch (err: any) {
      setMfaError(err.message || "Invalid code.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Recovery Code Redemption ──────────────────────────────────────────────
  const handleRecoveryLogin = async () => {
    const { redeemRecoveryCode } = await import("@/lib/api");
    setIsLoading(true);
    setError("");
    try {
      await redeemRecoveryCode(loginHandle, recoveryCode, recoveryNewPass);
      navigate({ to: "/social" });
    } catch (err: any) {
      setError(err.message || "Recovery failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Registration Submit ───────────────────────────────────────────────────
  const handleRegister = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await registerUser(handle, passphrase);
      if (result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
      }
      setStep(3); // Recovery codes step
    } catch (err: any) {
      setError(err.message || "Registration failed.");
      setStep(2); // Back to passphrase step on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError("");
    if (isLogin) {
      if (showMfaStep || showRecoveryLogin) {
        setShowMfaStep(false);
        setShowRecoveryLogin(false);
      } else {
        setIsLogin(false);
      }
    } else {
      if (step > 0) {
        setStep((s) => s - 1);
      } else {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
        } else {
          navigate({ to: "/" });
        }
      }
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
    const chosen = pool[Math.floor(Math.random() * pool.length)] || suggestions[0];
    setHandle(chosen);
  };

  return (
    <div className="cosmic-theme relative min-h-screen w-full bg-[#06070a] text-white flex flex-col justify-between overflow-x-hidden select-text">
      {/* ─── Ambient Cosmic Background ─────────────────────────────────── */}
      <CosmicAtmosphere />

      {/* ─── Top Header & Progress Stepper ─────────────────────────────── */}
      <header className="relative z-10 w-full px-6 sm:px-12 py-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Brand Logo & Tagline */}
          <Link to="/" className="flex items-center gap-3.5 group">
            <SocialSpaceEmblem className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-sans text-xl font-bold tracking-tight text-white">
                Social Space
              </span>
              <span className="text-[9px] tracking-[0.22em] text-amber-200/60 uppercase font-semibold">
                REAL PEOPLE · REAL CONNECTIONS
              </span>
            </div>
          </Link>

          {/* Stepper Navigation (visible during 3-step registration) */}
          {!isLogin && step < 3 && (
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
                            ? "border border-amber-400 bg-amber-400/15 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                            : isCompleted
                              ? "border border-amber-400/50 bg-amber-400/10 text-amber-300"
                              : "border border-white/20 text-white/40 bg-white/[0.02]",
                        )}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : s.num}
                      </span>
                      <span
                        className={cn(
                          "text-xs transition-colors duration-300 whitespace-nowrap",
                          isActive
                            ? "font-medium text-amber-300"
                            : isCompleted
                              ? "text-white/70"
                              : "text-white/40",
                        )}
                      >
                        {s.label}
                      </span>
                    </div>

                    {idx < STEPS_NAV.length - 1 && (
                      <span
                        className={cn(
                          "h-px w-8 sm:w-12 transition-colors duration-300",
                          step > idx ? "bg-amber-400/50" : "bg-white/15",
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
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              className="h-9 w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
            <Link
              to="/"
              className="text-xs text-white/60 hover:text-white transition-colors duration-200 font-medium"
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
            {!isLogin && step === 0 && (
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <span>Join Our Community</span>
                  </div>

                  {/* Punchy Headline */}
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Pick a handle.
                    <br />
                    <span className="text-[#3b82f6]">That’s the whole</span>{" "}
                    signup.
                  </h1>

                  {/* Subtitle */}
                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    No email. No phone. Nothing that ties this account to the
                    rest of your life.
                  </p>

                  {/* 3 Key Pillars */}
                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Private
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Your identity, your choice.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Fast
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Get started in seconds.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Anonymous
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Just you, your space.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Glassmorphic Handle Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative overflow-hidden">
                    {/* Ambient Amber Glow inside Card corner */}
                    <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

                    {/* Card Header */}
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      CREATE YOUR HANDLE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 flex items-center gap-2">
                      Choose a unique handle
                      <Sparkles className="h-5 w-5 text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
                      This will be your identity in Social Space. Keep it simple,
                      creative, or completely random — it’s up to you.
                    </p>

                    {/* Handle Input Field */}
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-3 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all shadow-inner">
                      <span className="text-white/40 text-lg font-mono select-none pl-1">
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
                        className="flex-1 bg-transparent text-white font-medium placeholder:text-white/20 text-base sm:text-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={pickRandomSuggestion}
                        className="rounded-full border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer hover:shadow-[0_0_12px_rgba(245,158,11,0.3)]"
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
                                ? "border border-amber-400/60 bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                                : "border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-amber-400/40 text-white/70 hover:text-white",
                            )}
                          >
                            @{s}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer link to Login */}
                    <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-white/50">
                        Already have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setIsLogin(true)}
                          className="text-amber-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Log in <ArrowRight className="h-3 w-3 inline" />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 1: AGE ASSURANCE
               ════════════════════════════════════════════════════════════ */}
            {!isLogin && step === 1 && (
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                    <span>Privacy-Preserving Verification</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Age assurance.
                    <br />
                    <span className="text-[#3b82f6]">Zero ID</span> required.
                  </h1>

                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    We verify you are old enough directly on your device. No
                    government ID, no photo uploads, and no identity databases.
                  </p>

                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        On-Device
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Zero data leaves your browser.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Immediate
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Confirmed in milliseconds.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Zero Traces
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        No biometric retention.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      STEP 02 — AGE ASSURANCE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 flex items-center gap-2">
                      Age check confirmation
                      <ShieldCheck className="h-6 w-6 text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
                      Social Space requires users to be of legal age. Our zero-knowledge
                      on-device assurance confirms this without storing or transmitting personal data.
                    </p>

                    <div className="mt-8 rounded-2xl border border-white/10 bg-[#080b11]/90 p-5 flex items-start gap-4">
                      <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-400" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          On-device cryptographic check
                        </p>
                        <p className="mt-1 text-xs text-white/60 leading-relaxed">
                          Only a binary pass/fail cryptographic signal is registered with your handle.
                        </p>

                        <label className="mt-5 flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={ageConfirmed}
                            onChange={(e) => setAgeConfirmed(e.target.checked)}
                            className="peer sr-only"
                          />
                          <span className="grid h-6 w-6 place-items-center rounded-lg border border-white/20 bg-white/5 transition-all peer-checked:border-amber-400 peer-checked:bg-amber-400/20 peer-checked:shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                            {ageConfirmed && (
                              <Check className="h-4 w-4 text-amber-400" />
                            )}
                          </span>
                          <span className="text-sm text-white font-medium">
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
            {!isLogin && step === 2 && (
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                    <span>Cryptographic Protection</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Set your passphrase.
                    <br />
                    <span className="text-[#3b82f6]">Uncrackable</span> security.
                  </h1>

                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    Your passphrase is your master key. Hashed locally with Argon2id,
                    it protects your identity without backdoors or recovery emails.
                  </p>

                  <div className="mt-10 grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
                    <div className="space-y-1">
                      <Shield className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Argon2id
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Memory-hard hashing.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Zap className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Shannon Entropy
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        Live strength analysis.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <Feather className="h-5 w-5 text-blue-400 stroke-[1.8]" />
                      <h4 className="font-semibold text-white text-sm mt-2">
                        Self-Sovereign
                      </h4>
                      <p className="text-xs text-white/50 leading-snug">
                        You hold the only keys.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      STEP 03 — SET PASSPHRASE
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 flex items-center gap-2">
                      Choose a passphrase
                      <KeyRound className="h-6 w-6 text-amber-400 inline shrink-0" />
                    </h2>

                    <p className="text-xs sm:text-sm text-white/60 mt-3 leading-relaxed">
                      Use several words or a memorable sentence. Aim for at least 60 bits
                      of entropy.
                    </p>

                    {/* Passphrase Input */}
                    <div className="mt-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-3 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all shadow-inner">
                      <KeyRound className="h-5 w-5 text-white/40 shrink-0" />
                      <input
                        id="register-passphrase"
                        type={showPassphrase ? "text" : "password"}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="long strong memorable phrase"
                        className="flex-1 bg-transparent text-white font-medium placeholder:text-white/20 text-base sm:text-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase((v) => !v)}
                        className="text-white/50 hover:text-white transition cursor-pointer p-1"
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
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${entropyPct}%`,
                              backgroundColor: entropyColor,
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: entropyColor }} className="font-medium">
                            {entropyLbl} ({Math.round(entropy)} bits)
                          </span>
                          <span className="text-white/40">Target: 60+ bits</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-white/50 leading-relaxed">
                      💡 <strong>Tip:</strong> Combining 4 or 5 random words creates an ultra-strong phrase that is easy for you to remember and impossible for machines to crack.
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                STEP 3: RECOVERY CODES
               ════════════════════════════════════════════════════════════ */}
            {!isLogin && step === 3 && (
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-400 w-fit mb-6 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span>Critical Safety Backup</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Save your codes.
                    <br />
                    <span className="text-amber-400">One-time</span> emergency key.
                  </h1>

                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    There are no reset emails or customer support resets. If you ever
                    forget your passphrase, these 8 recovery codes are your only lifeline.
                  </p>

                  <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-xs text-amber-200/80 leading-relaxed flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Permanent loss warning:</strong> Store these codes in a
                      password manager or on printed paper. They are displayed only once.
                    </div>
                  </div>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      BACKUP SECURITY CODES
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 flex items-center gap-2">
                      Your 8 recovery codes
                    </h2>

                    <div className="mt-6">
                      <RecoveryCodeGrid
                        codes={recoveryCodes}
                        onCopyAll={() => setCodesAcknowledged(true)}
                      />
                    </div>

                    <label className="mt-6 flex cursor-pointer items-start gap-3 pt-4 border-t border-white/10">
                      <input
                        type="checkbox"
                        checked={codesAcknowledged}
                        onChange={(e) => setCodesAcknowledged(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="grid h-5 w-5 place-items-center rounded-md border border-white/20 bg-white/5 transition-all peer-checked:border-amber-400 peer-checked:bg-amber-400/20 shrink-0 mt-0.5">
                        {codesAcknowledged && (
                          <Check className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </span>
                      <span className="text-xs text-white/70 leading-relaxed">
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
            {!isLogin && step === 4 && (
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
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Fingerprint className="h-3.5 w-3.5 text-blue-400" />
                    <span>Biometric Authentication</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Add a passkey.
                    <br />
                    <span className="text-[#3b82f6]">Instant access</span> with Face ID.
                  </h1>

                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    Sign in seamlessly using Touch ID, Face ID, or Windows Hello.
                    Passkeys eliminate phishing risks and let you log in with a single touch.
                  </p>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative space-y-6">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      OPTIONAL BIOMETRIC CREDENTIAL
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      Register your device passkey
                    </h2>

                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                      Syncs securely with your device's biometric keychain. You will never need to type your passphrase on this machine.
                    </p>

                    <button
                      onClick={handlePasskeySetup}
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-6 py-3.5 text-sm shadow-[0_0_25px_rgba(245,158,11,0.35)] transition cursor-pointer"
                    >
                      <Fingerprint className="h-5 w-5" />
                      {isLoading ? "Enrolling passkey…" : "Register device passkey"}
                    </button>

                    <button
                      onClick={() => navigate({ to: "/social" })}
                      className="w-full text-center text-xs text-white/50 hover:text-white transition underline underline-offset-4 cursor-pointer"
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
            {isLogin && !showMfaStep && !showRecoveryLogin && (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
              >
                {/* Left Column */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Users className="h-3.5 w-3.5 text-blue-400" />
                    <span>Welcome Back</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
                    Enter Social Space.
                    <br />
                    <span className="text-[#3b82f6]">Your sovereign</span> identity.
                  </h1>

                  <p className="mt-5 text-white/60 text-base sm:text-lg leading-relaxed max-w-lg">
                    Sign in with your biometric passkey or your private handle &
                    passphrase.
                  </p>
                </div>

                {/* Right Card */}
                <div className="lg:col-span-6 flex justify-center lg:justify-end">
                  <div className="w-full max-w-xl rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-7 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] relative space-y-5">
                    <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-amber-400 uppercase">
                      SIGN IN
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      Access your space
                    </h2>

                    {/* Passkey 1-Click Button */}
                    <button
                      id="passkey-login-btn"
                      onClick={handlePasskeyLogin}
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 px-4 py-3 text-sm font-medium text-amber-300 transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    >
                      <Fingerprint className="h-5 w-5" />
                      Sign in with biometric passkey
                    </button>

                    <div className="flex items-center gap-3 text-xs text-white/40">
                      <span className="h-px flex-1 bg-white/10" />
                      or use passphrase
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
                        Handle
                      </label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-2.5 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                        <span className="text-white/40 font-mono">@</span>
                        <input
                          autoFocus
                          id="login-handle"
                          value={loginHandle}
                          onChange={(e) =>
                            setLoginHandle(
                              e.target.value
                                .replace(/[^a-z0-9-]/gi, "")
                                .toLowerCase(),
                            )
                          }
                          placeholder="quiet-linen"
                          className="flex-1 bg-transparent text-white outline-none placeholder:text-white/20 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-white/50 font-medium">
                        Passphrase
                      </label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-2.5 focus-within:border-amber-400/60 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                        <KeyRound className="h-4 w-4 text-white/40" />
                        <input
                          id="login-passphrase"
                          type={showLoginPass ? "text" : "password"}
                          value={loginPassphrase}
                          onChange={(e) => setLoginPassphrase(e.target.value)}
                          placeholder="your passphrase"
                          className="flex-1 bg-transparent text-white outline-none placeholder:text-white/20 font-medium"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handlePassphraseLogin()
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPass((v) => !v)}
                          className="text-white/40 hover:text-white transition"
                        >
                          {showLoginPass ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className="text-white/60 hover:text-white transition underline underline-offset-4 cursor-pointer"
                      >
                        Create new account
                      </button>

                      {loginFailed && (
                        <button
                          type="button"
                          onClick={() => setShowRecoveryLogin(true)}
                          className="text-amber-400 hover:text-amber-300 transition underline underline-offset-4 cursor-pointer"
                        >
                          Use recovery code
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                LOGIN MFA STEP
               ════════════════════════════════════════════════════════════ */}
            {isLogin && showMfaStep && (
              <motion.div
                key="login-mfa"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="max-w-xl mx-auto w-full"
              >
                <div className="rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)]">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Two-factor confirmation
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm text-white/60 leading-relaxed">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                  <div className="mt-6">
                    <TotpInput
                      onSubmit={handleMfaVerify}
                      isLoading={isLoading}
                      error={mfaError}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════════════════
                LOGIN RECOVERY REDEMPTION
               ════════════════════════════════════════════════════════════ */}
            {isLogin && showRecoveryLogin && (
              <motion.div
                key="login-recovery"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="max-w-xl mx-auto w-full"
              >
                <div className="rounded-[28px] border border-amber-500/30 bg-[#0c1017]/85 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)] space-y-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Recover your account
                  </h2>
                  <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                    Enter one of your 8 recovery codes and set a new passphrase.
                  </p>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/50">
                      Recovery code
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-2.5">
                      <input
                        value={recoveryCode}
                        onChange={(e) => setRecoveryCode(e.target.value.toLowerCase())}
                        placeholder="word-word-word-word"
                        className="flex-1 bg-transparent text-white font-mono text-sm outline-none placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-white/50">
                      New passphrase
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#080b11]/90 px-4 py-2.5">
                      <input
                        type="password"
                        value={recoveryNewPass}
                        onChange={(e) => setRecoveryNewPass(e.target.value)}
                        placeholder="strong new passphrase"
                        className="flex-1 bg-transparent text-white outline-none placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleRecoveryLogin}
                    disabled={isLoading || !recoveryCode || !recoveryNewPass}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 px-5 py-3 text-sm font-semibold text-black transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isLoading ? "Recovering…" : "Recover account"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRecoveryLogin(false)}
                    className="w-full text-center text-xs text-white/50 hover:text-white transition underline underline-offset-4 cursor-pointer"
                  >
                    ← Back to standard sign in
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── Bottom Navigation Bar ─────────────────────────────────────── */}
      <footer className="relative z-10 w-full px-6 sm:px-12 py-6 border-t border-white/[0.06] bg-[#06070a]/60 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          {/* Bottom Left Motto with Logo */}
          <div className="flex items-center gap-3">
            <SocialSpaceEmblem className="h-5 w-5 opacity-75" glow={false} />
            <span className="text-xs text-white/40 tracking-wide font-medium">
              Connect · Share · Be Yourself
            </span>
          </div>

          {/* Bottom Right Navigation Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white px-6 py-2.5 text-sm font-medium transition cursor-pointer backdrop-blur-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {/* Action for Step 0, 1, 2 */}
            {!isLogin && step < 3 && (
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
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-8 py-2.5 text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading
                  ? "Creating account…"
                  : step === 2
                    ? "Create account"
                    : "Continue"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {/* Action for Step 3 (Recovery code saved confirmation) */}
            {!isLogin && step === 3 && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(4);
                }}
                disabled={!codesAcknowledged}
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-8 py-2.5 text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98]"
              >
                I’ve saved my codes
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            {/* Action for Login View */}
            {isLogin && !showMfaStep && !showRecoveryLogin && (
              <button
                id="login-submit-btn"
                type="button"
                onClick={handlePassphraseLogin}
                disabled={
                  isLoading || loginHandle.length < 3 || loginPassphrase.length < 3
                }
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-8 py-2.5 text-sm shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98]"
              >
                {isLoading ? "Signing in…" : "Enter Social Space"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
