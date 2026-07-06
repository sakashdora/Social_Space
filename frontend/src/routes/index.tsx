import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "../components/veil/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Social Space — Connect Freely" },
      { name: "description", content: "A new social experience with news, social, and video feeds." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="font-serif text-2xl leading-none tracking-tight">Social Space</span>
          </Link>
          <nav className="mono hidden items-center gap-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground md:flex">
            <Link to="/news" className="transition hover:text-foreground">News</Link>
            <Link to="/social" className="transition hover:text-foreground">Social</Link>
            <Link to="/video" className="transition hover:text-foreground">Video</Link>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/onboarding"
              className="group mono inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.18em] backdrop-blur-xl transition hover:bg-white/[0.09]"
            >
              Enter Space
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-500 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-[4rem] leading-[0.94] tracking-[-0.04em] sm:text-[6rem]">
          Connect, Read, <span className="italic">Watch.</span>
        </h1>
        <p className="mt-8 max-w-xl text-lg text-muted-foreground">
          Welcome to Social Space. Sign up frictionlessly without phone or email. Explore news, share your thoughts, and watch videos.
        </p>
        <div className="mt-12 flex items-center justify-center gap-6">
          <Link
            to="/onboarding"
            className="group inline-flex items-center gap-2.5 rounded-full bg-[color:var(--primary)] px-9 py-4 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
          </Link>
        </div>
      </main>
    </div>
  );
}

