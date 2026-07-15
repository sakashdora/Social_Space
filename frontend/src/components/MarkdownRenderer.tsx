import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/lib/theme";
import { Check, Copy, WrapText } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  language: string;
  value: string;
  theme: "light" | "dark";
}

function CodeBlock({ language, value, theme }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(true);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 font-mono text-sm leading-relaxed shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-zinc-900/90 px-4 py-2 text-xs text-zinc-400 select-none border-b border-white/5">
        <span className="font-semibold uppercase tracking-wider text-[10px]">
          {language || "text"}
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
            title={wrapLines ? "Disable wrap" : "Enable wrap"}
          >
            <WrapText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{wrapLines ? "Unwrap" : "Wrap"}</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-400 animate-fade-in" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Syntax highlighted code */}
      <div className="overflow-x-auto p-4 scrollbar-thin">
        <SyntaxHighlighter
          language={language || "text"}
          style={theme === "light" ? oneLight : oneDark}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "0.875rem",
          }}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-mono)",
              whiteSpace: wrapLines ? "pre-wrap" : "pre",
              wordBreak: wrapLines ? "break-all" : "normal",
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// Custom sanitizer schema to allow classNames (e.g. for language-xxx syntax highlights) and targets for links
const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className"],
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
  },
};

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const { theme } = useTheme();

  const components = {
    // Responsive table wrappers
    table: ({ children, ...props }: any) => (
      <div className="my-4 w-full overflow-x-auto rounded-xl border border-white/10 shadow-md">
        <table className="w-full text-left text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="bg-white/5 border-b border-white/10 text-xs font-semibold uppercase tracking-wider sticky top-0" {...props}>
        {children}
      </thead>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-3 font-semibold text-foreground/90" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-3 border-b border-white/5 text-foreground/80" {...props}>
        {children}
      </td>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-white/[0.02] transition-colors" {...props}>
        {children}
      </tr>
    ),

    // Styled lists
    ul: ({ children, ...props }: any) => (
      <ul className="my-3 list-disc pl-6 space-y-1.5 leading-relaxed text-foreground/90" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="my-3 list-decimal pl-6 space-y-1.5 leading-relaxed text-foreground/90" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, checked, ...props }: any) => {
      if (checked !== undefined) {
        return (
          <li className="flex items-start gap-2 list-none py-0.5" {...props}>
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 text-[color:var(--primary)] focus:ring-[color:var(--primary)]/30 accent-amber-500"
            />
            <span className="flex-1 text-foreground/90">{children}</span>
          </li>
        );
      }
      return <li className="py-0.5 text-foreground/90" {...props}>{children}</li>;
    },

    // Headings
    h1: ({ children, ...props }: any) => (
      <h1 className="mt-6 mb-4 font-serif text-2xl font-bold tracking-tight border-b border-white/5 pb-2 text-foreground" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="mt-5 mb-3 font-serif text-xl font-bold tracking-tight text-foreground" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="mt-4 mb-2 font-sans text-base font-bold text-foreground" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="mt-3 mb-1.5 font-sans text-sm font-bold text-foreground" {...props}>
        {children}
      </h4>
    ),

    // Blockquotes
    blockquote: ({ children, ...props }: any) => (
      <blockquote className="my-4 border-l-4 border-amber-500 bg-white/5 px-4 py-3 text-foreground/90 italic rounded-r-lg" {...props}>
        {children}
      </blockquote>
    ),

    // Code rendering (inline vs block)
    code: ({ node, inline, className: codeClassName, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(codeClassName || "");
      const isInline = !match;
      if (isInline) {
        return (
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-amber-500 font-semibold" {...props}>
            {children}
          </code>
        );
      }
      return (
        <CodeBlock
          language={match[1]}
          value={String(children).replace(/\n$/, "")}
          theme={theme}
        />
      );
    },

    // Safe Links
    a: ({ href, children, ...props }: any) => {
      const isExternal = href?.startsWith("http");
      return (
        <a
          href={href}
          className="text-amber-500 hover:text-amber-400 hover:underline font-semibold transition-colors"
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Horizontal Rule
    hr: ({ ...props }: any) => (
      <hr className="my-6 border-t border-white/10" {...props} />
    ),

    // Paragraph margins
    p: ({ children, ...props }: any) => (
      <p className="my-2.5 leading-relaxed break-words text-foreground/90" {...props}>
        {children}
      </p>
    ),
  };

  return (
    <div className={cn("prose prose-invert max-w-none text-[15px] leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, customSanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
