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
import { motion, AnimatePresence } from "framer-motion";

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll immediately when opening a new thread
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
    return () => clearTimeout(timer);
  }, [threadId]);

  // Smooth scroll when message list length updates
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const sendMessageMutation = useMutation({
    mutationFn: ({ body, mediaUrl }: { body: string; mediaUrl: string | null }) =>
      sendChatMessage(threadId, body, mediaUrl),
    onMutate: async ({ body, mediaUrl }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic state
      await queryClient.cancelQueries({ queryKey: ["chatMessages", threadId] });

      // Snapshot previous messages list
      const previousMessages = queryClient.getQueryData<any[]>(["chatMessages", threadId]);

      // Cache input states for potential rollback
      const currentDraft = draft;
      const currentMedia = attachedMedia;

      // Clear compose bar inputs instantly
      setDraft("");
      setAttachedMedia(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "24px";
      }

      // Optimistically append the sending message
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        body: body || "",
        mediaUrl: mediaUrl || null,
        mine: true,
        sending: true, // Styling hint for "pending" state
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      queryClient.setQueryData<any[]>(["chatMessages", threadId], (old) => {
        return old ? [...old, optimisticMsg] : [optimisticMsg];
      });

      return { previousMessages, currentDraft, currentMedia };
    },
    onError: (err, variables, context) => {
      // Rollback to previous message history on failure
      if (context?.previousMessages) {
        queryClient.setQueryData(["chatMessages", threadId], context.previousMessages);
      }
      // Restore inputs so user does not lose draft content
      if (context?.currentDraft) {
        setDraft(context.currentDraft);
      }
      if (context?.currentMedia) {
        setAttachedMedia(context.currentMedia);
      }
    },
    onSettled: () => {
      // Re-fetch to align with true DB state
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
    // Auto-grow height handling
    e.target.style.height = "24px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

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
          className="mr-1 rounded-full p-1.5 text-muted-foreground hover:text-foreground transition hover:bg-[var(--surface-hover)] active:scale-90 lg:hidden"
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
          <motion.button
            whileTap={{ scale: 0.95 }}
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
          </motion.button>

          <AnimatePresence>
            {showTimerMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTimerMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
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
                          "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors active:bg-[var(--surface-hover)]",
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
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── MESSAGES — scrollable middle region ───────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
        {/* Encrypted notice */}
        <div
          className="mx-auto mb-3 w-fit max-w-[85%] rounded-full px-4 py-1.5 text-center text-[11px] text-muted-foreground"
          style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}
        >
          Transit Secured · auto-deleted after {thread.disappearing || "7d"}
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
        <AnimatePresence initial={false}>
          {!isLoading &&
            messages.map((m: any) => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 30,
                  mass: 0.8
                }}
                className={cn("flex w-full", m.mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[75%] px-4 py-2.5 text-[14px] leading-relaxed shadow-sm transition-all duration-200",
                    m.mine ? "msg-out" : "msg-in",
                    m.sending && "opacity-70 cursor-not-allowed select-none"
                  )}
                >
                  {m.mediaUrl && (
                    <div className="mb-2 overflow-hidden rounded-xl max-w-[260px]">
                      {m.mediaUrl.startsWith("data:video/") ? (
                        <video 
                          src={m.mediaUrl} 
                          controls 
                          className="w-full max-h-44 rounded-xl object-cover" 
                          onLoadedData={scrollToBottom}
                        />
                      ) : (
                        <img 
                          src={m.mediaUrl} 
                          alt="Chat media" 
                          className="w-full max-h-44 rounded-xl object-cover" 
                          onLoad={scrollToBottom}
                        />
                      )}
                    </div>
                  )}
                  {m.body && <p className="break-words whitespace-pre-wrap">{m.body}</p>}
                  <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-50 select-none">
                    {m.sending ? (
                      <>
                        <span>Sending</span>
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      </>
                    ) : (
                      m.time
                    )}
                  </span>
                </div>
              </motion.div>
            ))}
        </AnimatePresence>

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
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setAttachedMedia(null)}
              className="absolute -right-1.5 -top-1.5 rounded-full p-0.5 text-white transition hover:brightness-110"
              style={{ background: "var(--danger)" }}
            >
              <X className="h-3 w-3" />
            </motion.button>
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
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
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
          </motion.button>

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
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
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
          </motion.button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
