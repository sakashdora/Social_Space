import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Send, Image as ImageIcon, Sparkles, X, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPost, uploadMedia } from "@/lib/api";
import { GrokEditor } from "@/components/GrokEditor";

const isVideoUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("data:video/")) return true;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext || "");
};

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "Compose — Social Space" },
      { name: "description", content: "Post text, images, or articles." },
    ],
  }),
  component: Compose,
});

function Compose() {
  const [mode, setMode] = useState<"standard" | "article">("standard");
  // "full" = fully anonymous (no handle attached); "pseudo" = pseudonymous (handle shown)
  const [anonMode, setAnonMode] = useState<"full" | "pseudo">("full");
  const [text, setText] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("content") || "";
    }
    return "";
  });
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [shouldBlur, setShouldBlur] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async () => {
    if (!text.trim() && !mediaUrl) return;
    setIsLoading(true);
    setError("");
    setSuccess(false);
    try {
      const category = mediaUrl ? "Video" : mode === "article" ? "Ideas" : "Life";
      await createPost(text, category, anonMode, mediaUrl);
      setText("");
      setMediaUrl(null);
      setSuccess(true);
      // Auto-clear success banner after 4 seconds
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to publish post.");
    } finally {
      setIsLoading(false);
    }
  };

async function anonymizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const { detectFace, loadImageFromFile } = await import("../lib/faceDetect");
    const { image } = await loadImageFromFile(file);
    const box = await detectFace(image);
    if (!box) return file;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(image, 0, 0);

    const px = box.x * canvas.width;
    const py = box.y * canvas.height;
    const pw = box.w * canvas.width;
    const ph = box.h * canvas.height;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = Math.max(8, Math.round(pw / 10));
    tempCanvas.height = Math.max(8, Math.round(ph / 10));
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(canvas, px, py, pw, ph, 0, 0, tempCanvas.width, tempCanvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, px, py, pw, ph);
    }

    return new Promise<File>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
        } else {
          resolve(new File([blob], file.name, { type: "image/webp" }));
        }
      }, "image/webp", 0.9);
    });
  } catch (err) {
    console.warn("Client-side face anonymization failed, uploading raw:", err);
    return file;
  }
}

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be reselected after an error
    e.target.value = "";
    setIsUploading(true);
    setError("");
    try {
      const processedFile = shouldBlur ? await anonymizeImage(file) : file;
      const url = await uploadMedia(processedFile);
      setMediaUrl(url);
    } catch (err: any) {
      // Surface the actual server error (MIME rejection, size limit, auth) — not a generic fallback
      setError(err.message || "Failed to upload media. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 lg:pb-10 pt-10 sm:px-6 lg:pt-14">
      <header className="mb-8">
        <h1 className="font-serif text-4xl leading-[1.05] tracking-[-0.02em] sm:text-6xl">
          Create {mode === "article" ? "Article" : "Post"}
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          {mode === "article"
            ? "Write a long-form article with the help of Grok AI."
            : "Share your thoughts, photos, or videos with the community."}
        </p>
      </header>

      {/* Success banner */}
      {success && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Published successfully!
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Mode Selector (Standard vs Article) */}
        <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            onClick={() => setMode("standard")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-medium transition",
              mode === "standard"
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Standard Post
          </button>
          <button
            onClick={() => setMode("article")}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition",
              mode === "article"
                ? "bg-[color:var(--primary)] text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI Article
          </button>
        </div>

        {/* ── Anonymity Mode Selector ────────────────────────────────── */}
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground mb-2">Post as</p>
          <div className="flex flex-wrap gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
            <button
              id="anon-mode-full"
              onClick={() => setAnonMode("full")}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition",
                anonMode === "full"
                  ? "bg-[color:var(--veil-glow)]/15 text-[color:var(--veil-glow)] border border-[color:var(--veil-glow)]/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              🎭 Fully Anonymous
            </button>
            <button
              id="anon-mode-pseudo"
              onClick={() => setAnonMode("pseudo")}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition",
                anonMode === "pseudo"
                  ? "bg-white/10 text-foreground border border-white/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              👤 Show @handle
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {anonMode === "full"
              ? "Your post will appear as 'Anonymous' — no handle or identity attached."
              : "Your handle will be visible alongside this post."}
          </p>
        </div>

        {mode === "standard" ? (
          <div className="p-6 input-surface !rounded-2xl">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              maxLength={500}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />

            {isUploading && (
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-dashed border-white/10 mt-4">
                <Loader2 className="h-6 w-6 text-[color:var(--primary)] animate-spin" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Optimizing and anonymizing media...
                </p>
              </div>
            )}

            {mediaUrl && (
              <div className="relative mt-4 w-full rounded-2xl overflow-hidden border border-white/10 bg-black/20">
                {isVideoUrl(mediaUrl) ? (
                  <video
                    src={mediaUrl}
                    controls
                    muted
                    playsInline
                    className="max-h-64 w-full object-contain bg-black"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Uploaded media"
                    className="max-h-64 w-full object-cover"
                  />
                )}
                <button
                  onClick={() => setMediaUrl(null)}
                  className="absolute top-3 right-3 rounded-full bg-red-500/80 p-2 text-white hover:bg-red-600 transition shadow-lg z-10"
                  aria-label="Remove media"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground disabled:opacity-50 cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {isUploading ? "Uploading..." : "Add Media"}
                  </button>
                </div>

                {/* Face Privacy Options */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
                  <span>Face Privacy:</span>
                  <label className="flex items-center gap-1.5 hover:text-foreground transition cursor-pointer">
                    <input
                      type="radio"
                      name="facePrivacy"
                      checked={shouldBlur}
                      onChange={() => setShouldBlur(true)}
                      className="accent-amber-500 cursor-pointer"
                    />
                    Blur Faces
                  </label>
                  <label className="flex items-center gap-1.5 hover:text-foreground transition cursor-pointer">
                    <input
                      type="radio"
                      name="facePrivacy"
                      checked={!shouldBlur}
                      onChange={() => setShouldBlur(false)}
                      className="accent-amber-500 cursor-pointer"
                    />
                    Keep Raw
                  </label>
                </div>
              </div>
              <span
                className={cn(
                  "mono text-[11px] tracking-[0.16em]",
                  text.length > 450 ? "text-amber-400" : "text-muted-foreground",
                  text.length >= 500 && "text-red-400",
                )}
              >
                {text.length}/500
              </span>
            </div>
          </div>
        ) : (
          <GrokEditor value={text} onChange={setText} />
        )}

        <button
          onClick={handlePublish}
          disabled={isLoading || (!text.trim() && !mediaUrl)}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--primary)] px-5 py-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          {isLoading ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}
