import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Rss,
  PlusCircle,
  MessageSquare,
  UserRound,
  Video,
  MessageCircle,
} from "lucide-react";
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
      {/* ── Desktop sidebar ── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r px-5 py-8 backdrop-blur-2xl lg:flex"
        style={{
          background: "var(--nav-bg)",
          borderColor: "var(--nav-border)",
        }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 pl-1 mb-1">
          <span className="font-serif text-2xl leading-none tracking-tight text-foreground">
            Social Space
          </span>
        </Link>

        {/* Nav items */}
        <nav className="mt-8 flex flex-1 flex-col gap-0.5 animate-fadeIn">
          {items.map((it) => {
            const active =
              it.to === "/"
                ? pathname === "/"
                : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                style={{
                  backgroundColor: active ? "var(--nav-active-bg)" : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--nav-item-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "";
                }}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    active
                      ? "text-[color:var(--veil-glow)]"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {it.label}
                {active && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{
                      background: "var(--veil-glow)",
                      boxShadow: "0 0 8px var(--veil-glow)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle row */}
        <div className="mb-3 flex items-center justify-between rounded-xl px-1">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Theme
          </span>
          <ThemeToggle />
        </div>

        {/* Footer card */}
        <div
          className="rounded-xl p-3 text-[11px] leading-relaxed text-muted-foreground"
          style={{
            background: "var(--surface-bg)",
            border: "1px solid var(--surface-border)",
          }}
        >
          <p className="font-medium text-foreground">Social Space</p>
          <p className="mt-1 opacity-75">Read, post, and share videos in a premium environment.</p>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav
        className="fixed inset-x-2 bottom-2 z-40 flex items-center justify-around rounded-2xl px-1 py-1.5 backdrop-blur-xl lg:hidden"
        style={{
          background: "var(--nav-bg)",
          border: "1px solid var(--nav-border)",
          boxShadow: "0 4px 24px oklch(0 0 0 / 20%)",
          paddingBottom: "calc(6px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {items.map((it) => {
          const active =
            it.to === "/"
              ? pathname === "/"
              : pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              to={it.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 min-w-0 py-2 text-[9px] min-[400px]:text-[10px] transition-colors min-h-[44px]",
                active ? "text-[color:var(--veil-glow)]" : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate hidden min-[480px]:inline mt-0.5">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
