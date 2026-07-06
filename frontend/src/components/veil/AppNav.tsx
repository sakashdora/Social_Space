import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Rss, PlusCircle, MessageSquare, ShieldCheck, UserRound, Video, MessageCircle } from "lucide-react";
import { VeilGlyph } from "./VeilGlyph";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/news", label: "News", icon: Rss },
  { to: "/social", label: "Social", icon: MessageSquare },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/video", label: "Video", icon: Video },
  { to: "/compose", label: "Compose", icon: PlusCircle },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/5 bg-ink/60 px-5 py-8 backdrop-blur-xl lg:flex">
        <Link to="/" className="flex items-center gap-2.5 pl-1">
          <span className="font-serif text-2xl leading-none tracking-tight">Social Space</span>
        </Link>

        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {items.map((it) => {
            const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    active && "text-[color:var(--veil-glow)]",
                  )}
                />
                {it.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--veil-glow)] shadow-[0_0_10px_var(--veil-glow)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mb-3 flex items-center justify-between rounded-xl px-1">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Theme
          </span>
          <ThemeToggle />
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground/80">Social Space</p>
          <p className="mt-1">Read, post, and share videos in a premium environment.</p>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl border border-white/10 bg-ink/70 px-2 py-1.5 backdrop-blur-xl lg:hidden">
        {items.map((it) => {
          const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition-colors",
                active ? "text-[color:var(--veil-glow)]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              <span className="truncate hidden min-[480px]:inline mt-0.5">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
