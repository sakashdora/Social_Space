import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchNews, generateArticle } from "@/lib/api";
import { ExternalLink, X, Sparkles, Share2, Globe, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/news")({
  component: NewsComponent,
});

function NewsComponent() {
  const navigate = useNavigate();
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [aiBriefing, setAiBriefing] = useState<string>("");
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");
  const [activeTab, setActiveTab] = useState<"brief" | "web">("brief");
  const [iframeLoading, setIframeLoading] = useState(true);

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ["news"],
    queryFn: () => fetchNews("world"),
  });

  const handleOpenArticle = (article: any) => {
    setSelectedArticle(article);
    setAiBriefing("");
    setBriefingError("");
    setActiveTab("brief");
    setIframeLoading(true);
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
  };

  const handleGenerateBriefing = async () => {
    if (!selectedArticle) return;
    setIsBriefingLoading(true);
    setBriefingError("");
    try {
      const res = await generateArticle(
        `Provide a quick 3-sentence analytical overview of this news: "${selectedArticle.title}". Context: ${selectedArticle.contentSnippet || ""}`
      );
      setAiBriefing(res.article);
    } catch (err: any) {
      setBriefingError("Failed to generate AI briefing. Please try again.");
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handleShare = () => {
    if (!selectedArticle) return;
    const shareText = `📰 ${selectedArticle.title}\n\n${aiBriefing ? `Veil AI Brief:\n${aiBriefing}\n\n` : ""}(via ${selectedArticle.source})`;
    navigate({
      to: "/compose",
      search: { content: shareText } as any,
    });
    window.location.href = `/compose?content=${encodeURIComponent(shareText)}`;
  };

  return (
    <div className="mx-auto max-w-3xl py-12 px-4 pb-32">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">News Portal</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">Global Stories</h1>
        <p className="mt-2 text-sm text-muted-foreground">Real-time stories decoded with privacy-centric AI summaries.</p>
      </header>
      
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-white/5 border border-white/[0.04]"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load news: {(error as Error).message}
        </div>
      )}

      {articles && articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article: any) => (
            <div 
              key={article.id} 
              onClick={() => handleOpenArticle(article)}
              className="block cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:scale-[1.01]"
              style={{ background: "var(--surface-bg)", border: "1px solid var(--surface-border)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--surface-bg)")}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="font-serif text-xl leading-snug text-foreground hover:text-[color:var(--veil-glow)] transition-colors">
                    {article.title}
                  </h2>
                  <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                    {article.contentSnippet}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
                      {article.source}
                    </span>
                    <span>&bull;</span>
                    <span>{new Date(article.pubDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium In-App News Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay animate-fade-in">
          <div className="relative w-full max-w-3xl dialog-panel flex flex-col p-6 overflow-hidden max-h-[90vh]">
            
            {/* Modal Header Row */}
            <div className="flex items-center justify-between mb-4 border-b pb-3 shrink-0" style={{ borderColor: "var(--surface-border)" }}>
              {/* Reader Tabs */}
              <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/10 max-w-fit">
                <button
                  onClick={() => setActiveTab("brief")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
                    activeTab === "brief"
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Summary Brief
                </button>
                <button
                  onClick={() => setActiveTab("web")}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
                    activeTab === "web"
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Web Reader
                </button>
              </div>

              {/* Close Button */}
              <button 
                onClick={handleCloseArticle}
                className="rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition shrink-0"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {activeTab === "brief" ? (
                /* BRIEFING VIEW */
                <div className="space-y-6 py-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3" style={{ background: "var(--tag-bg)", border: "1px solid var(--tag-border)" }}>
                      {selectedArticle.source}
                    </span>
                    <h2 className="font-serif text-3xl leading-tight text-foreground">
                      {selectedArticle.title}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-2.5">
                      Published: {new Date(selectedArticle.pubDate).toLocaleString()}
                    </p>
                  </div>

                  <div className="border-t pt-4" style={{ borderColor: "var(--surface-border)" }}>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Original Snippet</h3>
                    <p className="text-sm text-foreground/90 leading-relaxed font-sans">
                      {selectedArticle.contentSnippet}
                    </p>
                  </div>

                  {/* Veil AI Briefing Section */}
                  <div className="border-t pt-4" style={{ borderColor: "var(--surface-border)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Veil AI Briefing
                      </h3>
                      {!aiBriefing && !isBriefingLoading && (
                        <button
                          onClick={handleGenerateBriefing}
                          className="flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] px-3 py-1 text-xs font-semibold text-primary-foreground hover:brightness-110 transition active:scale-95"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Generate Brief
                        </button>
                      )}
                    </div>

                    {isBriefingLoading && (
                      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 animate-pulse text-xs text-muted-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-spin text-[color:var(--primary)]" />
                        Veil AI is synthesizing news briefing...
                      </div>
                    )}

                    {briefingError && (
                      <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-3 text-xs text-red-400">
                        {briefingError}
                      </div>
                    )}

                    {aiBriefing && (
                      <div className="rounded-2xl border border-[color:var(--primary)]/20 bg-[color:var(--primary)]/5 p-4 text-sm leading-relaxed text-foreground">
                        <p className="font-semibold text-[color:var(--primary)] text-xs mb-1">Veil AI Summary</p>
                        {aiBriefing}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* IN-APP IFRAME WEB READER */
                <div className="space-y-3 py-2 h-full flex flex-col min-h-[50vh]">
                  <div className="flex items-start gap-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15 p-3 text-xs text-blue-400">
                    <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                    <p>
                      This article is loaded securely inside Social Space. If the content does not render, it means the publisher restricts embedding. Click <strong>Read Externally</strong> below to view.
                    </p>
                  </div>
                  
                  <div className="relative flex-1 rounded-2xl overflow-hidden border bg-white min-h-[450px]" style={{ borderColor: "var(--surface-border)" }}>
                    {iframeLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--veil-glow)] border-t-transparent" />
                        <span className="text-xs text-muted-foreground font-mono">Securing sandbox connection…</span>
                      </div>
                    )}
                    <iframe
                      src={selectedArticle.link}
                      title={selectedArticle.title}
                      className="w-full h-full min-h-[450px] bg-white"
                      onLoad={() => setIframeLoading(false)}
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer Toolbar */}
            <div className="border-t pt-4 flex flex-col sm:flex-row gap-3 shrink-0" style={{ borderColor: "var(--surface-border)" }}>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white/[0.03] border px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition hover:bg-white/[0.06] active:scale-95"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <Share2 className="h-4 w-4" />
                Discuss / Post
              </button>

              <a
                href={selectedArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition active:scale-95"
              >
                <ExternalLink className="h-4 w-4" />
                Read Externally
              </a>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
