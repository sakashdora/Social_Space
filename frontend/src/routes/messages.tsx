import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { Timer, Plus, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchChats,
  createChat,
  getMe,
  updateChatPublicKey,
  getCurrentUser,
  threadKeyCache,
} from "@/lib/api";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [showKeyResetDialog, setShowKeyResetDialog] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
  });

  React.useEffect(() => {
    if (!me) return;

    async function checkKeys(activeUser: NonNullable<typeof me>) {
      try {
        const {
          getKeyRecord,
          generateChatKeyPair,
          exportPublicKeyBase64,
          saveKeyRecord,
        } = await import("@/lib/crypto");
        const record = await getKeyRecord(activeUser.id);

        if (!record) {
          if (!activeUser.chatPublicKey) {
            const keyPair = await generateChatKeyPair();
            const pubKeyB64 = await exportPublicKeyBase64(keyPair.publicKey);
            await saveKeyRecord(activeUser.id, {
              privateKey: keyPair.privateKey,
              publicKeyBase64: pubKeyB64,
            });
            await updateChatPublicKey(pubKeyB64);
            queryClient.invalidateQueries({ queryKey: ["me"] });
          } else {
            console.warn(
              "Key loss detected: Local key is missing, but registered on server.",
            );
            setShowKeyResetDialog(true);
          }
        } else {
          if (!activeUser.chatPublicKey) {
            await updateChatPublicKey(record.publicKeyBase64);
            queryClient.invalidateQueries({ queryKey: ["me"] });
          } else if (record.publicKeyBase64 !== activeUser.chatPublicKey) {
            console.warn(
              "Key mismatch detected between local key and server key.",
            );
            setShowKeyResetDialog(true);
          }
        }
      } catch (err: any) {
        console.error("Key verification error:", err);
      }
    }

    checkKeys(me);
  }, [me, queryClient]);

  const handleKeyReset = async () => {
    const currentMe = me;
    if (!currentMe) return;
    try {
      const { generateChatKeyPair, exportPublicKeyBase64, saveKeyRecord } =
        await import("@/lib/crypto");
      const keyPair = await generateChatKeyPair();
      const pubKeyB64 = await exportPublicKeyBase64(keyPair.publicKey);
      await saveKeyRecord(currentMe.id, {
        privateKey: keyPair.privateKey,
        publicKeyBase64: pubKeyB64,
      });
      await updateChatPublicKey(pubKeyB64);
      setShowKeyResetDialog(false);
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["chatMessages"] });
    } catch (err: any) {
      console.error("Failed to reset keys:", err);
      setErrorMsg("Failed to reset chat keys.");
    }
  };

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
    <div
      className={cn(
        "cosmic-theme min-h-screen text-white flex h-full w-full overflow-hidden flex-col lg:flex-row",
        "pb-[88px] lg:pb-0", // Pad on mobile to clear bottom floating menu + safe area
      )}
    >
      {/* Thread list sidebar */}
      <aside
        className={cn(
          "flex flex-col shrink-0 overflow-hidden h-full bg-[#0c1017]/90 border-r border-white/10 backdrop-blur-xl",
          active ? "hidden lg:flex" : "flex",
          "lg:w-[320px]",
        )}
      >
        {/* Compact header */}
        <div className="shrink-0 px-5 pt-6 pb-4 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
            E2EE Sealed Sender
          </p>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-white">
            Messages
          </h1>
        </div>

        {/* New chat form */}
        <form
          onSubmit={handleStartChat}
          className="shrink-0 px-4 py-3 border-b border-white/10"
        >
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-amber-500/40 focus-within:shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all">
            <span className="text-xs text-amber-400 select-none">@</span>
            <input
              type="text"
              placeholder="Chat with @handle..."
              value={newHandle}
              onChange={(e) => setNewHandle(e.target.value)}
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
            />
            <motion.button
              type="submit"
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              disabled={createChatMutation.isPending}
              className="shrink-0 rounded-lg bg-amber-500 p-1 text-black transition hover:bg-amber-400 disabled:opacity-40"
            >
              {createChatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </motion.button>
          </div>
          {errorMsg && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </p>
          )}
        </form>

        {/* List of active direct message chats */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {isLoading ? (
            <div className="space-y-2.5 px-3 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <div className="h-9 w-9 rounded-full bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
                    <div className="h-2 w-32 rounded bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : threads.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-center px-4">
              <p className="text-xs text-white/40">
                No active conversations yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {threads.map((t: any) => {
                const isCurrent = active === t.id;
                return (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  >
                    <Link
                      to="/messages/$threadId"
                      params={{ threadId: t.id }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 select-none relative group border",
                        isCurrent
                          ? "bg-amber-500/10 text-white border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.12)]"
                          : "hover:bg-white/[0.03] text-white/70 hover:text-white border-transparent",
                      )}
                    >
                      {/* Active indicator bar */}
                      {isCurrent && (
                        <motion.span
                          layoutId="active-thread-indicator"
                          className="absolute left-1 top-3 bottom-3 w-1 rounded-full bg-amber-400"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}

                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white border border-white/20"
                        style={{
                          background: `linear-gradient(135deg, ${t.color}, color-mix(in oklab, ${t.color} 40%, black))`,
                        }}
                      >
                        {t.handle.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-white">
                            @{t.handle}
                          </p>
                          <span className="ml-auto shrink-0 text-[10px] text-white/40">
                            {t.time}
                          </span>
                        </div>
                        <ThreadPreview
                          preview={t.preview}
                          threadId={t.id}
                          recipientId={t.recipientId}
                        />
                        {t.disappearing && t.disappearing !== "Off" && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25">
                            <Timer className="h-2.5 w-2.5" />
                            {t.disappearing}
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread panel */}
      <section
        className={cn(
          "min-w-0 flex-1 h-full bg-[#06070a]/60 backdrop-blur-xl",
          active ? "flex flex-col" : "hidden lg:flex lg:flex-col",
        )}
      >
        <Outlet />
      </section>

      {/* Key Reset Warning Modal */}
      <AnimatePresence>
        {showKeyResetDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full rounded-3xl p-6 text-center shadow-2xl border border-amber-500/30 bg-[#0c1017] text-white"
            >
              <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="font-serif text-xl font-bold tracking-tight text-white">
                Chat Keys Out of Sync
              </h2>
              <p className="mt-3 text-xs text-white/60 leading-relaxed">
                You are logging in from a new device, cleared your browser
                storage, or your local keys are missing. Your previous chat
                history cannot be decrypted on this device.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={handleKeyReset}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 transition active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                >
                  Generate New Keys & Start Fresh
                </button>
                <button
                  onClick={() => setShowKeyResetDialog(false)}
                  className="w-full inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/60 hover:text-white transition active:scale-95"
                >
                  Skip (History stays locked)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThreadPreview({
  preview,
  threadId,
  recipientId,
}: {
  preview: string;
  threadId: string;
  recipientId: string;
}) {
  const [decryptedText, setDecryptedText] = useState("Encrypted Message");

  React.useEffect(() => {
    if (!preview) {
      setDecryptedText("No messages yet");
      return;
    }
    if (preview === "No messages yet") {
      setDecryptedText("No messages yet");
      return;
    }

    let active = true;

    async function decryptPreview() {
      try {
        const parsed = JSON.parse(preview);
        if (!parsed || !parsed.ciphertext || !parsed.iv) {
          setDecryptedText(preview);
          return;
        }

        const sender = getCurrentUser();
        if (!sender) return;

        const {
          getKeyRecord,
          importPublicKeyBase64,
          deriveSharedAesKey,
          decryptText,
        } = await import("@/lib/crypto");
        const record = await getKeyRecord(sender.id);
        if (!record) {
          if (active) setDecryptedText("Encrypted Message");
          return;
        }

        let aesKey = threadKeyCache[threadId];
        if (!aesKey) {
          const { getUserPublicKey } = await import("@/lib/api");
          const recipientKeyData = await getUserPublicKey(recipientId);
          if (recipientKeyData && recipientKeyData.chatPublicKey) {
            const recipientPubKey = await importPublicKeyBase64(
              recipientKeyData.chatPublicKey,
            );
            aesKey = await deriveSharedAesKey(
              record.privateKey,
              recipientPubKey,
            );
            threadKeyCache[threadId] = aesKey;
          }
        }

        if (aesKey && active) {
          const decrypted = await decryptText(
            parsed.ciphertext,
            parsed.iv,
            aesKey,
          );
          setDecryptedText(decrypted);
        }
      } catch (err) {
        if (active) setDecryptedText("Encrypted Message");
      }
    }

    decryptPreview();

    return () => {
      active = false;
    };
  }, [preview, threadId, recipientId]);

  return (
    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
      {decryptedText}
    </p>
  );
}
