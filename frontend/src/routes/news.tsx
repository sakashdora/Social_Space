import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchNews, generateArticle } from "@/lib/api";
import { ExternalLink, X, Sparkles, Share2 } from "lucide-react";

export const Route = createFileRoute("/news")({
  component: NewsComponent,
});

function NewsComponent() {
  const navigate = useNavigate();
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [aiBriefing, setAiBriefing] = useState<string>("");
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ["news"],
    queryFn: () => fetchNews("world"),
  });

  const handleOpenArticle = (article: any) => {
    setSelectedArticle(article);
    setAiBriefing("");
    setBriefingError("");
  };

  const handleCloseArticle = () => {
    setSelectedArticle(null);
  };

  const handleGenerateBriefing = async () => {
    if (!selectedArticle) return;
    setIsBriefingLoading(true);
    setBriefingError("");
    try {
      // Prompt Groq/Gemini to write a quick inline summary/briefing of the news topic
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
      search: { content: shareText } as any, // fallback standard search support
    });
    // Explicit fallback in case route navigation doesn't pass search parameters correctly
    window.location.href = `/compose?content=${encodeURIComponent(shareText)}`;
  };

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 pb-32">
      <h1 className="font-serif text-3xl font-medium tracking-tight mb-6">News</h1>
      <p className="text-muted-foreground mb-8">Latest stories from around the world.</p>
      
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl bg-white/5"></div>
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
              className="block cursor-pointer rounded-xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="font-serif text-lg leading-snug">{article.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {article.contentSnippet}
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <span>{article.source}</span>
                    <span>&bull;</span>
                    <span>{new Date(article.pubDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modern News Reader Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-ink-raised p-6 shadow-2xl overflow-y-auto max-h-[85vh]">
            {/* Close Button */}
            <button 
              onClick={handleCloseArticle}
              className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <div className="space-y-6 mt-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-white/5 text-xs text-muted-foreground mb-3">
                  {selectedArticle.source}
                </span>
                <h2 className="font-serif text-2xl leading-snug text-foreground">
                  {selectedArticle.title}
                </h2>
                <p className="text-xs text-muted-foreground mt-2">
                  Published: {new Date(selectedArticle.pubDate).toLocaleString()}
                </p>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Snippet</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {selectedArticle.contentSnippet}
                </p>
              </div>

              {/* Veil AI Briefing Section */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Veil AI Briefing
                  </h3>
                  {!aiBriefing && !isBriefingLoading && (
                    <button
                      onClick={handleGenerateBriefing}
                      className="flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] px-3 py-1 text-xs font-medium text-primary-foreground hover:brightness-110 transition"
                    >
                      <Sparkles className="h-3 w-3" />
                      Generate Brief
                    </button>
                  )}
                </div>

                {isBriefingLoading && (
                  <div className="rounded-2xl bg-black/5 dark:bg-white/5 p-4 animate-pulse text-xs text-muted-foreground flex items-center gap-2">
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
                    <p className="font-medium text-[color:var(--primary)] text-xs mb-1">Veil AI Summary</p>
                    {aiBriefing}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="border-t border-border pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-black/5 dark:bg-white/5 border border-border px-4 py-3 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition"
                >
                  <Share2 className="h-4 w-4" />
                  Discuss / Post
                </button>

                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read Original
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


