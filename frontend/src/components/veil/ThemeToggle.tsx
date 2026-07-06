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
      className={cn(
        "group relative inline-flex h-8 w-14 items-center rounded-full",
        "bg-[color:var(--muted)]/60 transition-colors",
        "shadow-[inset_0_1px_0_color-mix(in_oklab,white_10%,transparent),inset_0_0_0_1px_color-mix(in_oklab,black_20%,transparent)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          "bg-[color:var(--veil-glow)] text-[color:var(--primary-foreground)]",
          "shadow-[0_2px_8px_color-mix(in_oklab,var(--veil)_50%,transparent)]",
          "transition-transform duration-[420ms] ease-[var(--ease-veil)]",
          isDark ? "translate-x-1" : "translate-x-7",
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
