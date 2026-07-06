import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Send, Image as ImageIcon, Video, Mic, FileText, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPost, uploadMedia } from "@/lib/api";
import { GrokEditor } from "@/components/GrokEditor";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePublish = async () => {
    if (!text.trim() && !mediaUrl) return;
    setIsLoading(true);
    setError("");
    try {
      // If mediaUrl exists, maybe we categorize it as Video if it's a video, but let's just use 'Life' or 'Video' based on media presence for now.
      const category = mediaUrl ? "Video" : (mode === "article" ? "Ideas" : "Life");
      await createPost(text, category, "pseudo", mediaUrl);
      setText("");
      setMediaUrl(null);
      alert("Published successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to publish post.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      const url = await uploadMedia(file);
      setMediaUrl(url);
    } catch (err: any) {
      setError("Failed to upload media. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-10 sm:px-6 lg:pt-14">
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

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Mode Selector */}
        <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/10 max-w-fit">
          <button
            onClick={() => setMode("standard")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-medium transition",
              mode === "standard" ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Standard Post
          </button>
          <button
            onClick={() => setMode("article")}
            className={cn(
              "flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium transition",
              mode === "article" ? "bg-[color:var(--primary)] text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI Article
          </button>
        </div>

        {mode === "standard" ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              rows={5}
              maxLength={1000}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
            
            {mediaUrl && (
              <div className="relative mt-4 inline-block">
                <img src={mediaUrl} alt="Uploaded media" className="max-h-64 rounded-xl object-cover border border-white/10" />
                <button 
                  onClick={() => setMediaUrl(null)}
                  className="absolute -top-3 -right-3 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*,video/*" 
                  onChange={handleFileUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                >
                  <ImageIcon className="h-4 w-4" />
                  {isUploading ? "Uploading..." : "Add Media"}
                </button>
              </div>
              <span className="mono text-[11px] tracking-[0.16em] text-muted-foreground">
                {text.length}/1000
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


