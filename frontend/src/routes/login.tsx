import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  getPasskeyLoginOptions,
  loginUser,
  loginVerifyTotp,
  redeemRecoveryCode,
  verifyPasskeyLogin,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/lib/theme";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
import { CosmicAtmosphere } from "@/components/veil/CosmicAtmosphere";
import { TotpInput } from "@/components/veil/TotpInput";
import { cn } from "@/lib/utils";

type LoginStep = "credentials" | "totp" | "recovery";

/** Only same-origin, in-app paths may be used after sign-in (blocks open redirects). */
function isSafeRedirect(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    value.length <= 200
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" && isSafeRedirect(search.redirect)
      ? { redirect: search.redirect }
      : {},
  head: () => ({
    meta: [
      { title: "Sign in — Social Space" },
      {
        name: "description",
        content:
          "Sign in to Social Space with a passkey or your private handle and passphrase. No email or phone number required.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const inputShell =
  "mt-1.5 flex items-center gap-2.5 rounded-2xl border border-border bg-muted/30 px-4 py-3 transition focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20";
const inputClass =
  "flex-1 min-w-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground font-medium";
const labelClass =
  "text-[11px] uppercase tracking-wider text-muted-foreground font-semibold";
const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

function LoginPage() {
  const router = useRouter();
  const redirect = Route.useSearch().redirect ?? "/social";
  const { isAuthenticated, isMounted } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<LoginStep>("credentials");
  const [handle, setHandle] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);

  useEffect(() => {
    setPasskeySupported(
      typeof window !== "undefined" &&
        typeof window.PublicKeyCredential !== "undefined",
    );
  }, []);

  useEffect(() => {
    if (isMounted && isAuthenticated) router.history.push(redirect);
  }, [isMounted, isAuthenticated, router, redirect]);

  const run = async (label: string, task: () => Promise<void>) => {
    setIsBusy(true);
    setError("");
    setStatus(label);
    try {
      await task();
      router.history.push(redirect);
    } catch (err: unknown) {
      if (err instanceof MfaPending) return; // second factor step takes over
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Sign-in failed. Please try again.",
      );
    } finally {
      setIsBusy(false);
      setStatus("");
    }
  };

  const signInWithPasskey = () =>
    run("Waiting for your device…", async () => {
      const { sessionToken, ...options } = await getPasskeyLoginOptions();
      const assertion = await startAuthentication({ optionsJSON: options });
      await verifyPasskeyLogin(assertion, sessionToken);
    });

  const signInWithPassphrase = (event: FormEvent) => {
    event.preventDefault();
    if (!handle || !passphrase || isBusy) return;
    void run("Verifying credentials…", async () => {
      const result = await loginUser(handle, passphrase);
      setPassphrase("");
      if (result.mfaRequired) {
        setChallengeToken(result.challengeToken);
        setStep("totp");
        throw new MfaPending();
      }
    });
  };

  const submitTotp = (code: string) =>
    run("Checking code…", async () => {
      await loginVerifyTotp(challengeToken, code);
    });

  const submitRecovery = (event: FormEvent) => {
    event.preventDefault();
    if (!handle || !recoveryCode || !newPassphrase || isBusy) return;
    void run("Recovering account…", async () => {
      await redeemRecoveryCode(handle, recoveryCode, newPassphrase);
      setNewPassphrase("");
      setRecoveryCode("");
    });
  };

  const backToCredentials = () => {
    setError("");
    setStep("credentials");
    setChallengeToken("");
  };

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="cosmic-theme relative min-h-dvh w-full overflow-x-hidden bg-background text-foreground">
      <CosmicAtmosphere />

      <header className="relative z-10 flex items-center justify-between gap-4 px-4 sm:px-10 py-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <SocialSpaceEmblem className="h-8 w-8 transition-transform group-hover:scale-105" />
          <span className="font-bold tracking-tight text-foreground">
            Social Space
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            className="h-9 w-9 rounded-full border border-border bg-card/70 flex items-center justify-center text-foreground hover:bg-muted transition cursor-pointer"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <Link
            to="/onboarding"
            className="hidden sm:inline-flex rounded-full border border-border bg-card/70 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            Create handle
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-4 sm:px-10 lg:grid-cols-12 lg:gap-16 lg:pt-10">
        {/* Brand story — desktop only */}
        <section className="hidden lg:col-span-6 lg:flex lg:flex-col lg:gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Private by design
          </span>
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            Welcome back to{" "}
            <span className="bg-gradient-to-r from-amber-500 to-amber-300 bg-clip-text text-transparent">
              your quiet corner.
            </span>
          </h1>
          <ul className="mt-2 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <Fingerprint
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
                aria-hidden="true"
              />
              Sign in in one tap with Face ID, Touch ID or Windows Hello.
            </li>
            <li className="flex gap-3">
              <ShieldCheck
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
                aria-hidden="true"
              />
              Two-factor authentication and recovery codes protect your account.
            </li>
            <li className="flex gap-3">
              <KeyRound
                className="mt-0.5 h-5 w-5 shrink-0 text-blue-500"
                aria-hidden="true"
              />
              No email, phone number or ID is ever requested.
            </li>
          </ul>
        </section>

        {/* Form card */}
        <section className="lg:col-span-6 flex w-full justify-center lg:justify-end">
          <div className="w-full max-w-md rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_0_60px_-12px_rgba(245,158,11,0.22)] backdrop-blur-2xl sm:p-9">
            <AnimatePresence mode="wait" initial={false}>
              {step === "credentials" && (
                <motion.div
                  key="credentials"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={transition}
                  className="space-y-6"
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                      Sign in
                    </p>
                    <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                      Access your space
                    </h2>
                  </div>

                  {passkeySupported && (
                    <button
                      type="button"
                      onClick={signInWithPasskey}
                      disabled={isBusy}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Fingerprint className="h-5 w-5" aria-hidden="true" />
                      Continue with passkey
                    </button>
                  )}

                  {passkeySupported && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      or use your passphrase
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <form
                    className="space-y-5"
                    onSubmit={signInWithPassphrase}
                    noValidate
                  >
                    <div>
                      <label htmlFor="login-handle" className={labelClass}>
                        Handle
                      </label>
                      <div className={inputShell}>
                        <span
                          className="font-mono text-muted-foreground"
                          aria-hidden="true"
                        >
                          @
                        </span>
                        <input
                          id="login-handle"
                          name="handle"
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          autoFocus={!passkeySupported}
                          value={handle}
                          onChange={(e) =>
                            setHandle(
                              e.target.value
                                .replace(/[^a-z0-9-]/gi, "")
                                .toLowerCase(),
                            )
                          }
                          placeholder="quiet-linen"
                          maxLength={32}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="login-passphrase" className={labelClass}>
                        Passphrase
                      </label>
                      <div className={inputShell}>
                        <KeyRound
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <input
                          id="login-passphrase"
                          name="passphrase"
                          type={showPassphrase ? "text" : "password"}
                          autoComplete="current-password"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="Your passphrase"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassphrase((v) => !v)}
                          aria-label={
                            showPassphrase
                              ? "Hide passphrase"
                              : "Show passphrase"
                          }
                          aria-pressed={showPassphrase}
                          className="rounded-lg p-1 text-muted-foreground hover:text-foreground transition cursor-pointer"
                        >
                          {showPassphrase ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <ErrorLine message={error} />

                    <button
                      type="submit"
                      disabled={isBusy || !handle || !passphrase}
                      className={primaryButton}
                    >
                      {isBusy ? status || "Signing in…" : "Sign in"}
                      {!isBusy && (
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </form>

                  <div className="flex flex-col gap-3 border-t border-border pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      to="/onboarding"
                      className="text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
                    >
                      New here? Create a handle
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setStep("recovery");
                      }}
                      className="inline-flex items-center gap-1.5 text-left text-amber-700 underline underline-offset-4 hover:text-amber-600 dark:text-amber-400 cursor-pointer"
                    >
                      <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                      Lost access? Use a recovery code
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "totp" && (
                <motion.div
                  key="totp"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={transition}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      Two-factor check
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Enter the 6-digit code from your authenticator app.
                    </p>
                  </div>
                  <TotpInput
                    onSubmit={submitTotp}
                    isLoading={isBusy}
                    error={error}
                  />
                  <BackButton
                    onClick={backToCredentials}
                    label="Back to sign in"
                  />
                </motion.div>
              )}

              {step === "recovery" && (
                <motion.form
                  key="recovery"
                  onSubmit={submitRecovery}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={transition}
                  className="space-y-5"
                  noValidate
                >
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      Recover your account
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Use one unused recovery code, then choose a new
                      passphrase.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="recovery-handle" className={labelClass}>
                      Handle
                    </label>
                    <div className={inputShell}>
                      <span
                        className="font-mono text-muted-foreground"
                        aria-hidden="true"
                      >
                        @
                      </span>
                      <input
                        id="recovery-handle"
                        autoComplete="username"
                        value={handle}
                        onChange={(e) =>
                          setHandle(
                            e.target.value
                              .replace(/[^a-z0-9-]/gi, "")
                              .toLowerCase(),
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="recovery-code" className={labelClass}>
                      Recovery code
                    </label>
                    <div className={inputShell}>
                      <input
                        id="recovery-code"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={recoveryCode}
                        onChange={(e) =>
                          setRecoveryCode(e.target.value.toLowerCase())
                        }
                        placeholder="word-word-word-word"
                        className={cn(inputClass, "font-mono text-sm")}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="recovery-new-pass" className={labelClass}>
                      New passphrase
                    </label>
                    <div className={inputShell}>
                      <input
                        id="recovery-new-pass"
                        type="password"
                        autoComplete="new-password"
                        value={newPassphrase}
                        onChange={(e) => setNewPassphrase(e.target.value)}
                        placeholder="A strong new passphrase"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <ErrorLine message={error} />
                  <button
                    type="submit"
                    disabled={
                      isBusy || !handle || !recoveryCode || !newPassphrase
                    }
                    className={primaryButton}
                  >
                    {isBusy ? status || "Recovering…" : "Recover account"}
                  </button>
                  <BackButton
                    onClick={backToCredentials}
                    label="Back to sign in"
                  />
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300"
    >
      <AlertTriangle
        className="mt-px h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      />
      <span>{message}</span>
    </p>
  );
}

function BackButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition cursor-pointer"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

/** Internal signal: credentials accepted, second factor required. */
class MfaPending extends Error {}
