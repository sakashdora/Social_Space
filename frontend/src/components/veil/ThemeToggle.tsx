import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn("group relative inline-flex h-8 w-14 items-center rounded-full transition-colors", className)}
      style={{
        background: "var(--muted)",
        boxShadow: isDark
          ? "inset 0 1px 0 oklch(1 0 0 / 10%), inset 0 0 0 1px oklch(0 0 0 / 20%)"
          : "inset 0 1px 0 oklch(0 0 0 / 5%), inset 0 0 0 1px oklch(0 0 0 / 12%)",
      }}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-[400ms]",
          isDark ? "translate-x-1" : "translate-x-7",
        )}
        style={{
          background: "var(--veil-glow)",
          color: "var(--primary-foreground)",
          boxShadow: "0 2px 8px color-mix(in oklab, var(--veil) 50%, transparent)",
          transitionTimingFunction: "var(--ease-veil)",
        }}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
