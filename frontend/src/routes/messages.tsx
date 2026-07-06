import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Timer, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChats, createChat } from "@/lib/api";
import React, { useState } from "react";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Veil" },
      {
        name: "description",
        content:
          "End-to-end encrypted 1:1 messaging. Sealed sender. Per-thread disappearing timers. The server never learns who spoke to whom.",
      },
      { property: "og:title", content: "Messages — Veil" },
      { property: "og:description", content: "E2EE. Sealed sender. Nothing to subpoena." },
    ],
  }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname.split("/")[2];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [newHandle, setNewHandle] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    refetchInterval: 4000, // Dynamic polling for real-time responsiveness
  });

  const createChatMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (data) => {
      setNewHandle("");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate({
        to: "/messages/$threadId",
        params: { threadId: data.threadId },
      });
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to start conversation.");
    },
  });

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandle.trim()) return;
    createChatMutation.mutate(newHandle.trim());
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:pt-14">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">End-to-end encrypted</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Messages</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className={cn(
          "rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden",
          active ? "hidden lg:block" : "block"
        )}>
          {/* Initiate New Chat */}
          <form onSubmit={handleStartChat} className="border-b border-white/5 p-4">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">@</span>
              <input
                type="text"
                placeholder="Start chat with handle..."
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 text-foreground"
              />
              <button
                type="submit"
                disabled={createChatMutation.isPending}
                className="rounded-lg bg-[color:var(--veil-glow)] p-1.5 text-ink transition hover:brightness-110 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {errorMsg && (
              <p className="mt-2 flex items-center gap-1 text-[10px] text-red-400">
                <AlertCircle className="h-3 w-3" /> {errorMsg}
              </p>
            )}
          </form>

          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 bg-white/5 rounded" />
                    <div className="h-2 w-1/2 bg-white/5 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No active conversations yet. Start one above.
            </div>
          ) : (
            <ul>
              {threads.map((t: any) => {
                const isActive = active === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      to="/messages/$threadId"
                      params={{ threadId: t.id }}
                      className={cn(
                        "flex items-start gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 transition hover:bg-white/[0.03]",
                        isActive && "bg-white/[0.05]",
                      )}
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${t.color} 40%, black))` }}
                      >
                        {t.handle.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">@{t.handle}</p>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{t.time}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.preview}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {t.disappearing && t.disappearing !== "Off" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              <Timer className="h-2.5 w-2.5" />
                              {t.disappearing}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className={cn(
          "min-h-[500px] lg:min-h-[560px] rounded-2xl border border-white/5 bg-white/[0.02]",
          active ? "block" : "hidden lg:block"
        )}>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
