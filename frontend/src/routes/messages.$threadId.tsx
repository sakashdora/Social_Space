import { Link, createFileRoute } from "@tanstack/react-router";
import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck, Timer, Paperclip, Send, ChevronDown, ArrowLeft, X, Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChats, fetchChatMessages, sendChatMessage, updateChatTimer, uploadMedia,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$threadId")({
  component: Thread,
  notFoundComponent: () => (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      Thread not found.
    </div>
  ),
});

function Thread() {
  const { threadId } = Route.useParams();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState("");
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: chats = [] } = useQuery({ queryKey: ["chats"], queryFn: fetchChats });

  const thread = chats.find((c: any) => c.id === threadId) || {
    handle: "User",
    color: "#8B5CF6",
    disappearing: "7d",
    deleteAfterSeconds: 604800,
  };

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chatMessages", threadId],
    queryFn: () => fetchChatMessages(threadId),
    refetchInterval: 2500,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ body, mediaUrl }: { body: string; mediaUrl: string | null }) =>
      sendChatMessage(threadId, body, mediaUrl),
    onSuccess: () => {
      setDraft("");
      setAttachedMedia(null);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "24px";
      }
      queryClient.invalidateQueries({ queryKey: ["chatMessages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const updateTimerMutation = useMutation({
    mutationFn: (seconds: number) => updateChatTimer(threadId, seconds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });

  const timerOptions = [
    { label: "1 Hour",       seconds: 3600 },
    { label: "12 Hours",     seconds: 43200 },
    { label: "1 Day",        seconds: 86400 },
    { label: "3 Days",       seconds: 259200 },
    { label: "7 Days (Max)", seconds: 604800 },
  ];

  const handleSend = () => {
    if (!draft.trim() && !attachedMedia) return;
    sendMessageMutation.mutate({ body: draft, mediaUrl: attachedMedia });
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file);
      setAttachedMedia(url);
    } catch (err: any) {
      console.error("Attachment failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    // Auto-grow: reset then expand to fit
    e.target.style.height = "24px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  /*
   * Layout: 3-row flex column that fills the parent section 100%
   *  ┌──────────────────────────────────┐  ← shrink-0 header
   *  │  @handle  [timer dropdown]       │
   *  ├──────────────────────────────────┤
   *  │                                  │  ← flex-1 overflow-y-auto messages
   *  │        messages go here          │
   *  │                                  │
   *  ├──────────────────────────────────┤
   *  │  📎  Type a message…    [Send]   │  ← shrink-0 compose bar
   *  └──────────────────────────────────┘
   */
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── HEADER — pinned at top ────────────────────────────────── */}
      <header
        className="flex shrink-0 items-center gap-3 px-5 py-3.5 relative z-30"
        style={{ borderBottom: "1px solid var(--surface-border)" }}
      >
        {/* Back to list (mobile only) */}
        <Link
          to="/messages"
          className="mr-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground transition lg:hidden"
          onMouseEnter={(e) =>
            (e.currentTarget as HTMLElement).style.background = "var(--surface-hover)"
          }
          onMouseLeave={(e) =>
            (e.currentTarget as HTMLElement).style.background = "transparent"
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Avatar */}
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
          style={{
            background: `linear-gradient(135deg, ${thread.color}, color-mix(in oklab, ${thread.color} 40%, black))`,
          }}
        >
          {thread.handle.slice(0, 2).toUpperCase()}
        </span>

        {/* Name + subtitle */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            @{thread.handle}
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[color:var(--safe)]" />
          </p>
          <p className="text-[11px] text-muted-foreground">Disappearing timer active</p>
        </div>

        {/* Timer dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}
          >
            <Timer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Delete: </span>
            {thread.disappearing || "7d"}
            <ChevronDown
              className={cn("h-3 w-3 transition-transform duration-200", showTimerMenu && "rotate-180")}
            />
          </button>

          {showTimerMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTimerMenu(false)} />
              <div
                className="absolute right-0 z-50 mt-2 w-44 rounded-xl p-1"
                style={{
                  background: "var(--dialog-bg)",
                  border: "1px solid var(--surface-border)",
                  boxShadow: "0 8px 32px oklch(0 0 0 / 22%), 0 2px 8px oklch(0 0 0 / 12%)",
                }}
              >
                {timerOptions.map((opt) => {
                  const isCurrent = thread.deleteAfterSeconds === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      onClick={() => {
                        updateTimerMutation.mutate(opt.seconds);
                        setShowTimerMenu(false);
                      }}
                      className={cn(
                        "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors",
                        isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
                      )}
                      style={{
                        backgroundColor: isCurrent ? "var(--nav-active-bg)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrent)
                          (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrent)
                          (e.currentTarget as HTMLElement).style.backgroundColor = "";
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── MESSAGES — scrollable middle region ───────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
        {/* Encrypted notice */}
        <div
          className="mx-auto mb-3 w-fit max-w-[85%] rounded-full px-4 py-1.5 text-center text-[11px] text-muted-foreground"
          style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}
        >
          Encrypted · auto-deleted after {thread.disappearing || "7d"}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3 pt-4">
            {[1, 2].map((i) => (
              <div key={i} className={cn("flex", i % 2 ? "justify-start" : "justify-end")}>
                <div
                  className="h-10 w-40 rounded-2xl animate-pulse"
                  style={{ background: "var(--surface-bg)" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <span className="text-3xl">👋</span>
            <p className="text-xs">No messages yet. Say hello!</p>
          </div>
        )}

        {/* Message bubbles */}
        {!isLoading &&
          messages.map((m: any) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm",
                  m.mine ? "msg-out" : "msg-in",
                )}
              >
                {m.mediaUrl && (
                  <div className="mb-2 overflow-hidden rounded-xl max-w-[260px]">
                    {m.mediaUrl.startsWith("data:video/") ? (
                      <video src={m.mediaUrl} controls className="w-full max-h-44 rounded-xl object-cover" />
                    ) : (
                      <img src={m.mediaUrl} alt="Chat media" className="w-full max-h-44 rounded-xl object-cover" />
                    )}
                  </div>
                )}
                {m.body && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
                <span className="mt-1 block text-right text-[10px] opacity-50">{m.time}</span>
              </div>
            </div>
          ))}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── COMPOSE BAR — pinned at bottom ───────────────────────── */}
      <div
        className="shrink-0 px-3 py-2.5"
        style={{ borderTop: "1px solid var(--surface-border)" }}
      >
        {/* Attached media preview */}
        {attachedMedia && (
          <div
            className="relative mb-2 inline-block rounded-xl p-1.5"
            style={{ background: "var(--surface-bg)", border: "1px solid var(--surface-border)" }}
          >
            {attachedMedia.startsWith("data:video/") ? (
              <video src={attachedMedia} className="h-14 w-14 rounded-lg object-cover" />
            ) : (
              <img src={attachedMedia} alt="" className="h-14 w-14 rounded-lg object-cover" />
            )}
            <button
              onClick={() => setAttachedMedia(null)}
              className="absolute -right-1.5 -top-1.5 rounded-full p-0.5 text-white transition hover:brightness-110"
              style={{ background: "var(--danger)" }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-2.5 input-surface !rounded-2xl">
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
            ref={fileInputRef}
            onChange={handleFileAttach}
            className="hidden"
          />

          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            title="Attach photo or video"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--veil-glow)]" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>

          {/* Auto-grow textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            onChange={handleTextareaChange}
            placeholder="Type a message…"
            className="flex-1 resize-none bg-transparent text-sm leading-6 outline-none"
            style={{
              color: "var(--input-text)",
              minHeight: "24px",
              maxHeight: "120px",
              overflowY: "auto",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sendMessageMutation.isPending || (!draft.trim() && !attachedMedia)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-35"
            style={{ background: "var(--veil-glow)" }}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
