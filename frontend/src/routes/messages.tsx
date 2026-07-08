import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { Timer, Plus, AlertCircle } from "lucide-react";
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
          "End-to-end encrypted 1:1 messaging. Sealed sender. Per-thread disappearing timers.",
      },
      { property: "og:title", content: "Messages — Veil" },
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
    refetchInterval: 4000,
  });

  const createChatMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (data) => {
      setNewHandle("");
      setErrorMsg("");
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate({ to: "/messages/$threadId", params: { threadId: data.threadId } });
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
    <div
      className={cn(
        "flex h-full w-full overflow-hidden flex-col lg:flex-row",
        "pb-[76px] lg:pb-0" // Pad on mobile to clear bottom floating menu
      )}
    >
      {/* ─── Thread list sidebar ──────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col shrink-0 overflow-hidden h-full",
          // Mobile: full-width panel shown when no thread active; hidden when viewing a thread
          active ? "hidden lg:flex" : "flex",
          // Desktop: fixed 300px wide sidebar
          "lg:w-[300px]"
        )}
        style={{
          borderRight: "1px solid var(--surface-border)",
        }}
      >
        {/* Compact header */}
        <div
          className="shrink-0 px-5 pt-6 pb-4"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            End-to-end encrypted
          </p>
          <h1 className="mt-1 font-serif text-3xl leading-tight">Messages</h1>
        </div>

        {/* New chat form */}
        <form
          onSubmit={handleStartChat}
          className="shrink-0 px-4 py-3"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-shadow"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
            }}
          >
            <span className="text-xs text-muted-foreground select-none">@</span>
            <input
              type="text"
              placeholder="Start chat with handle..."
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--input-text)" }}
            />
            <button
              type="submit"
              disabled={createChatMutation.isPending}
              className="rounded-lg p-1.5 text-ink transition hover:brightness-110 disabled:opacity-40"
              style={{ background: "var(--veil-glow)" }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {errorMsg && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[color:var(--danger)]">
              <AlertCircle className="h-3 w-3" /> {errorMsg}
            </p>
          )}
        </form>

        {/* Thread list — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full" style={{ background: "var(--surface-bg)" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded" style={{ background: "var(--surface-bg)" }} />
                    <div className="h-2 w-1/2 rounded" style={{ background: "var(--surface-bg)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No active conversations. Start one above.
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
                      className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                      style={{
                        borderBottom: "1px solid var(--surface-border)",
                        backgroundColor: isActive ? "var(--nav-active-bg)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          (e.currentTarget as HTMLElement).style.backgroundColor = "";
                      }}
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${t.color} 40%, black))`,
                        }}
                      >
                        {t.handle.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium text-foreground">
                            @{t.handle}
                          </p>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                            {t.time}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.preview}</p>
                        {t.disappearing && t.disappearing !== "Off" && (
                          <span
                            className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}
                          >
                            <Timer className="h-2.5 w-2.5" />
                            {t.disappearing}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ─── Thread panel ──────────────────────────────────────────── */}
      <section
        className={cn(
          "min-w-0 flex-1 h-full",
          // Mobile: shown only when a thread is active
          active ? "flex flex-col" : "hidden lg:flex lg:flex-col"
        )}
      >
        <Outlet />
      </section>
    </div>
  );
}
