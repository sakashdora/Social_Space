import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState } from "react";
import { ArrowRight, ArrowLeft, Check, Shuffle, ShieldCheck, KeyRound } from "lucide-react";
import { VeilGlyph } from "@/components/veil/VeilGlyph";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { motion, AnimatePresence } from "framer-motion";
import { registerUser, loginUser } from "@/lib/api";
import { ThemeToggle } from "@/components/veil/ThemeToggle";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Get started — Social Space" },
      {
        name: "description",
        content:
          "Sign up in about a minute. Choose a handle, confirm you're old enough — no email, no phone, no ID.",
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

const words = [
  "solar", "wind", "echo", "shadow", "silent", "quiet", "forest", "river", "mountain", "ocean",
  "breeze", "whisper", "orbit", "comet", "star", "night", "morning", "aurora", "frost", "grain"
];

function generatePassphrase() {
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const w3 = words[Math.floor(Math.random() * words.length)];
  return `${w1}-${w2}-${w3}`;
}

function Onboarding() {
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [passphrase] = useState(() => generatePassphrase());
  const [isLogin, setIsLogin] = useState(false);
  const [loginPassphrase, setLoginPassphrase] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const steps = isLogin ? ["Sign In"] : ["Choose a handle", "Age assurance", "Trust Token"];

  const handleAuthSubmit = async () => {
    setIsLoading(true);
    setError("");
    try {
      if (isLogin) {
        await loginUser(handle, loginPassphrase);
        navigate({ to: "/social" });
      } else {
        await registerUser(handle, passphrase);
        navigate({ to: "/social" });
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10">
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

      <div className="mt-16 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
        {steps.map((s, i) => (
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
            <span className={cn("hidden sm:inline", i === step && "inline text-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1.5 sm:mx-3 h-px w-4 sm:w-8 bg-white/10" />}
          </div>
        ))}
      </div>

      <div className="mt-14 flex-1">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isLogin ? (
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
                Enter your handle and recovery passphrase to sign in to your pseudonym.
              </p>
              <FrostedPanel className="mt-8 p-5 space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Handle</label>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <span className="text-muted-foreground">@</span>
                    <input
                      autoFocus
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                      placeholder="quiet-linen"
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recovery Passphrase</label>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="password"
                      value={loginPassphrase}
                      onChange={(e) => setLoginPassphrase(e.target.value)}
                      placeholder="solar-wind-echo"
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsLogin(false)}
                    className="text-xs text-muted-foreground transition hover:text-foreground underline underline-offset-4"
                  >
                    Need to create a new account? Sign up
                  </button>
                </div>
              </FrostedPanel>
            </motion.div>
          ) : (
            <>
              {step === 0 && (
                <motion.div
                  key="s0"
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.35 }}
                  className="max-w-xl"
                >
                  <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Pick a handle. That&rsquo;s the whole signup.</h1>
                  <p className="mt-4 text-muted-foreground">
                    No email. No phone. Nothing that ties this account to the rest of your life.
                  </p>
                  <FrostedPanel className="mt-8 p-5">
                    <label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Handle</label>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <span className="text-muted-foreground">@</span>
                      <input
                        autoFocus
                        value={handle}
                        onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                        placeholder="quiet-linen"
                        className="flex-1 min-w-0 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50"
                      />
                      <button
                        onClick={() => setHandle(suggestions[Math.floor(Math.random() * suggestions.length)])}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 sm:px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground shrink-0"
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
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground"
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

              {step === 1 && (
                <motion.div
                  key="s1"
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.35 }}
                  className="max-w-xl"
                >
                  <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                    We check you&rsquo;re old enough — without ever seeing an ID.
                  </h1>
                  <p className="mt-4 text-muted-foreground">
                    Age assurance runs on your device. No date of birth is stored. No ID document is uploaded. The result is a single yes/no that never leaves this screen.
                  </p>
                  <FrostedPanel className="mt-8 flex items-start gap-4 p-5">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--safe)]" />
                    <div>
                      <p className="text-sm font-medium">On-device estimation</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Confirms you&rsquo;re over the required age. That&rsquo;s the entire signal we keep.
                      </p>
                      <label className="mt-4 flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={ageConfirmed}
                          onChange={(e) => setAgeConfirmed(e.target.checked)}
                          className="peer sr-only"
                        />
                        <span className="grid h-5 w-5 place-items-center rounded-md border border-white/20 bg-black/30 transition peer-checked:border-[color:var(--veil-glow)] peer-checked:bg-[color:var(--veil-glow)]/20">
                          {ageConfirmed && <Check className="h-3.5 w-3.5 text-[color:var(--veil-glow)]" />}
                        </span>
                        <span className="text-sm">Run the on-device check and continue.</span>
                      </label>
                    </div>
                  </FrostedPanel>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="s2"
                  initial={{ opacity: 0, filter: "blur(8px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.35 }}
                  className="max-w-xl"
                >
                  <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
                    Here is your recovery passphrase.
                  </h1>
                  <p className="mt-4 text-muted-foreground">
                    Veil issues you an anonymous key pair. This recovery passphrase is the only way to recover your handle if you lose your device. **We cannot reset it.**
                  </p>
                  <FrostedPanel className="mt-8 p-6 space-y-4">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-center">
                      <p className="mono font-mono text-xl select-all font-semibold tracking-wide text-[color:var(--veil-glow)]">
                        {passphrase}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Copy this passphrase and store it safely. It will never be shown again.
                    </p>
                  </FrostedPanel>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-10 flex items-center justify-between">
        {isLogin ? (
          <button
            onClick={() => setIsLogin(false)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cancel
          </button>
        ) : (
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}

        {isLogin ? (
          <button
            onClick={handleAuthSubmit}
            disabled={isLoading || handle.length < 3 || loginPassphrase.length < 3}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {isLoading ? "Signing in..." : "Enter Veil"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : (
          <button
            onClick={async () => {
              if (step === 2) {
                await handleAuthSubmit();
              } else {
                setStep((s) => s + 1);
              }
            }}
            disabled={isLoading || (step === 0 && handle.length < 3) || (step === 1 && !ageConfirmed)}
            className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--veil-glow)] px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            {isLoading ? "Entering..." : step === 2 ? "Enter Veil" : "Continue"}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </div>
  );
}
