import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Zap,
  Feather,
  Sparkles,
  Users,
  MessageSquare,
  Rss,
  Video,
  KeyRound,
  Fingerprint,
  Lock,
  Flame,
  CheckCircle2,
  Share2,
  Heart,
  ExternalLink,
  Moon,
  Sun,
  EyeOff,
} from "lucide-react";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";
import { CosmicAtmosphere } from "@/components/veil/CosmicAtmosphere";
import { useTheme } from "@/lib/theme";
import { isAuthenticated } from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Social Space — The Sovereign Social Network" },
      {
        name: "description",
        content:
          "Connect freely without email, phone, or tracking. An open, sovereign community for thoughts, journalism, video, and encrypted messaging.",
      },
      {
        property: "og:title",
        content: "Social Space — The Sovereign Social Network",
      },
      {
        property: "og:description",
        content:
          "Connect, read, and share anonymously. Pure cryptography, zero surveillance.",
      },
    ],
  }),
  component: LandingPage,
});

export function LandingPage() {
  const { theme, toggle: toggleTheme } = useTheme();
  const authed = isAuthenticated();

  return (
    <div className="cosmic-theme relative min-h-screen w-full bg-[#06070a] text-white overflow-x-hidden selection:bg-amber-500/30 selection:text-amber-200">
      {/* ─── Ambient Cosmic Background ─────────────────────────────────── */}
      <CosmicAtmosphere />

      {/* ─── Navigation Bar ────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#06070a]/80 backdrop-blur-2xl px-4 sm:px-12 py-3.5 sm:py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <SocialSpaceEmblem className="h-7 sm:h-8 w-7 sm:w-8 transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="font-sans text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
                Social Space
              </span>
              <span className="text-[8px] sm:text-[9px] tracking-[0.22em] text-amber-200/60 uppercase font-semibold">
                REAL PEOPLE · REAL CONNECTIONS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#pillars" className="hover:text-white transition-colors">
              Security
            </a>
            <Link to="/news" className="hover:text-white transition-colors">
              News
            </Link>
            <Link to="/social" className="hover:text-white transition-colors">
              Live Feed
            </Link>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-8 sm:h-9 w-8 sm:w-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>

            {authed ? (
              <Link
                to="/social"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-4 sm:px-5 py-2 text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
              >
                <span>Enter Feed</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-4 sm:px-5 py-2 text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
              >
                <span>Join Social Space</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative z-10 pt-28 sm:pt-36 pb-16 sm:pb-20 px-4 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-medium text-blue-400 w-fit mb-4 sm:mb-6 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span>The Sovereign Social Network</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[3.8rem] font-extrabold tracking-tight text-white leading-[1.1]">
                Connect freely.
                <br />
                <span className="text-[#3b82f6]">No email. No phone.</span>
                <br />
                No tracking.
              </h1>

              <p className="mt-4 sm:mt-6 text-white/70 text-sm sm:text-lg leading-relaxed max-w-xl">
                Social Space is designed for honest connection. Pick a handle in seconds,
                share ideas without algorithmic surveillance, and own your identity with
                pure on-device cryptography.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3.5 sm:gap-4">
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-bold px-6 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all cursor-pointer active:scale-[0.98]"
                >
                  <span>Pick a handle — 30s signup</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/social"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-white px-5 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-medium transition cursor-pointer backdrop-blur-md"
                >
                  <span>Explore Live Feed</span>
                </Link>
              </div>

              {/* Trust Metric Row */}
              <div className="mt-8 sm:mt-12 grid grid-cols-3 gap-3 sm:gap-6 pt-6 sm:pt-8 border-t border-white/10 max-w-lg">
                <div>
                  <span className="text-2xl sm:text-3xl font-bold text-white font-mono">
                    0
                  </span>
                  <p className="text-xs text-white/50 mt-1">
                    Emails or phone numbers recorded
                  </p>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-bold text-amber-400 font-mono">
                    100%
                  </span>
                  <p className="text-xs text-white/50 mt-1">
                    Chronological, unmanipulated feed
                  </p>
                </div>
                <div>
                  <span className="text-2xl sm:text-3xl font-bold text-blue-400 font-mono">
                    E2EE
                  </span>
                  <p className="text-xs text-white/50 mt-1">
                    End-to-end encrypted messaging
                  </p>
                </div>
              </div>
            </div>

            {/* Right Interactive Glassmorphic Preview */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-lg rounded-[32px] border border-amber-500/30 bg-[#0c1017]/90 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_0_60px_-10px_rgba(245,158,11,0.25),inset_0_1px_0_0_rgba(255,255,255,0.1)] relative">
                {/* Header of Preview Card */}
                <div className="flex items-center justify-between pb-5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-sm">
                      QL
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white">
                          quiet-linen
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      </div>
                      <span className="text-[11px] text-white/40">
                        @quiet-linen · 4m ago
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300">
                    Ideas
                  </span>
                </div>

                {/* Body Content */}
                <div className="py-5 space-y-4">
                  <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                    "I wrote this post on a device that has never touched my legal identity.
                    No ad trackers watching my keystrokes, no corporate profiling. Just pure
                    ideas shared with real minds."
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-[#07090e] p-4 flex items-center gap-3">
                    <Shield className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="text-xs text-white/70">
                      <span className="text-white font-medium">On-Device Privacy Confirmed:</span>{" "}
                      Zero tracking cookies, client-side cryptographic hashing.
                    </div>
                  </div>
                </div>

                {/* Interactive Reactions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                  <div className="flex items-center gap-5">
                    <Link
                      to="/social"
                      className="flex items-center gap-1.5 hover:text-amber-300 transition cursor-pointer"
                      title="Explore community signals"
                    >
                      <Heart className="h-4 w-4 text-rose-400 fill-rose-400/20" />
                      <span>342</span>
                    </Link>
                    <Link
                      to="/social"
                      className="flex items-center gap-1.5 hover:text-amber-300 transition cursor-pointer"
                      title="View transmission discussions"
                    >
                      <MessageSquare className="h-4 w-4 text-blue-400" />
                      <span>48 replies</span>
                    </Link>
                  </div>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified Sovereign
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Four Portals Section ──────────────────────────────────────── */}
      <section id="features" className="relative z-10 py-24 px-6 sm:px-12 border-t border-white/10 bg-[#070a10]/50 backdrop-blur-md">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
              EXPERIENCE ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-3">
              Four Portals. One Sovereign Network.
            </h2>
            <p className="text-white/60 text-base mt-4 leading-relaxed">
              Every feature of Social Space is crafted to provide rich, modern utility
              without compromising user privacy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Portal 1: Social Stream */}
            <Link
              to="/social"
              className="group rounded-3xl border border-white/10 bg-[#0c1017]/80 hover:border-amber-400/40 p-7 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Social Stream
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2.5 leading-relaxed">
                  Chronological feeds filtered by topics: Life, Mental Health, Career,
                  Ideas, and Confessions. Zero rage-bait algorithms.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Explore Stream</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            {/* Portal 2: Global News & AI Briefings */}
            <Link
              to="/news"
              className="group rounded-3xl border border-white/10 bg-[#0c1017]/80 hover:border-amber-400/40 p-7 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                  <Rss className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  News & AI Briefs
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2.5 leading-relaxed">
                  Real-time journalism from global newsfeeds. Decode complex
                  articles with on-demand private AI analytical summaries.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Read Global News</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            {/* Portal 3: Video & Media Feed */}
            <Link
              to="/video"
              className="group rounded-3xl border border-white/10 bg-[#0c1017]/80 hover:border-amber-400/40 p-7 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                  <Video className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Media Portal
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2.5 leading-relaxed">
                  Fluid, high-performance video player. Enjoy community clips and
                  stories without behavioral tracking or intrusive ads.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Watch Media</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>

            {/* Portal 4: Sealed Sender Messages */}
            <Link
              to="/messages"
              className="group rounded-3xl border border-white/10 bg-[#0c1017]/80 hover:border-amber-400/40 p-7 transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col justify-between cursor-pointer"
            >
              <div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition-colors">
                  Encrypted Chats
                </h3>
                <p className="text-xs sm:text-sm text-white/60 mt-2.5 leading-relaxed">
                  WebCrypto ECDH end-to-end encrypted direct messaging. Ephemeral
                  countdown timers ensure chats vanish automatically.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-amber-400 group-hover:translate-x-1 transition-transform">
                <span>Start Conversation</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Security & Sovereign Pillars ──────────────────────────────── */}
      <section id="pillars" className="relative z-10 py-24 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <div className="lg:col-span-6">
              <span className="text-xs font-semibold tracking-[0.2em] text-amber-400 uppercase">
                ZERO KNOWLEDGE GUARANTEE
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mt-3 leading-tight">
                Built to protect your real identity at all costs.
              </h2>
              <p className="text-white/70 text-base sm:text-lg mt-5 leading-relaxed">
                Traditional social platforms treat user data as their commodity. Social Space
                is engineered with non-custodial cryptography so we cannot sell or surrender
                what we never collected in the first place.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <KeyRound className="h-5 w-5 text-amber-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      Argon2id & Shannon Entropy
                    </h4>
                    <p className="text-xs text-white/60 mt-1">
                      Your passphrase is password-derived locally with memory-hard hashing.
                      We store zero plaintext passwords.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <Fingerprint className="h-5 w-5 text-blue-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      FIDO2 / WebAuthn Passkeys
                    </h4>
                    <p className="text-xs text-white/60 mt-1">
                      Sign in instantly with Face ID, Touch ID, or Windows Hello.
                      Phishing-resistant, hardware-level security.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <EyeOff className="h-5 w-5 text-emerald-400 mt-1 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      On-Device Media Anonymization
                    </h4>
                    <p className="text-xs text-white/60 mt-1">
                      Upload photos with automated on-device face pixelation before
                      transmission to prevent biometric facial tracking.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-md rounded-[32px] border border-white/15 bg-[#090d15]/90 p-8 shadow-2xl space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  What We Never Collect
                </h3>
                <div className="space-y-3">
                  {[
                    "Your legal name or birthday",
                    "Email address or phone number",
                    "Government identification or passport",
                    "GPS location or IP coordinate history",
                    "Third-party advertising cookies or device graphs",
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] text-xs text-white/80"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Link
                    to="/onboarding"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold py-3 text-sm transition cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                  >
                    <span>Claim Your Anonymous Handle</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 bg-[#06070a]/90 py-12 px-6 sm:px-12">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <SocialSpaceEmblem className="h-7 w-7" />
            <div className="flex flex-col">
              <span className="font-bold text-white text-base">Social Space</span>
              <span className="text-[9px] tracking-[0.2em] text-white/40 uppercase">
                CONNECT · SHARE · BE YOURSELF
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
            <Link to="/social" className="hover:text-white transition">
              Feed
            </Link>
            <Link to="/news" className="hover:text-white transition">
              News
            </Link>
            <Link to="/video" className="hover:text-white transition">
              Video
            </Link>
            <Link to="/messages" className="hover:text-white transition">
              Messages
            </Link>
            <Link to="/profile" className="hover:text-white transition">
              Profile
            </Link>
            <Link to="/safety" className="hover:text-white transition">
              Safety Manifesto
            </Link>
          </div>

          <div className="text-xs text-white/40 font-mono">
            © 2026 Social Space. Sovereign Identity.
          </div>
        </div>
      </footer>
    </div>
  );
}
