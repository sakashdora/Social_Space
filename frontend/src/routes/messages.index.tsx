import { createFileRoute } from "@tanstack/react-router";
import { MessageSquareLock } from "lucide-react";

export const Route = createFileRoute("/messages/")({
  component: EmptyThread,
});

function EmptyThread() {
  return (
    <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.04] text-[color:var(--veil-glow)]">
        <MessageSquareLock className="h-6 w-6" />
      </div>
      <p className="mt-5 font-serif text-2xl">Pick a thread.</p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        All conversations here are end-to-end encrypted. The server carries ciphertext — it never learns who spoke to whom.
      </p>
    </div>
  );
}
