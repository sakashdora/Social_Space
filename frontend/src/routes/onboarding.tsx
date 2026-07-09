import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Shuffle,
  ShieldCheck,
  KeyRound,
  Fingerprint,
  AlertTriangle,
  Copy,
  EyeOff,
  Eye,
  RefreshCw,
} from "lucide-react";
import { VeilGlyph } from "@/components/veil/VeilGlyph";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { motion, AnimatePresence } from "framer-motion";
import {
  registerUser,
  loginUser,
  loginVerifyTotp,
  getPasskeyLoginOptions,
  verifyPasskeyLogin,
} from "@/lib/api";
import { ThemeToggle } from "@/components/veil/ThemeToggle";
import { cn } from "@/lib/utils";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

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
      { property: "og:description", content: "Choose a handle. Nothing else required." },
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

// ─── Entropy meter helper ─────────────────────────────────────────────────────
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

function entropyLabel(bits: number): { label: string; color: string; pct: number } {
  if (bits < 30) return { label: "Very weak", color: "var(--danger)", pct: 10 };
  if (bits < 45) return { label: "Weak", color: "#f59e0b", pct: 28 };
  if (bits < 60) return { label: "Moderate", color: "#eab308", pct: 55 };
  if (bits < 80) return { label: "Strong", color: "#22c55e", pct: 80 };
  return { label: "Very strong", color: "var(--safe)", pct: 100 };
}

// ─── TOTP Input component ─────────────────────────────────────────────────────
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
      <div className="flex items-center gap-2 px-4 py-3 input-surface">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="flex-1 bg-transparent text-lg tracking-widest outline-none placeholder:text-muted-foreground/50"
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--veil-glow)] px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
      >
        {isLoading ? "Verifying…" : "Verify Code"}
      </button>
    </div>
  );
}

