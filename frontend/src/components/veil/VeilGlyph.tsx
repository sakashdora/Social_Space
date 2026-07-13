import { cn } from "@/lib/utils";

export function VeilGlyph({
  className,
  ...rest
}: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5", className)}
      {...rest}
    >
      <path d="M4 12c4 6 8 8 12 8s8-2 12-8" />
      <path d="M6 10c3.5 5 6.5 6.5 10 6.5S22.5 15 26 10" opacity="0.6" />
      <path d="M8 8c3 4 5 5 8 5s5-1 8-5" opacity="0.35" />
    </svg>
  );
}
