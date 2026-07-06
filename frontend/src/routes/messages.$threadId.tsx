import { Link, createFileRoute } from "@tanstack/react-router";
import React, { useState, useRef } from "react";
import { ShieldCheck, Timer, Paperclip, Send, ChevronDown, ArrowLeft, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChats, fetchChatMessages, sendChatMessage, updateChatTimer, uploadMedia } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$threadId")({
  component: Thread,
  notFoundComponent: () => (
    <div className="grid h-full min-h-[560px] place-items-center text-sm text-muted-foreground">
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

  // Fetch thread metadata from the list query cache
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

  // Fetch real messages inside this thread
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["chatMessages", threadId],
    queryFn: () => fetchChatMessages(threadId),
    refetchInterval: 2500, // Poll every 2.5s for snappy real-time messages
  });

  // Mutator to send message
  const sendMessageMutation = useMutation({
    mutationFn: ({ body, mediaUrl }: { body: string; mediaUrl: string | null }) =>
      sendChatMessage(threadId, body, mediaUrl),
    onSuccess: () => {
      setDraft("");
      setAttachedMedia(null);
      queryClient.invalidateQueries({ queryKey: ["chatMessages", threadId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  // Mutator to update disappearing timer settings
  const updateTimerMutation = useMutation({
    mutationFn: (seconds: number) => updateChatTimer(threadId, seconds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
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
    sendMessageMutation.mutate({ body: draft, mediaUrl: attachedMedia });
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file);
      setAttachedMedia(url);
    } catch (err) {
      console.error("Attachment failed:", err);
      alert("Failed to process media attachment.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4 relative z-30">
        <Link 
          to="/messages"
          className="mr-1 rounded-full p-1.5 hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground lg:hidden transition"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </Link>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${thread.color}, color-mix(in oklab, ${thread.color} 40%, black))` }}
        >
          {thread.handle.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            @{thread.handle}
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--safe)]" />
          </p>
          <p className="text-xs text-muted-foreground">
            Disappearing timer active
          </p>
        </div>

        {/* Dynamic Adjustable Auto-Delete Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Timer className="h-3.5 w-3.5" />
            Delete: {thread.disappearing || "7d"}
            <ChevronDown className="h-3 w-3" />
          </button>
          
          {showTimerMenu && (
            <div className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-zinc-950 p-1 shadow-xl">
              {timerOptions.map((opt) => (
                <button
                  key={opt.seconds}
                  onClick={() => {
                    updateTimerMutation.mutate(opt.seconds);
                    setShowTimerMenu(false);
                  }}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition",
                    thread.deleteAfterSeconds === opt.seconds && "bg-white/5 text-foreground font-semibold"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Message viewport */}
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-xs rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-center text-[11px] text-muted-foreground">
          Encrypted session. Chat history auto-deleted after {thread.disappearing || "7d"}.
        </div>

        {isLoading ? (
          <div className="space-y-4 pt-10">
            {[1, 2].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <div className="h-10 w-48 bg-white/5 rounded-2xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-xs text-muted-foreground py-20">
            No messages here yet. Say hello!
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed",
                  m.mine
                    ? "rounded-br-md bg-[color:var(--veil)] text-primary-foreground"
                    : "rounded-bl-md bg-white/[0.05]",
                )}
              >
                {/* Media Attachment Viewer */}
                {m.mediaUrl && (
                  <div className="mb-2 overflow-hidden rounded-lg max-w-[280px]">
                    {m.mediaUrl.startsWith("data:video/") ? (
                      <video src={m.mediaUrl} controls className="w-full object-cover max-h-40 rounded" />
                    ) : (
                      <img src={m.mediaUrl} alt="Chat media" className="w-full object-cover max-h-40 rounded" />
                    )}
                  </div>
                )}
                {m.body && <p className="break-words">{m.body}</p>}
                <span className="mt-1 block text-[10px] opacity-60 text-right">{m.time}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Attachment Previews and Toolbar */}
      <div className="border-t border-white/5 p-3 bg-black/10">
        {attachedMedia && (
          <div className="relative inline-block mb-2 p-1.5 border border-white/10 bg-white/[0.02] rounded-xl">
            {attachedMedia.startsWith("data:video/") ? (
              <video src={attachedMedia} className="h-16 w-16 object-cover rounded-lg" />
            ) : (
              <img src={attachedMedia} className="h-16 w-16 object-cover rounded-lg" />
            )}
            <button
              onClick={() => setAttachedMedia(null)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 p-0.5 text-white hover:brightness-110"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
          {/* File input listener */}
          <input
            type="file"
            accept="image/*,video/*"
            ref={fileInputRef}
            onChange={handleFileAttach}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-muted-foreground hover:text-foreground transition p-1"
            title="Attach photo/video"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--veil-glow)]" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            className="max-h-32 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 text-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() && !attachedMedia}
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--veil-glow)] px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
