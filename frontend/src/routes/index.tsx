import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  EyeOff,
  Fingerprint,
  Heart,
  Lock,
  Menu,
  Moon,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Sun,
  Video,
  X,
  KeyRound,
} from "lucide-react";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
import { CosmicAtmosphere } from "@/components/veil/CosmicAtmosphere";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Social Space — Speak freely, keep your identity" },
      {
        name: "description",
        content:
          "Social Space is an anonymous social network. No email, no phone number, no ID. Share thoughts, watch media and chat with end-to-end encryption.",
      },
      {
        property: "og:title",
        content: "Social Space — Speak freely, keep your identity",
      },
      {
        property: "og:description",
        content:
          "Pick a handle and start talking. No email, no phone, no tracking.",
      },
    ],
  }),
  component: LandingPage,
});

const ANCHOR_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#privacy", label: "Privacy" },
] as const;

const PRIMARY_CTA =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-[0_0_28px_rgba(245,158,11,0.38)] transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer";
const SECONDARY_CTA =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/70 px-6 py-3 text-sm font-medium text-foreground backdrop-blur-md transition hover:bg-card cursor-pointer";

function LandingPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { isAuthenticated: authed } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="cosmic-theme relative min-h-dvh w-full overflow-x-hidden bg-background text-foreground selection:bg-amber-500/30">
      <CosmicAtmosphere />

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Link
            to="/"
            className="group flex items-center gap-2.5"
            aria-label="Social Space home"
          >
            <SocialSpaceEmblem className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
            <span className="whitespace-nowrap text-lg font-bold tracking-tight">
              Social Space
            </span>
          </Link>

          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
          >
            {ANCHOR_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link to="/social" className="transition hover:text-foreground">
              Live feed
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/70 text-foreground transition hover:bg-muted cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {authed ? (
              <Link
                to="/social"
                className={cn(PRIMARY_CTA, "px-4 py-2 text-xs sm:text-sm")}
              >
                Enter feed <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground sm:inline-flex"
                >
                  Sign in
                </Link>
                <Link
                  to="/onboarding"
                  className={cn(PRIMARY_CTA, "px-4 py-2 text-xs sm:text-sm")}
                >
                  Get started
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/70 md:hidden cursor-pointer"
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-menu"
            className="border-t border-border bg-background/95 px-4 pb-5 pt-3 backdrop-blur-2xl md:hidden"
          >
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {ANCHOR_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/social"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
              >
                Live feed
              </Link>
              {!authed && (
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
                >
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main>
        <Hero authed={authed} />
        <Features />
        <Privacy />
        <FinalCta authed={authed} />
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-border bg-card/80 px-4 py-10 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <SocialSpaceEmblem className="h-7 w-7" />
            <div className="flex flex-col">
              <span className="text-base font-bold">Social Space</span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Connect · share · be yourself
              </span>
            </div>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-muted-foreground"
          >
            <Link to="/social" className="hover:text-foreground transition">
              Feed
            </Link>
            <Link to="/video" className="hover:text-foreground transition">
              Video
            </Link>
            <Link to="/messages" className="hover:text-foreground transition">
              Messages
            </Link>
            <Link to="/profile" className="hover:text-foreground transition">
              Profile
            </Link>
            <Link to="/safety" className="hover:text-foreground transition">
              Safety
            </Link>
            <Link to="/login" className="hover:text-foreground transition">
              Sign in
            </Link>
          </nav>
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} Social Space
          </p>
        </div>
      </footer>
    </div>
  );
}

function Hero({ authed }: { authed: boolean }) {
  const reduceMotion = useReducedMotion();
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative z-10 px-4 pb-20 pt-32 sm:px-8 sm:pt-40 lg:pb-28">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <motion.span
            {...fade(0)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Anonymous by design
          </motion.span>

          <motion.h1
            {...fade(0.08)}
            className="font-display mt-6 text-[2.6rem] font-semibold leading-[1.04] tracking-tight sm:text-6xl lg:text-[3.9rem] xl:text-7xl"
          >
            Speak freely.
            <span className="mt-1 block bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 bg-clip-text text-transparent dark:from-amber-300 dark:via-amber-200 dark:to-amber-400">
              Keep who you are.
            </span>
          </motion.h1>

          <motion.p
            {...fade(0.16)}
            className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Pick a handle in under a minute and start sharing. No email, no
            phone number, no ID, and no ad trackers following you around.
          </motion.p>

          <motion.div
            {...fade(0.24)}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            {authed ? (
              <Link
                to="/social"
                className={cn(PRIMARY_CTA, "w-full sm:w-auto")}
              >
                Open your feed{" "}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link
                  to="/onboarding"
                  className={cn(PRIMARY_CTA, "w-full sm:w-auto")}
                >
                  Create your handle{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className={cn(SECONDARY_CTA, "w-full sm:w-auto")}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </Link>
              </>
            )}
          </motion.div>
          <motion.p
            {...fade(0.3)}
            className="mt-4 text-xs text-muted-foreground"
          >
            Takes about 30 seconds. We never ask for personal details.
          </motion.p>

          <motion.ul
            {...fade(0.36)}
            className="mt-12 grid max-w-xl grid-cols-1 gap-3 border-t border-border pt-8 sm:grid-cols-3 sm:gap-4"
          >
            {[
              {
                icon: EyeOff,
                text: "No email or phone",
                tone: "text-emerald-500",
              },
              {
                icon: Lock,
                text: "End-to-end encrypted chats",
                tone: "text-blue-500",
              },
              {
                icon: Fingerprint,
                text: "Passkey sign-in",
                tone: "text-amber-500",
              },
            ].map(({ icon: Icon, text, tone }) => (
              <li
                key={text}
                className="flex items-center gap-2.5 text-sm font-medium"
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", tone)}
                  aria-hidden="true"
                />
                {text}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ─── Preview ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none"
          aria-hidden="true"
        >
          <div className="absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-amber-400/25 via-transparent to-blue-500/20 blur-2xl" />

          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-sm font-bold text-amber-700 dark:text-amber-300">
                  QL
                </div>
                <div>
                  <p className="text-sm font-semibold">quiet-linen</p>
                  <p className="text-[11px] text-muted-foreground">
                    Ideas · 4 min ago
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-300">
                Verified
              </span>
            </div>

            <p className="py-5 text-[15px] leading-relaxed text-foreground">
              “Wrote this on a device that has never touched my legal identity.
              Just ideas, shared with people who actually listen.”
            </p>

            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  Nothing tracked.
                </span>{" "}
                No cookies for ads, no device fingerprinting.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-5 border-t border-border pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-500" /> Support
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-blue-500" /> Reply
              </span>
            </div>
          </div>

          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-6 -left-4 hidden w-56 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl sm:block"
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Lock className="h-3.5 w-3.5 text-blue-500" /> Encrypted chat
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Messages vanish on your timer. Only the recipient can read them.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    to: "/social",
    icon: MessageSquare,
    tone: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    title: "Social stream",
    body: "A chronological feed grouped by topic — life, ideas, career, confessions. No engagement-bait ranking.",
    cta: "Explore the feed",
  },
  {
    to: "/video",
    icon: Video,
    tone: "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400",
    title: "Media portal",
    body: "Watch and share clips with a fast, distraction-free player. No behavioural tracking, no ad interruptions.",
    cta: "Watch media",
  },
  {
    to: "/messages",
    icon: Lock,
    tone: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    title: "Encrypted chats",
    body: "Direct messages protected by end-to-end encryption, with disappearing-message timers you control.",
    cta: "Start a conversation",
  },
] as const;

function Features() {
  return (
    <section
      id="features"
      className="relative z-10 border-t border-border bg-muted/20 px-4 py-24 sm:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Everything you need
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            Three places. One private network.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Built for conversation, not for harvesting attention. Each part
            works the same on phone, tablet and desktop.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map(({ to, icon: Icon, tone, title, body, cta }) => (
            <Link
              key={to}
              to={to}
              className="group flex flex-col justify-between rounded-3xl border border-border bg-card/90 p-7 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]"
            >
              <div>
                <div
                  className={cn(
                    "mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform group-hover:scale-105",
                    tone,
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold transition-colors group-hover:text-amber-600 dark:group-hover:text-amber-300">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
              <span className="mt-8 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                {cta}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRIVACY_POINTS = [
  {
    icon: KeyRound,
    tone: "text-amber-600 dark:text-amber-400",
    title: "Passphrases are never stored in plain text",
    body: "Your passphrase is run through a one-way hash before it is saved. We can’t read it back, and neither can anyone who gets a copy of the database.",
  },
  {
    icon: Fingerprint,
    tone: "text-blue-600 dark:text-blue-400",
    title: "Passkeys for one-tap sign-in",
    body: "Use Face ID, Touch ID or Windows Hello. Passkeys are phishing-resistant because they only work on the site they were created for.",
  },
  {
    icon: ShieldCheck,
    tone: "text-emerald-600 dark:text-emerald-400",
    title: "Two-factor and recovery codes",
    body: "Add an authenticator app and keep single-use recovery codes. Sensitive actions ask you to confirm who you are first.",
  },
] as const;

function Privacy() {
  return (
    <section id="privacy" className="relative z-10 px-4 py-24 sm:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Privacy, built in
          </p>
          <h2 className="font-display mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            We are built so we can’t sell what we never collected.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Most platforms make money from your data. Social Space asks for
            almost nothing up front, and the rest of what you share stays under
            your control.
          </p>

          <ul className="mt-9 space-y-4">
            {PRIVACY_POINTS.map(({ icon: Icon, tone, title, body }) => (
              <li
                key={title}
                className="flex gap-4 rounded-2xl border border-border bg-card/70 p-5"
              >
                <Icon
                  className={cn("mt-0.5 h-5 w-5 shrink-0", tone)}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6 lg:pl-8">
          <div className="rounded-[28px] border border-border bg-card/95 p-7 shadow-2xl sm:p-9">
            <h3 className="flex items-center gap-2 text-xl font-bold">
              <ShieldCheck
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              What we never ask for
            </h3>
            <ul className="mt-6 space-y-3">
              {[
                "Your legal name or date of birth",
                "An email address or phone number",
                "Government ID or a passport",
                "Precise location or IP history",
                "Advertising cookies or device fingerprints",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3.5 text-sm"
                >
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              to="/safety"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 underline underline-offset-4 hover:text-amber-600 dark:text-amber-400"
            >
              Read our safety manifesto{" "}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ authed }: { authed: boolean }) {
  return (
    <section className="relative z-10 px-4 pb-24 sm:px-8">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-card to-blue-500/10 p-8 text-center shadow-[0_0_60px_-15px_rgba(245,158,11,0.3)] sm:p-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
          Your handle is waiting.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Choose a name, set a passphrase and you are in. You can add a passkey
          later from your profile.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {authed ? (
            <Link to="/social" className={cn(PRIMARY_CTA, "w-full sm:w-auto")}>
              Go to your feed{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                to="/onboarding"
                className={cn(PRIMARY_CTA, "w-full sm:w-auto")}
              >
                Create your handle{" "}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/login"
                className={cn(SECONDARY_CTA, "w-full sm:w-auto")}
              >
                I already have an account
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
