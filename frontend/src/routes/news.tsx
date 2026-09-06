import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchNews, generateArticle } from "@/lib/api";
import { ExternalLink, X, Sparkles, Share2, Info, Newspaper, Compass, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

export const Route = createFileRoute("/news")({
  component: NewsComponent,
});

const TOPICS = [
  { id: "world", label: "Global Pulse" },
  { id: "technology", label: "Deep Tech" },
  { id: "science", label: "Cosmic Science" },
  { id: "business", label: "Decentralized Markets" },
];

const springTransition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 1,
} as const;

function NewsComponent() {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState("world");
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [aiBriefing, setAiBriefing] = useState<string>("");
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");
  const [iframeLoading, setIframeLoading] = useState(true);

  const {
    data: articles,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["news", selectedTopic],
    queryFn: () => fetchNews(selectedTopic),
  });

  const handleOpenArticle = (article: any) => {
    setSelectedArticle(article);
    setAiBriefing("");
    setIframeLoading(true);
    autoGenerateBriefing(article);
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
  };

  const autoGenerateBriefing = async (article: any) => {
    setIsBriefingLoading(true);
    setBriefingError("");
    try {
      const res = await generateArticle(
        `Provide a concise, 3-sentence analytical intelligence overview of this news: "${article.title}". Context: ${article.contentSnippet || ""}`,
      );
      setAiBriefing(res.article);
    } catch (err: any) {
      setBriefingError("Failed to synthesize AI briefing.");
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleShare = () => {
    if (!selectedArticle) return;
    const shareText = `📰 ${selectedArticle.title}\n\n${aiBriefing ? `Social Space AI Brief:\n${aiBriefing}\n\n` : ""}(via ${selectedArticle.source})`;
    navigate({
      to: "/compose",
      search: { content: shareText } as any,
    });
  };

  return (
    <div className="cosmic-theme min-h-screen text-white px-4 py-8 pb-32 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-300 backdrop-blur-md mb-3">
          <Newspaper className="h-3.5 w-3.5" />
          <span>VERIFIED WIRE DISPATCHES</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          Global Intel & Dispatches
        </h1>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          Real-time global reporting decoded with sovereign intelligence summaries. No tracking cookies or paywall trackers.
        </p>

        {/* Topic Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-5 scrollbar-none">
          {TOPICS.map((topic) => {
            const active = selectedTopic === topic.id;
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all border",
                  active
                    ? "bg-amber-500 text-black border-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.35)]"
                    : "bg-[#0c1017]/80 text-white/70 border-white/10 hover:border-amber-500/40 hover:text-white"
                )}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-[#0c1017]/80 border border-white/10"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300 backdrop-blur-xl">
          Failed to fetch dispatches: {(error as Error).message}
        </div>
      )}

      {/* Articles Grid */}
      {articles && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article: any) => {
            return (
              <motion.div
                key={article.id || article.link}
                onClick={() => handleOpenArticle(article)}
                className="group relative cursor-pointer rounded-2xl p-5 overflow-hidden border border-white/10 bg-[#0c1017]/80 backdrop-blur-xl transition-all hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.12)] flex flex-col justify-between"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.99 }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400">
                      {article.source || "Dispatch"}
                    </span>
                    <span className="text-[11px] text-white/40 font-mono">
                      {new Date(article.pubDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <h2 className="font-serif text-lg font-semibold leading-snug text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                    {article.title}
                  </h2>

                  <p className="mt-2.5 text-xs text-white/60 line-clamp-3 leading-relaxed">
                    {article.contentSnippet || "Tap to expand and decode with AI briefing."}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-amber-400/80 font-medium">
                  <span className="flex items-center gap-1.5 text-[11px] text-white/40 group-hover:text-amber-400 transition-colors">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    Decode Intel Brief
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal / Dialog View */}
      <AnimatePresence>
        {selectedArticle &&
          typeof document !== "undefined" &&
          createPortal(
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
                onClick={handleCloseArticle}
              />

              {/* Panel */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-5xl flex flex-col p-4 sm:p-6 overflow-hidden max-h-[92vh] z-10 rounded-3xl bg-[#0c1017]/95 border border-amber-500/30 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-white"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400">
                      {selectedArticle.source || "Dispatch"}
                    </span>
                    <span className="text-[11px] text-white/40">
                      {new Date(selectedArticle.pubDate).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={handleCloseArticle}
                    className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 overflow-y-auto py-4 min-h-[40vh]">
                  {/* Left Column: Summary + AI */}
                  <div className="lg:col-span-2 flex flex-col space-y-4 overflow-y-auto pr-1">
                    <h2 className="font-serif text-2xl font-bold leading-tight text-white">
                      {selectedArticle.title}
                    </h2>

                    <div className="border-t border-white/10 pt-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                        Original Wire Snippet
                      </h3>
                      <p className="text-xs text-white/80 leading-relaxed font-sans">
                        {selectedArticle.contentSnippet}
                      </p>
                    </div>

                    {/* AI Briefing */}
                    <div className="border-t border-white/10 pt-3">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4" />
                        Social Space AI Synthesis
                      </h3>

                      {isBriefingLoading && (
                        <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3.5 animate-pulse text-xs text-amber-300/80 flex items-center gap-2">
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                          Synthesizing dispatch intelligence...
                        </div>
                      )}

                      {briefingError && (
                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300">
                          {briefingError}
                        </div>
                      )}

                      {aiBriefing && (
                        <div className="rounded-xl border border-amber-500/25 bg-[#121824]/90 p-4 leading-relaxed text-white text-xs shadow-inner">
                          <MarkdownRenderer content={aiBriefing} className="text-xs" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Web Reader Frame */}
                  <div className="lg:col-span-3 flex flex-col h-full min-h-[300px]">
                    <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 bg-white">
                      {iframeLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 z-10 bg-[#0c1017]">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                          <span className="text-[11px] text-white/50 font-mono">
                            Sandboxing external web source...
                          </span>
                        </div>
                      )}
                      <iframe
                        src={selectedArticle.link}
                        title={selectedArticle.title}
                        className="w-full h-full min-h-[350px] bg-white relative z-0"
                        onLoad={() => setIframeLoading(false)}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-white/40 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      If external publication blocks frame embedding, tap <strong>Open Source</strong>.
                    </p>
                  </div>
                </div>

                {/* Footer Toolbar */}
                <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row gap-3 shrink-0">
                  <button
                    onClick={handleShare}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition"
                  >
                    <Share2 className="h-4 w-4" />
                    Broadcast to Feed
                  </button>

                  <a
                    href={selectedArticle.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-4 py-2.5 text-xs font-semibold transition shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Original Source
                  </a>
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )}
      </AnimatePresence>
    </div>
  );
}

