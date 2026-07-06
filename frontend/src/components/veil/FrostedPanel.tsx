import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export const FrostedPanel = forwardRef<HTMLDivElement, Props>(
  ({ className, glow, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        "frost grain-panel rounded-3xl",
        glow && "veil-glow-ring",
        className,
      )}
      {...rest}
    />
  ),
);
FrostedPanel.displayName = "FrostedPanel";
