import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareLock, ShieldCheck, KeyRound, Timer } from "lucide-react";

export const Route = createFileRoute("/messages/")({
  component: EmptyThread,
});

function EmptyThread() {
  return (
    <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      {/* Premium Floating Glassmorphic Card */}
      <div
        className="frost grain-panel max-w-md rounded-3xl p-8 text-center transition-all duration-300 hover:scale-[1.01]"
        style={{
          border: "1px solid var(--surface-border)",
        }}
      >
        {/* Animated Glow Lock Icon */}
        <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.03] text-[color:var(--veil-glow)] shadow-[0_8px_32px_rgba(var(--veil-glow),0.1)]">
          <div className="absolute inset-0 rounded-2xl bg-[color:var(--veil-glow)]/10 blur-xl animate-pulse" />
          <MessageSquareLock className="relative h-7 w-7 z-10" />
        </div>

        <h2 className="font-serif text-2xl tracking-tight text-foreground">
          Secure Messaging Space
        </h2>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Select an active contact from the sidebar or start a new secure communication channel by
          entering their handle.
        </p>

        {/* Feature List for trust and platform capabilities */}
        <div className="mt-8 space-y-3.5 text-left">
          <div className="flex items-start gap-3.5 rounded-2xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <div className="mt-0.5 rounded-lg bg-[color:var(--veil-glow)]/10 p-1.5 text-[color:var(--veil-glow)]">
              <KeyRound className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Local Encryption</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">
                Messages are encrypted locally before leaving your device. Only the recipient can
                read them.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <div className="mt-0.5 rounded-lg bg-[color:var(--veil-glow)]/10 p-1.5 text-[color:var(--veil-glow)]">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Sealed Metadata</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">
                Sender identities are securely sealed. The server handles delivery without knowing
                who spoke to whom.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl bg-white/[0.02] p-3 border border-white/[0.04]">
            <div className="mt-0.5 rounded-lg bg-[color:var(--veil-glow)]/10 p-1.5 text-[color:var(--veil-glow)]">
              <Timer className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-foreground">Self-Destruct Timers</h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">
                Configure disappearing timers per conversation to automatically wipe message
                histories on both ends.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
