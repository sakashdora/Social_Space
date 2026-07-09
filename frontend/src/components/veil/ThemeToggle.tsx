import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggle}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.04 }}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn(
        "group relative inline-flex h-8 w-14 items-center rounded-full transition-colors",
        className,
      )}
      style={{
        background: "var(--muted)",
        boxShadow: isDark
          ? "inset 0 1px 0 oklch(1 0 0 / 10%), inset 0 0 0 1px oklch(0 0 0 / 20%)"
          : "inset 0 1px 0 oklch(0 0 0 / 5%), inset 0 0 0 1px oklch(0 0 0 / 12%)",
      }}
    >
      <motion.span
        layout
        transition={{
          type: "spring",
          stiffness: 700,
          damping: 32,
        }}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full",
          isDark ? "ml-1" : "ml-7",
        )}
        style={{
          background: "var(--veil-glow)",
          color: "var(--primary-foreground)",
          boxShadow: "0 2px 8px color-mix(in oklab, var(--veil) 50%, transparent)",
        }}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </motion.span>
    </motion.button>
  );
}
