import { useEffect, useRef, useState } from "react";

/**
 * A weightless circular cursor. Grows and softens over interactive elements.
 * Hidden on touch / coarse pointers.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(pointer: fine)");
    setEnabled(mq.matches);
    const onChange = () => setEnabled(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const move = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest?.(
        "a, button, [role='button'], input, textarea, select, label, [data-cursor='hover']",
      );
      setHover(interactive);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const leave = () => {
      target.current.x = -100;
      target.current.y = -100;
    };

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    window.addEventListener("mouseleave", leave);

    let raf = 0;
    const loop = () => {
      // weighted trail — slow-in on the ring
      ring.current.x += (target.current.x - ring.current.x) * 0.16;
      ring.current.y += (target.current.y - ring.current.y) * 0.16;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mouseleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full"
        style={{
          width: hover ? 44 : 26,
          height: hover ? 44 : 26,
          border:
            "1px solid color-mix(in oklab, var(--veil-glow) 55%, transparent)",
          background: hover
            ? "color-mix(in oklab, var(--veil-glow) 6%, transparent)"
            : "transparent",
          transition:
            "width 500ms cubic-bezier(0.22,1,0.36,1), height 500ms cubic-bezier(0.22,1,0.36,1), background 400ms ease, opacity 400ms ease",
          opacity: pressed ? 0.6 : 1,
        }}
      />
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[101] rounded-full"
        style={{
          width: pressed ? 3 : 5,
          height: pressed ? 3 : 5,
          background: "var(--veil-glow)",
          boxShadow:
            "0 0 12px color-mix(in oklab, var(--veil-glow) 60%, transparent)",
          transition:
            "width 300ms cubic-bezier(0.22,1,0.36,1), height 300ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
    </>
  );
}