// ─── Recovery code display grid ────────────────────────────────────────────────
function RecoveryCodeGrid({ codes, onCopyAll }: { codes: string[]; onCopyAll: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    onCopyAll();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {codes.map((code, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border bg-white/5 dark:bg-black/40 px-3 py-2"
          >
            <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <span className="font-mono text-xs text-[color:var(--veil-glow)] select-all">
              {code}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={handleCopy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white/5 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy all codes"}
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
function Onboarding() {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("");
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

  // Recovery codes (shown once after registration)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);

  // MFA step
  const [mfaChallengeToken, setMfaChallengeToken] = useState("");
  const [showMfaStep, setShowMfaStep] = useState(false);
  const [mfaError, setMfaError] = useState("");

  // Recovery code login flow (appears only after a failed login)
  const [loginFailed, setLoginFailed] = useState(false);
  const [showRecoveryLogin, setShowRecoveryLogin] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryNewPass, setRecoveryNewPass] = useState("");

  const entropy = shannonEntropy(passphrase);
  const { label: entropyLbl, color: entropyColor, pct: entropyPct } = entropyLabel(entropy);

  const REG_STEPS = [
    "Choose a handle",
    "Age assurance",
    "Set passphrase",
    "Recovery codes",
    "Passkey (optional)",
  ];

  // ─── Passkey login ─────────────────────────────────────────────────────────
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

  // ─── Passphrase login ──────────────────────────────────────────────────────
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

  // ─── Recovery code redemption ──────────────────────────────────────────────
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

  // ─── Registration submit ───────────────────────────────────────────────────
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

  // ─── Passkey setup (optional, step 4) ────────────────────────────────────
  const handlePasskeySetup = async () => {
    const { getPasskeyRegisterOptions, verifyPasskeyRegistration } = await import("@/lib/api");
    setIsLoading(true);
    setError("");
    try {
      const options = await getPasskeyRegisterOptions();
      const credential = await startRegistration({ optionsJSON: options });
      await verifyPasskeyRegistration(credential, "My first passkey");
      navigate({ to: "/social" });
    } catch (err: any) {
      // WebAuthn user cancellation — don't treat as a hard error
      const cancelled =
        err?.name === "NotAllowedError" ||
        err?.message?.toLowerCase().includes("cancelled") ||
        err?.message?.toLowerCase().includes("user denied");
      setError(
        cancelled
          ? "Passkey setup was skipped. You can add one anytime in Profile → Passkeys."
          : "Passkey setup failed. You can try again later in Profile → Passkeys.",
      );
      // Still proceed to /social after a short delay so the user reads the message
      setTimeout(() => navigate({ to: "/social" }), 2500);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Recovery codes step ───────────────────────────────────────────────────
  const RecoveryCodesStep = () => (
    <motion.div
      key="s3"
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.35 }}
      className="max-w-xl"
    >
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Save your recovery codes.</h1>
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
        <p className="text-sm text-amber-300">
          <strong>
            Losing both your passphrase and these codes means permanent, unrecoverable account loss.
          </strong>{" "}
          There is no reset mechanism — no email, no phone, no support team can help. Store these
          somewhere safe.
        </p>
      </div>

      <FrostedPanel className="mt-6 p-5 space-y-4">
        <p className="text-xs text-muted-foreground">
          These 8 recovery codes are shown <strong>exactly once</strong>. Each code can be used once
          to regain access and set a new passphrase. Store them offline (printed paper, password
          manager).
        </p>
        <RecoveryCodeGrid codes={recoveryCodes} onCopyAll={() => setCodesCopied(true)} />

        <label className="flex cursor-pointer items-start gap-3 pt-2 border-t border-border">
          <div className="shrink-0 mt-0.5">
            <input
              type="checkbox"
              id="codes-acknowledged"
              checked={codesAcknowledged}
              onChange={(e) => setCodesAcknowledged(e.target.checked)}
              className="peer sr-only"
            />
            <span className="grid h-5 w-5 place-items-center rounded-md border border-border bg-white/5 dark:bg-black/30 transition peer-checked:border-[color:var(--veil-glow)] peer-checked:bg-[color:var(--veil-glow)]/20">
              {codesAcknowledged && <Check className="h-3.5 w-3.5 text-[color:var(--veil-glow)]" />}
            </span>
          </div>
          <span className="text-sm leading-relaxed">
            I have saved these codes securely. I understand that losing both my passphrase and these
            codes means <strong>permanent, unrecoverable loss</strong> of my account.
          </span>
        </label>
      </FrostedPanel>
    </motion.div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <VeilGlyph className="h-5 w-5 text-[color:var(--veil-glow)]" />
          <span className="font-serif text-xl">Social Space</span>
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/" className="text-xs text-muted-foreground transition hover:text-foreground">
            Cancel
          </Link>
        </div>
      </div>

      {/* Step indicators */}
      {!isLogin && step < 3 && (
        <div className="mt-16 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
          {REG_STEPS.slice(0, 3).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5 sm:gap-3">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-medium transition ${
                  i < step
                    ? "border-[color:var(--veil-glow)]/60 bg-[color:var(--veil-glow)]/10 text-[color:var(--veil-glow)]"
                    : i === step
                      ? "border-white/40 text-foreground"
                      : "border-white/10"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("hidden sm:inline", i === step && "inline text-foreground")}>
                {s}
              </span>
              {i < 2 && <span className="mx-1.5 sm:mx-3 h-px w-4 sm:w-8 bg-border" />}
            </div>
          ))}
        </div>
      )}

      <div className="mt-14 flex-1">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ─── LOGIN FLOW ──────────────────────────────────────────── */}
          {isLogin && !showMfaStep && !showRecoveryLogin && (
            <motion.div
              key="login"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Enter the Veil.</h1>
              <p className="mt-4 text-muted-foreground">
                Enter your handle and passphrase to sign in.
              </p>

              <FrostedPanel className="mt-8 p-5 space-y-4">
                {/* Passkey-first login */}
                <button
                  id="passkey-login-btn"
                  onClick={handlePasskeyLogin}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--veil-glow)]/30 bg-[color:var(--veil-glow)]/5 px-4 py-3 text-sm font-medium text-[color:var(--veil-glow)] transition hover:bg-[color:var(--veil-glow)]/10 disabled:opacity-40"
                >
                  <Fingerprint className="h-4 w-4" />
                  Sign in with passkey
                </button>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-white/10" />
                  or use passphrase
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Handle
                  </label>
                  <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                    <span className="text-muted-foreground select-none">@</span>
                    <input
                      autoFocus
                      id="login-handle"
                      value={loginHandle}
                      onChange={(e) =>
                        setLoginHandle(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())
                      }
                      placeholder="quiet-linen"
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Passphrase
                  </label>
                  <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="login-passphrase"
                      type={showLoginPass ? "text" : "password"}
                      value={loginPassphrase}
                      onChange={(e) => setLoginPassphrase(e.target.value)}
                      placeholder="your passphrase"
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                      onKeyDown={(e) => e.key === "Enter" && handlePassphraseLogin()}
                    />
                    <button
                      onClick={() => setShowLoginPass((v) => !v)}
                      className="text-muted-foreground"
                    >
                      {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <button
                    onClick={() => setIsLogin(false)}
                    className="text-xs text-muted-foreground transition hover:text-foreground underline underline-offset-4"
                  >
                    Create a new account
                  </button>
                  {/* Recovery code link — only appears after a failed attempt */}
                  {loginFailed && (
                    <button
                      onClick={() => setShowRecoveryLogin(true)}
                      className="text-xs text-amber-400 transition hover:text-amber-300 underline underline-offset-4"
                    >
                      Use a recovery code
                    </button>
                  )}
                </div>
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── TOTP MFA STEP ─────────────────────────────────────── */}
          {isLogin && showMfaStep && (
            <motion.div
              key="mfa"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl">Two-factor check.</h1>
              <p className="mt-4 text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
              <FrostedPanel className="mt-8 p-5">
                <TotpInput onSubmit={handleMfaVerify} isLoading={isLoading} error={mfaError} />
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── RECOVERY CODE LOGIN ──────────────────────────────── */}
          {isLogin && showRecoveryLogin && (
            <motion.div
              key="recovery-login"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl">Recover your account.</h1>
              <p className="mt-4 text-muted-foreground">
                Enter one of your recovery codes and choose a new passphrase. The code will be
                invalidated after use.
              </p>
              <FrostedPanel className="mt-8 p-5 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Recovery code
                  </label>
                  <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                    <input
                      id="recovery-code-input"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toLowerCase())}
                      placeholder="word-word-word-word"
                      className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    New passphrase
                  </label>
                  <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                    <input
                      id="recovery-new-pass"
                      type="password"
                      value={recoveryNewPass}
                      onChange={(e) => setRecoveryNewPass(e.target.value)}
                      placeholder="strong new passphrase"
                      className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
                <button
                  onClick={handleRecoveryLogin}
                  disabled={isLoading || !recoveryCode || !recoveryNewPass}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--veil-glow)] px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  {isLoading ? "Recovering…" : "Recover account"}
                </button>
                <button
                  onClick={() => setShowRecoveryLogin(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  ← Back to sign in
                </button>
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── REGISTRATION: Step 0 — Handle ───────────────────── */}
          {!isLogin && step === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                Pick a handle. That&rsquo;s the whole signup.
              </h1>
              <p className="mt-4 text-muted-foreground">
                No email. No phone. Nothing that ties this account to the rest of your life.
              </p>
              <FrostedPanel className="mt-8 p-5">
                <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Handle
                </label>
                <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                  <span className="text-muted-foreground select-none">@</span>
                  <input
                    autoFocus
                    id="register-handle"
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())
                    }
                    placeholder="quiet-linen"
                    className="flex-1 min-w-0 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() =>
                      setHandle(suggestions[Math.floor(Math.random() * suggestions.length)])
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 dark:bg-white/[0.03] px-2 sm:px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground shrink-0"
                  >
                    <Shuffle className="h-3 w-3" />
                    <span className="hidden sm:inline">Suggest</span>
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setHandle(s)}
                      className="rounded-full border border-border bg-white/5 dark:bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      @{s}
                    </button>
                  ))}
                </div>
                <div className="mt-4 pt-2">
                  <button
                    onClick={() => setIsLogin(true)}
                    className="text-xs text-muted-foreground transition hover:text-foreground underline underline-offset-4"
                  >
                    Already have an account? Log in
                  </button>
                </div>
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── REGISTRATION: Step 1 — Age ───────────────────────── */}
          {!isLogin && step === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                We check you&rsquo;re old enough — without seeing an ID.
              </h1>
              <FrostedPanel className="mt-8 flex items-start gap-4 p-5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--safe)]" />
                <div>
                  <p className="text-sm font-medium">On-device estimation</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirms you&rsquo;re over the required age. That&rsquo;s the only signal we
                    keep.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="grid h-5 w-5 place-items-center rounded-md border border-border bg-white/5 dark:bg-black/30 transition peer-checked:border-[color:var(--veil-glow)] peer-checked:bg-[color:var(--veil-glow)]/20">
                      {ageConfirmed && (
                        <Check className="h-3.5 w-3.5 text-[color:var(--veil-glow)]" />
                      )}
                    </span>
                    <span className="text-sm">Run the on-device check and continue.</span>
                  </label>
                </div>
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── REGISTRATION: Step 2 — Passphrase ───────────────── */}
          {!isLogin && step === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                Set your passphrase.
              </h1>
              <p className="mt-4 text-muted-foreground">
                This is your primary credential — choose something memorable but strong. It must
                have at least ~60 bits of entropy.
              </p>
              <FrostedPanel className="mt-8 p-5 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Passphrase
                  </label>
                  <div className="mt-2 flex items-center gap-2 px-4 py-3 input-surface">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="register-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="long, strong, memorable"
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => setShowPassphrase((v) => !v)}
                      className="text-muted-foreground"
                    >
                      {showPassphrase ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {/* Entropy meter */}
                  {passphrase && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${entropyPct}%`, background: entropyColor }}
                        />
                      </div>
                      <p className="text-xs" style={{ color: entropyColor }}>
                        {entropyLbl} · {Math.round(entropy)} bits
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tip: use a long phrase or mix of unrelated words. Your passphrase is hashed with
                  Argon2id and checked against known breach databases — the full passphrase is never
                  sent to a third party.
                </p>
              </FrostedPanel>
            </motion.div>
          )}

          {/* ─── REGISTRATION: Step 3 — Recovery codes ───────────── */}
          {!isLogin && step === 3 && <RecoveryCodesStep />}

          {/* ─── REGISTRATION: Step 4 — Passkey setup ────────────── */}
          {!isLogin && step === 4 && (
            <motion.div
              key="s4"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35 }}
              className="max-w-xl"
            >
              <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                Add a passkey for faster sign-in.
              </h1>
              <p className="mt-4 text-muted-foreground">
                Passkeys use your device biometrics (Face ID, fingerprint, PIN) — no passphrase
                needed next time. This step is optional but recommended.
              </p>
              <FrostedPanel className="mt-8 p-5 space-y-4">
                <button
                  id="setup-passkey-btn"
                  onClick={handlePasskeySetup}
                  disabled={isLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[color:var(--veil-glow)] px-5 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
                >
                  <Fingerprint className="h-4 w-4" />
                  {isLoading ? "Setting up…" : "Register a passkey"}
                </button>
                <button
                  onClick={() => navigate({ to: "/social" })}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition underline underline-offset-4"
                >
                  Skip for now
                </button>
              </FrostedPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="mt-10 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white/5 dark:bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {!isLogin && step < 3 && (
          <button
            onClick={async () => {
              if (step === 2) {
                if (entropy < 60) {
                  setError("Passphrase is too weak. Aim for at least 60 bits of entropy.");
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
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {isLoading ? "Creating account…" : step === 2 ? "Create account" : "Continue"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {!isLogin && step === 3 && (
          <button
            onClick={() => {
              setError("");
              setStep(4);
            }}
            disabled={!codesAcknowledged}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            I&rsquo;ve saved my codes
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {isLogin && !showMfaStep && !showRecoveryLogin && (
          <button
            id="login-submit-btn"
            onClick={handlePassphraseLogin}
            disabled={isLoading || loginHandle.length < 3 || loginPassphrase.length < 3}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {isLoading ? "Signing in…" : "Enter Veil"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
