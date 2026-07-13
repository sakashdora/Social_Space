import { useState } from "react";
import { Sparkles, Check, Wand2 } from "lucide-react";
import { generateArticle, correctGrammar, getSuggestions } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GrokEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function GrokEditor({ value, onChange }: GrokEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError("");
    try {
      const data = await generateArticle(prompt, value);
      onChange(value ? `${value}\n\n${data.article}` : data.article);
      setPrompt("");
    } catch (err: any) {
      setError(err.message || "Failed to generate article.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCorrect = async () => {
    if (!value.trim()) return;
    setIsCorrecting(true);
    setError("");
    try {
      const data = await correctGrammar(value);
      onChange(data.correctedText);
    } catch (err: any) {
      setError(err.message || "Failed to correct grammar.");
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleSuggest = async () => {
    if (!value.trim()) return;
    setIsSuggesting(true);
    setError("");
    try {
      const data = await getSuggestions(value);
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message || "Failed to get suggestions.");
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Grok Prompt Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Veil AI to write something..."
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleGenerate();
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Thinking..." : "Veil AI"}
        </button>
      </div>

      {/* Text Area */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 focus-within:border-[color:var(--primary)] transition-colors">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your article here..."
          rows={10}
          className="w-full resize-y bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
        />

        {/* Grok Actions Toolbar */}
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
          <button
            onClick={handleCorrect}
            disabled={isCorrecting || !value.trim()}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {isCorrecting ? "Correcting..." : "Correct Grammar"}
          </button>

          <button
            onClick={handleSuggest}
            disabled={isSuggesting || !value.trim()}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {isSuggesting ? "Thinking..." : "Get Suggestions"}
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[color:var(--primary)]">
            Veil AI Suggestions
          </p>
          <ul className="space-y-2">
            {suggestions.map((suggestion, idx) => (
              <li
                key={idx}
                className="cursor-pointer rounded-lg bg-white/5 p-3 text-sm text-foreground/90 transition hover:bg-white/10"
                onClick={() =>
                  onChange(value ? `${value}\n\n${suggestion}` : suggestion)
                }
              >
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
