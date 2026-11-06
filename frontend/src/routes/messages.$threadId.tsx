import { Link, createFileRoute } from "@tanstack/react-router";
import React, { useState, useRef, useEffect } from "react";
import {
  ShieldCheck,
  Timer,
  Paperclip,
  Send,
  ChevronDown,
  ArrowLeft,
  X,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChats,
  fetchChatMessages,
  sendChatMessage,
  updateChatTimer,
  uploadChatAttachment,
  decryptChatMessage,
  type ChatAttachment as Attachment,
  getCurrentUser,
  getUserPublicKey,
} from "@/lib/api";
import { ChatAttachment } from "@/components/ChatAttachment";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

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
  const [attachedMedia, setAttachedMedia] = useState<Attachment | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const attachmentUrls = useRef(new Set<string>());
  useEffect(
    () => () => {
      for (const url of attachmentUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  const [uploading, setUploading] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document !== "undefined" ? !document.hidden : true,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pause polling when tab is hidden to save resources
  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const { data: chats = [] } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
  });

  const thread = chats.find((c: any) => c.id === threadId) || {
    handle: "User",
    color: "#8B5CF6",
    disappearing: "7d",
    deleteAfterSeconds: 604800,
  };

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chatMessages", threadId],
    queryFn: async () => {
      const previous =
        queryClient.getQueryData<any[]>(["chatMessages", threadId]) || [];
      const confirmed = previous.filter((message) => !message.sending);
      const after = confirmed.at(-1)?.id;
      const incoming = await fetchChatMessages(
        threadId,
        after ? { after } : undefined,
      );
      const merged = new Map(
        [...confirmed, ...incoming].map((message) => [message.id, message]),
      );
      return [...merged.values()]
        .filter(
          (message) =>
            !message.expiresAt ||
            new Date(message.expiresAt).getTime() > Date.now(),
        )
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
    },
    // Poll at 3s when visible, pause when tab is hidden
    refetchInterval: isPageVisible ? 3000 : false,
    refetchIntervalInBackground: false,
  });

  const [decryptedMessages, setDecryptedMessages] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      messages.map(async (message: any) => {
        try {
          return await decryptChatMessage(
            threadId,
            message,
            thread.recipientId,
          );
        } catch {
          return {
            ...message,
            body: "Unable to decrypt: the key for this message is unavailable on this device.",
          };
        }
      }),
    ).then((decoded) => {
      if (active) setDecryptedMessages(decoded);
    });
    return () => {
      active = false;
    };
  }, [messages, thread.recipientId, threadId]);

  const loadOlder = async () => {
    if (!messages[0]?.id || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const older = await fetchChatMessages(threadId, {
        before: messages[0].id,
      });
      setHasOlder(older.length === 50);
      queryClient.setQueryData<any[]>(["chatMessages", threadId], (current) => {
        const merged = new Map(
          [...older, ...(current || [])].map((message) => [
            message.id,
            message,
          ]),
        );
        return [...merged.values()].sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        );
      });
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : "Could not load earlier messages.",
      );
    } finally {
      setLoadingOlder(false);
    }
  };

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
  }, [decryptedMessages.length]);

  const sendMessageMutation = useMutation({
    mutationFn: ({
      body,
      mediaUrl,
    }: {
      body: string;
      mediaUrl: Attachment | null;
    }) => sendChatMessage(threadId, body, thread.recipientId, mediaUrl),
    onMutate: async ({ body, mediaUrl }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic state
      await queryClient.cancelQueries({ queryKey: ["chatMessages", threadId] });

      // Snapshot previous messages list
      const previousMessages = queryClient.getQueryData<any[]>([
        "chatMessages",
        threadId,
      ]);

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
        attachment: mediaUrl || null,
        mine: true,
        sending: true, // Styling hint for "pending" state
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      queryClient.setQueryData<any[]>(["chatMessages", threadId], (old) => {
        return old ? [...old, optimisticMsg] : [optimisticMsg];
      });

      return { previousMessages, currentDraft, currentMedia };
    },
    onError: (err, variables, context) => {
      setAttachmentError(err.message);
      // Rollback to previous message history on failure
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["chatMessages", threadId],
          context.previousMessages,
        );
      }
      // Restore inputs so user does not lose draft content
      if (context?.currentDraft) {
        setDraft(context.currentDraft);
      }
      if (context?.currentMedia) {
        setAttachedMedia(context.currentMedia);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<any[]>(["chatMessages", threadId], (current) =>
        (current || []).filter((message) => !message.sending),
      );
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
    { label: "1 Hour", seconds: 3600 },
    { label: "12 Hours", seconds: 43200 },
    { label: "1 Day", seconds: 86400 },
    { label: "3 Days", seconds: 259200 },
    { label: "7 Days (Max)", seconds: 604800 },
  ];

  const handleSend = () => {
    if (!draft.trim() && !attachedMedia) return;
    setAttachmentError("");
    sendMessageMutation.mutate({ body: draft, mediaUrl: attachedMedia });
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setAttachmentError("");
      const uploaded = await uploadChatAttachment(file, threadId);
      if (uploaded.previewUrl) attachmentUrls.current.add(uploaded.previewUrl);
      setAttachedMedia(uploaded);
    } catch (err: any) {
      setAttachmentError(err.message || "Attachment failed.");
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
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 sm:px-5 py-3.5 relative z-30 bg-card/90 border-b border-border backdrop-blur-xl"
        style={{
          paddingTop: "max(12px, calc(10px + env(safe-area-inset-top, 0px)))",
        }}
      >
        {/* Back to list (mobile only) */}
        <Link
          to="/messages"
          className="mr-0.5 rounded-full p-2 text-muted-foreground hover:text-foreground transition hover:bg-muted active:scale-90 lg:hidden"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        {/* Avatar */}
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white border border-border"
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
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
          </p>
          <p className="text-[11px] text-muted-foreground">
            Zero-knowledge link active
          </p>
        </div>

        {/* Timer dropdown */}
        <div className="relative shrink-0">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 transition hover:bg-amber-500/20"
          >
            <Timer className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span className="hidden sm:inline">Delete: </span>
            {thread.disappearing || "7d"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform duration-200",
                showTimerMenu && "rotate-180",
              )}
            />
          </motion.button>

          <AnimatePresence>
            {showTimerMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowTimerMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ type: "spring", stiffness: 450, damping: 28 }}
                  className="absolute right-0 z-50 mt-2 w-44 rounded-2xl p-1.5 bg-card/95 border border-border shadow-[0_0_30px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
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
                          "w-full text-left rounded-xl px-3 py-2 text-xs transition-colors",
                          isCurrent
                            ? "font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
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
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {/* Encrypted notice */}
        <div className="mx-auto mb-3 w-fit max-w-[85%] rounded-full px-4 py-1 text-center text-[11px] font-mono text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25">
          Encrypted · auto-deleted after {thread.disappearing || "7d"}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3 pt-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className={cn("flex", i % 2 ? "justify-start" : "justify-end")}
              >
                <div className="h-10 w-40 rounded-2xl animate-pulse bg-muted/60 border border-border" />
              </div>
            ))}
          </div>
        )}

        {hasOlder && messages.length >= 50 && (
          <button
            type="button"
            disabled={loadingOlder}
            onClick={loadOlder}
            className="mx-auto block rounded-lg border border-border px-3 py-2 text-xs"
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {/* Empty state */}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-muted-foreground">
            <span className="text-3xl">✨</span>
            <p className="text-xs">
              Zero signals recorded yet. Start transmitting!
            </p>
          </div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {!isLoading &&
            decryptedMessages.map((m: any) => (
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
                  mass: 0.8,
                }}
                className={cn(
                  "flex w-full",
                  m.mine ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed shadow-md transition-all duration-200",
                    m.mine
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium rounded-2xl rounded-tr-xs shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                      : "bg-card border border-border text-foreground rounded-2xl rounded-tl-xs",
                    m.sending && "opacity-70 cursor-not-allowed select-none",
                  )}
                >
                  {m.attachment && <ChatAttachment attachment={m.attachment} />}
                  {m.body && <MarkdownRenderer content={m.body} />}
                  <span
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px] select-none",
                      m.mine ? "text-black/60" : "text-muted-foreground",
                    )}
                  >
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
        className="shrink-0 px-3 sm:px-4 py-3 bg-card/95 border-t border-border backdrop-blur-xl"
        style={{
          paddingBottom:
            "max(14px, calc(10px + env(safe-area-inset-bottom, 0px)))",
        }}
      >
        {attachmentError && (
          <p role="alert" className="mb-2 text-sm text-red-500">
            {attachmentError}
          </p>
        )}
        {/* Attached media preview */}
        {attachedMedia && (
          <div className="relative mb-2 inline-block rounded-xl p-1.5 bg-muted/40 border border-border">
            <div className="max-w-40">
              <ChatAttachment attachment={attachedMedia} />
            </div>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => setAttachedMedia(null)}
              className="absolute -right-1.5 -top-1.5 rounded-full p-0.5 text-white bg-red-500 hover:bg-red-600 transition"
            >
              <X className="h-3 w-3" />
            </motion.button>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 px-3 py-2.5 rounded-2xl bg-muted/40 border border-border focus-within:border-amber-500/40 focus-within:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all">
          {/* Hidden file input */}
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg"
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
            className="shrink-0 p-1.5 text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Attach photo or video"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500 dark:text-amber-400" />
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
            placeholder="Type encrypted message…"
            className="flex-1 resize-none bg-transparent text-sm leading-6 outline-none text-foreground placeholder:text-muted-foreground"
            style={{
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
            disabled={
              sendMessageMutation.isPending || (!draft.trim() && !attachedMedia)
            }
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 transition shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-35"
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
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground font-mono hidden sm:block">
          Enter to transmit · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
