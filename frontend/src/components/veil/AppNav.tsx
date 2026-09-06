import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Rss,
  PlusCircle,
  MessageSquare,
  UserRound,
  Video,
  MessageCircle,
  Moon,
  Sun,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { SocialSpaceEmblem } from "./SocialSpaceEmblem";
import { useTheme } from "@/lib/theme";
import { getCurrentUser, isAuthenticated } from "@/lib/api";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/news", label: "News", icon: Rss },
  { to: "/social", label: "Social", icon: MessageSquare },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: "3" },
  { to: "/video", label: "Video", icon: Video },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle: toggleTheme } = useTheme();
  const user = getCurrentUser();
  const authed = isAuthenticated();

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-[#080b11]/90 px-5 py-7 backdrop-blur-2xl lg:flex shadow-[4px_0_30px_rgba(0,0,0,0.5)]">
        {/* Brand Header */}
        <Link to="/" className="flex items-center gap-3 group px-2 mb-6">
          <SocialSpaceEmblem className="h-8 w-8 transition-transform duration-300 group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="font-sans text-lg font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors">
              Social Space
            </span>
            <span className="text-[8.5px] tracking-[0.22em] text-amber-300/70 uppercase font-semibold">
              REAL CONNECTIONS
            </span>
          </div>
        </Link>

        {/* Quick Compose Action Button */}
        <Link
          to="/compose"
          className="mb-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold py-3 px-4 text-sm shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer active:scale-[0.98]"
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Transmission</span>
        </Link>

        {/* Main Navigation Links */}
        <nav className="flex flex-1 flex-col gap-1.5">
          {items.map((it) => {
            const active =
              it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-white/[0.08] text-white border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
                    : "text-white/60 hover:text-white hover:bg-white/[0.04]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    active
                      ? "text-amber-400"
                      : "text-white/50 group-hover:text-white",
                  )}
                />
                <span className="font-medium">{it.label}</span>
                {"badge" in it && it.badge && (
                  <span className="ml-auto rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 leading-none shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                    {it.badge}
                  </span>
                )}
                {active && !("badge" in it && it.badge) && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Account / Anonymous Status Card */}
        <div className="mt-auto space-y-3 pt-4 border-t border-white/10">
          {authed && user ? (
            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-2.5 transition group"
            >
              <div className="h-8 w-8 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                {user.handle.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-white truncate">
                  @{user.handle}
                </span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sovereign ID
                </span>
              </div>
            </Link>
          ) : (
            <Link
              to="/onboarding"
              className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 p-2.5 text-xs text-blue-300 transition group"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                <span className="font-medium">Enter Space</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}

          {/* Theme & Platform Footer */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
              Social Space v2.0
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="h-8 w-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
            >
              {theme === "dark" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Floating Glass Bottom Bar ── */}
      {!pathname.startsWith("/messages/") || pathname === "/messages" ? (
        <nav
          className="fixed inset-x-2 sm:inset-x-4 max-w-lg mx-auto z-40 flex items-center justify-around rounded-3xl border border-white/15 bg-[#080b11]/90 px-1.5 py-2 backdrop-blur-2xl lg:hidden shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
          style={{
            bottom: "max(0.75rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))",
          }}
        >
          {items.slice(0, 3).map((it) => {
            const active =
              it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all active:scale-95",
                  active
                    ? "text-amber-400 bg-white/[0.08]"
                    : "text-white/50 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[9px] font-medium tracking-tight truncate max-w-[48px]">
                  {it.label}
                </span>
              </Link>
            );
          })}

          {/* Center Golden + Transmission Button on Mobile */}
          <Link
            to="/compose"
            aria-label="New Transmission"
            className="flex -mt-5 h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-[#080b11] transition-transform active:scale-90"
          >
            <PlusCircle className="h-5 w-5" />
          </Link>

          {items.slice(3).map((it) => {
            const active = pathname.startsWith(it.to);
            const Icon = it.icon;
            return (
              <Link
                key={it.label}
                to={it.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-all relative active:scale-95",
                  active
                    ? "text-amber-400 bg-white/[0.08]"
                    : "text-white/50 hover:text-white",
                )}
              >
                <div className="relative">
                  <Icon className="h-4 w-4 shrink-0" />
                  {"badge" in it && it.badge && (
                    <span className="absolute -top-1.5 -right-2 h-3.5 min-w-[14px] px-1 rounded-full bg-amber-400 text-black text-[8px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(245,158,11,0.6)]">
                      {it.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium tracking-tight truncate max-w-[48px]">
                  {it.label}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
