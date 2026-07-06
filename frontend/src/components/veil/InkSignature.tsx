import { useEffect, useRef } from "react";

/**
 * InkSignature — an SVG "signature" that continuously re-draws itself
 * with a subtle ink-flow, and reacts to cursor proximity by intensifying.
 * Reinforces: identity is generated in-the-moment, under the user's control.
 */
export function InkSignature({
  label = "quiet-linen",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const wrap = wrapRef.current;
    if (!path || !wrap) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;

    let raf = 0;
    let t = 0;
    let proximity = 0;

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      // 0 near, 1 far
      const norm = Math.min(1, d / 320);
      proximity = 1 - norm;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const loop = () => {
      t += 0.008 + proximity * 0.02;
      // gently modulate the draw offset
      const offset = (Math.sin(t) * 0.5 + 0.5) * len * (0.35 - proximity * 0.28);
      path.style.strokeDashoffset = `${offset}`;
      path.style.opacity = `${0.55 + proximity * 0.45}`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`inline-flex flex-col items-start ${className}`}>
      <svg
        viewBox="0 0 360 90"
        className="h-[68px] w-[280px]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          ref={pathRef}
          d="M12 62 C 26 22, 46 22, 52 58 C 56 82, 78 78, 84 52 C 90 26, 108 26, 114 58 C 118 78, 138 82, 148 56 C 158 30, 178 34, 182 60 C 186 84, 210 78, 220 54 C 232 22, 258 24, 264 58 C 268 82, 296 82, 316 46 C 328 24, 344 22, 352 34"
          strokeWidth={1.6}
          style={{
            color: "var(--veil-glow)",
            filter: "drop-shadow(0 0 12px color-mix(in oklab, var(--veil-glow) 55%, transparent))",
            transition: "opacity 400ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <span className="mono mt-1 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
        @{label}
      </span>
    </div>
  );
}
