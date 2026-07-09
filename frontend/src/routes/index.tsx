import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Heart,
  Lock,
  MessageCircle,
  MessageSquare,
  Play,
  PlayCircle,
  Search,
  Share2,
  Shield,
  Sparkles,
  Users,
  VenetianMask,
  X,
} from "lucide-react";

import postLandscape from "@/assets/post-landscape.jpg";
import videoThumb from "@/assets/video-thumb.jpg";
import { ThemeToggle } from "../components/veil/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Social Space — Connect Freely" },
      { name: "description", content: "A new social experience with news, social, and video feeds." },
    ],
  }),
  component: LandingPage,
});

const navLinks = [
  { label: "News", href: "#news" },
  { label: "Social", href: "#social" },
  { label: "Video", href: "#video" },
];

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <VenetianMask className="h-7 w-7 text-primary transition-transform group-hover:scale-105" />
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
        Social Space
      </span>
    </Link>
  );
}

function Nav() {
  const scrolled = useScrolled(24);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "frost border-b border-[color:var(--border)] shadow-soft"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 md:px-12 xl:px-20">
          <Logo />

          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-10">
              {navLinks.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="relative text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:origin-right after:scale-x-0 after:bg-primary after:transition-transform hover:after:origin-left hover:after:scale-x-100"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link to="/onboarding">
              <PrimaryButton>
                Enter Space <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </Link>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="frost flex h-10 w-10 items-center justify-center rounded-full"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 bg-foreground" />
                <span className="block h-0.5 w-5 bg-foreground" />
              </span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <motion.div
        initial={false}
        animate={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[60] md:hidden"
      >
        <div
          className="absolute inset-0 bg-background/80 backdrop-blur-2xl"
          onClick={() => setOpen(false)}
        />
        <motion.div
          initial={false}
          animate={{ y: open ? 0 : -30, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="relative flex h-full flex-col px-6 pt-6"
        >
          <div className="flex items-center justify-between">
            <Logo />
            <button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="frost flex h-10 w-10 items-center justify-center rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <ul className="mt-16 flex flex-col gap-8">
            {navLinks.map((l, i) => (
              <motion.li
                key={l.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: open ? 0 : 20, opacity: open ? 1 : 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              >
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="font-display text-5xl font-semibold tracking-tight text-foreground"
                >
                  {l.label}
                </a>
              </motion.li>
            ))}
          </ul>
          <div className="mt-auto pb-10">
            <Link to="/onboarding" className="w-full">
              <PrimaryButton className="w-full justify-center">
                Enter Space <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}

function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--primary)_35%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-8px_color-mix(in_oklab,var(--primary)_50%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`frost inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      {children}
    </button>
  );
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function Hero() {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Dynamic ambient backgrounds mapping to active theme colors */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-[color:var(--veil-glow)] opacity-35 blur-3xl animate-pulse-glow" />
        <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-[color:var(--veil)] opacity-25 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-[color:var(--veil-glow)] opacity-35 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-16 px-6 md:px-12 xl:px-20 lg:grid-cols-[45fr_55fr] lg:gap-12">
        {/* Left */}
        <div>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="frost inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground"
          >
            <Shield className="h-4 w-4 text-primary" />
            Anonymous. Secure. Yours.
          </motion.div>

          <motion.h1
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="show"
            className="mt-6 font-display text-[42px] font-semibold leading-[1.02] tracking-tight text-balance text-foreground sm:text-6xl md:text-7xl xl:text-[84px]"
          >
            Connect, Read,{" "}
            <span className="italic text-primary">Watch.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Welcome to Social Space. Sign up frictionlessly without phone or
            email. Explore news, share your thoughts, and watch videos — all
            while remaining anonymous.
          </motion.p>

          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate="show"
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link to="/onboarding">
              <PrimaryButton className="justify-center w-full sm:w-auto">
                Get Started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </PrimaryButton>
            </Link>
            <a href="#social">
              <SecondaryButton className="justify-center w-full sm:w-auto">
                <PlayCircle className="h-4 w-4 text-primary" />
                Explore Features
              </SecondaryButton>
            </a>
          </motion.div>

          <motion.div
            variants={fadeUp}
            custom={4}
            initial="hidden"
            animate="show"
            className="mt-10 flex items-center gap-4"
          >
            <div className="flex -space-x-3">
              {[
                "oklch(0.86 0.11 85)",
                "oklch(0.72 0.09 78)",
                "oklch(0.55 0.06 78)",
                "oklch(0.76 0.13 152)",
                "oklch(0.82 0.14 83)",
              ].map((c, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="h-9 w-9 rounded-full border-2 border-background shadow-sm"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${c}, oklch(0.25 0.01 60))`,
                  }}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Join thousands exploring anonymously
            </p>
          </motion.div>
        </div>

        {/* Right — floating mockups */}
        <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
          <div className="relative aspect-[5/6] w-full sm:aspect-[6/5] lg:aspect-[5/5]">
            {/* Soft halo */}
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
              style={{
                background:
                  "radial-gradient(closest-side, color-mix(in oklab, var(--veil) 25%, transparent), transparent 70%)",
              }}
            />
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 -z-10 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/15"
            />

            {/* Main feed card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
              className="absolute left-[4%] top-[6%] w-[72%] rounded-3xl"
            >
              <div
                className={`frost-heavy rounded-3xl p-4 shadow-float ${
                  reduce ? "" : "animate-float-slow"
                }`}
                style={{ ["--r" as string]: "-1.5deg" } as React.CSSProperties}
              >
                <div className="flex items-center justify-between px-1 pb-3">
                  <div className="flex items-center gap-2 text-foreground">
                    <span className="flex flex-col gap-[3px]">
                      <span className="block h-0.5 w-4 bg-current" />
                      <span className="block h-0.5 w-4 bg-current" />
                      <span className="block h-0.5 w-4 bg-current" />
                    </span>
                    <span className="font-display text-lg font-semibold">For You</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Search className="h-4 w-4" />
                    <span className="relative">
                      <Bell className="h-4 w-4" />
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-b border-black/5 px-1 pb-2 text-[13px] font-medium">
                  <span className="border-b-2 border-primary pb-1 text-primary">All</span>
                  <span className="text-muted-foreground">Trending</span>
                  <span className="text-muted-foreground">News</span>
                  <span className="text-muted-foreground">Tech</span>
                  <span className="hidden text-muted-foreground sm:inline">Entertainment</span>
                </div>

                <div className="mt-3 rounded-2xl bg-background/60 p-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-8 w-8 rounded-full"
                      style={{
                        background:
                          "radial-gradient(circle at 30% 30%, var(--veil-glow), var(--ink-raised))",
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Anonymous User</p>
                      <p className="text-xs text-muted-foreground">2h ago</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-foreground">
                    The future belongs to those who believe in the beauty of their dreams.
                  </p>
                  <div className="mt-3 overflow-hidden rounded-xl">
                    <img
                      src={postLandscape}
                      alt="A lone figure sits at the edge of a mirror-still mountain lake at sunrise."
                      width={1024}
                      height={768}
                      loading="lazy"
                      className="h-40 w-full object-cover sm:h-52"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-primary" fill="currentColor" />
                      1.2K
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" />
                      128
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Share2 className="h-4 w-4" />
                      256
                    </span>
                    <span className="ml-auto">
                      <Bookmark className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Video card top-right */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.4, ease: "easeOut" }}
              className="absolute right-[0%] top-[0%] w-[46%]"
            >
              <div
                className={`relative overflow-hidden rounded-2xl shadow-float ${
                  reduce ? "" : "animate-float"
                }`}
                style={{ ["--r" as string]: "3deg" } as React.CSSProperties}
              >
                <img
                  src={videoThumb}
                  alt="Hot air balloons drift over Cappadocia at sunrise."
                  width={1024}
                  height={640}
                  loading="lazy"
                  className="h-40 w-full object-cover sm:h-48"
                />
                <span className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                  4K
                </span>
                <button
                  aria-label="Play video"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="frost flex h-12 w-12 items-center justify-center rounded-full">
                    <Play className="h-5 w-5 translate-x-0.5 text-foreground" fill="currentColor" />
                  </span>
                </button>
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-white/90">
                  <span className="text-xs">01:24 / 03:40</span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>◀</span>
                    <span>▶</span>
                    <span>⛶</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Trending card bottom-right */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.6, ease: "easeOut" }}
              className="absolute right-[2%] bottom-[4%] w-[52%]"
            >
              <div
                className={`frost-heavy rounded-2xl p-4 shadow-float ${
                  reduce ? "" : "animate-float"
                }`}
                style={{ ["--r" as string]: "-2deg", animationDelay: "-2s" } as React.CSSProperties}
              >
                <div className="flex items-center gap-2 pb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <p className="font-display text-base font-semibold">Trending</p>
                </div>
                <ul className="space-y-3">
                  {[
                    { n: 1, t: "AI is changing the world", p: "12.5K posts", g: "linear-gradient(135deg,#7a5a3a,#c9a075)" },
                    { n: 2, t: "Exploring the mountains", p: "8.7K posts", g: "linear-gradient(135deg,#3a4a6a,#8ab0d0)" },
                    { n: 3, t: "Tech innovations in 2026", p: "6.3K posts", g: "linear-gradient(135deg,#1a2a4a,#4a7bb8)" },
                  ].map((it) => (
                    <li key={it.n} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {it.n}
                      </span>
                      <span
                        aria-hidden
                        className="h-10 w-10 shrink-0 rounded-lg"
                        style={{ background: it.g }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{it.t}</p>
                        <p className="text-xs text-muted-foreground">{it.p}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <button className="mt-3 w-full rounded-xl bg-background/60 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                  View all
                </button>
              </div>
            </motion.div>

            {/* Sparkle decorations */}
            <Sparkles className="absolute left-[52%] top-[42%] h-4 w-4 text-primary/60" />
            <Sparkles className="absolute left-[38%] bottom-[24%] h-3 w-3 text-primary/40" />
          </div>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Shield,
    title: "No Personal Info",
    desc: "No phone. No email. Just you.",
  },
  {
    icon: VenetianMask,
    title: "Truly Anonymous",
    desc: "Your identity stays completely private.",
  },
  {
    icon: MessageSquare,
    title: "Engage Freely",
    desc: "Share, discuss, and connect without boundaries.",
  },
  {
    icon: PlayCircle,
    title: "Watch & Discover",
    desc: "Curated videos and content tailored for you.",
  },
];

function Features() {
  return (
    <section id="social" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1200px] px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-primary">
            Why Social Space
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            A calmer feed, built for freedom.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every detail is designed around privacy — no tracking, no personal
            data, no noise. Just an honest place to read, share and watch.
          </p>
        </motion.div>

        <div className="mt-12 sm:mt-14 grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group frost rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="video" className="relative pb-24 md:pb-32">
      <div className="mx-auto max-w-[1200px] px-6 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="frost-heavy relative overflow-hidden rounded-[32px] p-8 shadow-elegant md:p-14"
        >
          {/* Dynamic backgrounds mapping to brand styles */}
          <div
            aria-hidden
            className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-secondary/25 blur-3xl"
          />

          <div className="relative flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-5 md:items-center">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                <Users className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-3xl font-semibold leading-tight text-balance md:text-5xl">
                  Your Space. <span className="italic text-primary">Your Voice.</span>
                </h2>
                <p className="mt-2 max-w-md text-muted-foreground">
                  Privacy comes first. Step into a social experience designed for you.
                </p>
              </div>
            </div>
            <Link to="/onboarding" className="w-full md:w-auto">
              <PrimaryButton className="w-full justify-center md:w-auto md:px-8 md:py-4 md:text-base">
                Enter Space <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[color:var(--border)] py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-6 md:px-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <p className="text-sm">Built for privacy. Designed for freedom.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Social Space
        </p>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground selection:bg-primary/20">
      <Nav />
      <main id="news">
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
