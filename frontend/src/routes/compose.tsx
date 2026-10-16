import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Radio,
  Eye,
  Send,
  PenLine,
  Image as ImageIcon,
  Video,
  BarChart2,
  HelpCircle,
  Mic,
  Link2,
  Sparkles,
  Shield,
  User,
  Users,
  Clock,
  Sliders,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  FileCheck,
  Heart,
  MessageSquare,
  Repeat2,
  Share2,
  Bold,
  Italic,
  List,
  Smile,
  Globe,
  Lock,
  Ghost,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createPost,
  uploadMedia,
  correctGrammar,
  generateArticle,
  type MediaKind,
} from "@/lib/api";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "Create Transmission — Social Space" },
      {
        name: "description",
        content:
          "Share something real. Your identity stays yours. Zero surveillance.",
      },
    ],
  }),
  component: ComposeStudio,
});

type FormatTab =
  "text" | "photo" | "video" | "poll" | "question" | "voice" | "link" | "ai";

type IdentityOption = "anonymous" | "sovereign" | "persona";
type AudienceOption = "everyone" | "circle" | "selected" | "anonymous_feed";
type LifetimeOption = "24h" | "7d" | "30d" | "forever";
type PrivacyShieldOption =
  "face_shield" | "pixelate" | "blur_bg" | "remove_meta" | "original";

const EMOJI_LIST = [
  "✨",
  "🚀",
  "🛡️",
  "🔥",
  "💡",
  "⚡",
  "🌌",
  "👁️",
  "🕊️",
  "💎",
  "🤖",
  "🔒",
];

function ComposeStudio() {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated: authed } = useAuth();

  // ─── Format Tabs ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<FormatTab>("text");
  const [mobileStudioTab, setMobileStudioTab] = useState<"edit" | "preview">(
    "edit",
  );

  // ─── Composer Content & Auto-Draft ───────────────────────────────────────────
  const [text, setText] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftUnavailable, setDraftUnavailable] = useState(false);
  const [draftSaved, setDraftSaved] = useState(true);
  useEffect(() => {
    const urlContent = new URLSearchParams(window.location.search).get(
      "content",
    );
    try {
      setText(
        urlContent || localStorage.getItem("veil_transmission_draft") || "",
      );
    } catch {
      setText(urlContent || "");
      setDraftUnavailable(true);
    }
    setDraftLoaded(true);
  }, []);

  // ─── Media State ─────────────────────────────────────────────────────────────
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaKind | null>(null);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ─── Poll Options ────────────────────────────────────────────────────────────
  const [pollOptions, setPollOptions] = useState<string[]>([
    "Yes, absolutely",
    "No, not at all",
  ]);

  // ─── Question Prompt ─────────────────────────────────────────────────────────
  const [questionCategory, setQuestionCategory] = useState("Technology");

  // ─── Link Embed ──────────────────────────────────────────────────────────────
  const [linkUrl, setLinkUrl] = useState("");

  // ─── Voice Recording ─────────────────────────────────────────────────────────
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);

  // ─── Identity, Audience, Lifetime, Engagement ────────────────────────────────
  const [identity, setIdentity] = useState<IdentityOption>("anonymous");
  const [personaName, setPersonaName] = useState("phantom-drifter");
  const [selectedHandles, setSelectedHandles] = useState("");
  const sourceFile = useRef<File | null>(null);
  const processingRequest = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingStream = useRef<MediaStream | null>(null);
  const [audience, setAudience] = useState<AudienceOption>("everyone");
  const [lifetime, setLifetime] = useState<LifetimeOption>("24h");

  const [engagement, setEngagement] = useState({
    allowReplies: true,
    allowReactions: true,
    allowReposts: true,
    allowQuotes: false,
    anonymousReplies: false,
  });

  // ─── Privacy Shield & AI Intelligence ────────────────────────────────────────
  const [privacyShield, setPrivacyShield] =
    useState<PrivacyShieldOption>("face_shield");
  const [aiModifiedMedia, setAiModifiedMedia] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiActionMessage, setAiActionMessage] = useState<string | null>(null);
  const [privacyReport, setPrivacyReport] = useState<{
    clean: boolean;
    issues: string[];
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ─── Submission State ────────────────────────────────────────────────────────
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mounted = useRef(true);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (!draftLoaded) return;
    setDraftSaved(false);
    const t = setTimeout(() => {
      try {
        localStorage.setItem("veil_transmission_draft", text);
        setDraftSaved(true);
        setDraftUnavailable(false);
      } catch {
        setDraftUnavailable(true);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [text, draftLoaded]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      recordingStream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(
    () => () => {
      if (mediaPreview?.startsWith("blob:")) URL.revokeObjectURL(mediaPreview);
    },
    [mediaPreview],
  );

  // Handle Voice Record Timer
  useEffect(() => {
    let interval: any;
    if (isRecordingVoice) {
      interval = setInterval(() => {
        setVoiceDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecordingVoice]);

  // ─── Media & Privacy Shield Anonymization ────────────────────────────────────
  async function processMedia(file: File, mode: PrivacyShieldOption) {
    const request = ++processingRequest.current;
    setIsProcessingMedia(true);
    setError(null);
    setMediaFile(null);
    setMediaPreview(null);
    try {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("Choose a file smaller than 50 MB.");
      if (file.type.startsWith("image/")) {
        const { processImagePrivacy } = await import("@/lib/imagePrivacy");
        const processed = await processImagePrivacy(file, mode);
        if (!mounted.current || request !== processingRequest.current) return;
        setMediaType("image");
        setMediaFile(processed.file);
        setMediaPreview(URL.createObjectURL(processed.file));
        setToast(
          processed.faces
            ? `Processed ${processed.faces} detected face(s). Review the preview before posting.`
            : "Image metadata removed. Review the preview before posting.",
        );
      } else if (
        file.type.startsWith("video/") ||
        file.type.startsWith("audio/")
      ) {
        if (!mounted.current || request !== processingRequest.current) return;
        setPrivacyShield("remove_meta");
        setMediaType(file.type.startsWith("video/") ? "video" : "audio");
        setMediaFile(file);
        setMediaPreview(URL.createObjectURL(file));
        setToast(
          "Clip metadata will be removed on upload. Faces and voices remain visible and audible.",
        );
      } else throw new Error("Choose a supported image, video or audio file.");
    } catch (error) {
      if (mounted.current && request === processingRequest.current)
        setError(
          error instanceof Error ? error.message : "Media processing failed.",
        );
    } finally {
      if (mounted.current && request === processingRequest.current)
        setIsProcessingMedia(false);
    }
  }
  async function handleMediaSelected(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    sourceFile.current = file;
    await processMedia(file, privacyShield);
    event.target.value = "";
  }
  async function toggleVoiceRecording() {
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error("Voice recording is unavailable in this browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recordingStream.current = stream;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("No supported audio format is available.");
      }
      const recording = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.current = recording;
      setVoiceDuration(0);
      setIsRecordingVoice(true);
      setError(null);
      recording.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const stopTimer = setTimeout(() => {
        if (recording.state === "recording") recording.stop();
      }, 60000);
      recording.onstop = () => {
        clearTimeout(stopTimer);
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingVoice(false);
        const file = new File(chunks, "voice." + mimeType.split("/")[1], {
          type: mimeType,
        });
        sourceFile.current = file;
        void processMedia(file, "remove_meta");
      };
      recording.start();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Microphone access failed.",
      );
      setIsRecordingVoice(false);
    }
  }

  // ─── Rich Text Formatting ────────────────────────────────────────────────────
  function insertFormatting(prefix: string, suffix = "") {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = text.substring(start, end);
    const replacement = prefix + (sel || "text") + suffix;
    const updated =
      text.substring(0, start) + replacement + text.substring(end);
    setText(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (sel.length || 4),
      );
    }, 10);
  }

  function appendEmoji(emoji: string) {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }

  // ─── AI Intelligence Features ────────────────────────────────────────────────
  async function handleAiImprove() {
    if (!text.trim()) {
      setToast("Write some thoughts first to improve!");
      return;
    }
    setIsAiLoading(true);
    setAiActionMessage("Refining clarity, flow, and sovereign tone...");
    try {
      const res = await correctGrammar(text);
      if (res.correctedText) {
        setText(res.correctedText.slice(0, 500));
        setToast("✨ Text refined by Grok AI!");
      }
    } catch (err: any) {
      setToast("AI connection error: " + err.message);
    } finally {
      setIsAiLoading(false);
      setAiActionMessage(null);
    }
  }

  async function handleAiGenerate() {
    setIsAiLoading(true);
    setAiActionMessage(
      "Synthesizing sovereign transmission on decentralization...",
    );
    try {
      const topic = text.trim()
        ? text.trim().slice(0, 50)
        : "Decentralized privacy and freedom of thought";
      const res = await generateArticle(
        topic,
        "Create a concise, punchy 2-sentence transmission for Social Space.",
      );
      if (res.article) {
        setText(res.article.slice(0, 480));
        setToast("✨ Generated transmission concept!");
      }
    } catch (err: any) {
      setToast("AI generation error: " + err.message);
    } finally {
      setIsAiLoading(false);
      setAiActionMessage(null);
    }
  }

  function handlePrivacyCheck() {
    const issues: string[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;

    if (emailRegex.test(text)) issues.push("Contains email address");
    if (phoneRegex.test(text)) issues.push("Contains telephone number");
    if (ipRegex.test(text)) issues.push("Contains IP address");
    if (ssnRegex.test(text)) issues.push("Contains government ID pattern");

    setPrivacyReport({
      clean: issues.length === 0,
      issues,
    });

    if (issues.length === 0) {
      setToast("🛡️ Zero PII leaks detected! Safe to broadcast.");
    } else {
      setToast("⚠️ Sensitive data detected in text!");
    }
  }

  function handleAddHashtags() {
    const tags = ["#SocialSpace", "#ZeroSurveillance", "#FreeSpeech", "#Web3"];
    const currentTags: string[] = text.match(/#\w+/g) || [];
    const tagsToAdd = tags.filter((t) => !currentTags.includes(t));
    if (tagsToAdd.length > 0) {
      setText((prev) =>
        (prev.trim() + " " + tagsToAdd.slice(0, 3).join(" ")).slice(0, 500),
      );
      setToast("Added trending decentralized hashtags!");
    }
  }

  // ─── Real Backend Publishing ─────────────────────────────────────────────────
  async function handleBroadcast() {
    let finalBody = text.trim();

    if (isProcessingMedia || isRecordingVoice) {
      setError("Finish recording or processing media first.");
      return;
    }
    if (
      activeTab === "poll" &&
      (pollOptions.filter((option) => option.trim()).length < 2 ||
        new Set(pollOptions.map((option) => option.trim())).size !==
          pollOptions.length)
    ) {
      setError("A poll needs at least two distinct options.");
      return;
    }
    if (audience === "selected" && !selectedHandles.trim()) {
      setError("Enter the handles allowed to see this post.");
      return;
    }
    if (identity === "persona")
      finalBody = `*Sent via ${personaName}*\n\n${finalBody}`;

    // If link format, append link
    if (activeTab === "link" && linkUrl.trim()) {
      if (!finalBody.includes(linkUrl)) {
        finalBody += `\n\n🔗 [Link](${linkUrl.trim()})`;
      }
    }

    if (!finalBody && !mediaFile) {
      setError(
        "Please write a transmission or upload media before broadcasting.",
      );
      return;
    }

    if (finalBody.length > 500) {
      setError("Transmission exceeds 500 character limit.");
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      let mediaResult: any = null;
      if (mediaFile) {
        setToast("Uploading media directly to storage...");
        mediaResult = await uploadMedia(mediaFile, (status) => {
          if (status === "uploading") {
            setToast("Uploading media to secure storage...");
          } else if (status === "processing") {
            setToast("Validating media and generating its preview...");
          } else if (status === "ready") {
            setToast("Media verified and ready to post!");
          }
        });
      }

      // Map identity mode
      const backendMode =
        identity === "anonymous" || audience === "anonymous_feed"
          ? "full"
          : "pseudo";

      // Map category
      let category = "Ideas";
      if (activeTab === "video") category = "Video";
      else if (activeTab === "poll") category = "Ideas";
      else if (activeTab === "question") category = "Life";
      else if (identity === "anonymous" || audience === "anonymous_feed")
        category = "Confessions";

      await createPost(
        finalBody,
        category,
        backendMode,
        mediaResult
          ? {
              mediaId: mediaResult.mediaId,
            }
          : null,
        null,
        {
          audience,
          lifetime,
          isAiModifiedMedia: aiModifiedMedia,
          selectedHandles: selectedHandles
            .split(/[\s,]+/)
            .map((handle) => handle.replace(/^@/, "").toLowerCase())
            .filter(Boolean),
          engagement,
          pollOptions:
            activeTab === "poll"
              ? pollOptions.map((option) => option.trim())
              : [],
        },
      );

      // Clean up draft
      if (typeof window !== "undefined") {
        localStorage.removeItem("veil_transmission_draft");
      }
      setText("");
      sourceFile.current = null;
      setMediaFile(null);
      setMediaPreview(null);
      setToast("🚀 Transmission broadcast into the cosmic stream!");

      // Navigate to Social Stream
      setTimeout(() => {
        navigate({ to: "/social" });
      }, 1200);
    } catch (err: any) {
      setError(
        err.message || "Failed to broadcast transmission. Please try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  // ─── Persona Generator ───────────────────────────────────────────────────────
  function randomizePersona() {
    const adjectives = [
      "quantum",
      "phantom",
      "stellar",
      "sovereign",
      "astral",
      "lunar",
      "silent",
    ];
    const nouns = [
      "drifter",
      "nomad",
      "spectre",
      "signal",
      "cipher",
      "falcon",
      "voyager",
    ];
    const randAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randNoun = nouns[Math.floor(Math.random() * nouns.length)];
    setPersonaName(`${randAdj}-${randNoun}`);
  }

  return (
    <div className="cosmic-theme min-h-screen w-full px-4 sm:px-6 lg:px-10 py-6 pb-36 lg:pb-16 max-w-[1440px] mx-auto text-foreground select-text">
      {/* Toast alert */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-card/95 px-5 py-3 text-sm text-foreground shadow-2xl backdrop-blur-xl">
          <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ─── Top Studio Header ────────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border mb-8">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] shrink-0">
            <Radio className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-wider text-foreground uppercase flex items-center gap-2">
              Create Transmission
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Share something real. Your identity stays yours.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Draft Saved Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {draftUnavailable
                ? "Draft saving unavailable"
                : draftSaved
                  ? "Draft saved"
                  : "Saving…"}
            </span>
          </div>

          {/* Preview Trigger */}
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) {
                setMobileStudioTab(
                  mobileStudioTab === "edit" ? "preview" : "edit",
                );
              } else {
                const previewEl = document.getElementById(
                  "live-preview-section",
                );
                previewEl?.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold transition cursor-pointer",
              mobileStudioTab === "preview"
                ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : "border-border bg-muted/40 hover:bg-muted text-foreground",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>
              {mobileStudioTab === "preview" ? "Edit Mode" : "Preview"}
            </span>
          </button>

          {/* Publish Header Button */}
          <button
            type="button"
            onClick={handleBroadcast}
            disabled={isPublishing || (!text.trim() && !mediaFile)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-bold px-5 py-2.5 text-xs shadow-[0_0_20px_rgba(245,158,11,0.35)] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{isPublishing ? "Publishing…" : "Publish"}</span>
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Mobile Segmented Control: Edit Studio vs Live Preview */}
      <div className="lg:hidden flex items-center justify-center p-1 rounded-2xl bg-muted/50 border border-border mb-6">
        <button
          type="button"
          onClick={() => setMobileStudioTab("edit")}
          className={cn(
            "flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
            mobileStudioTab === "edit"
              ? "bg-amber-400 text-black shadow-md font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>Studio Controls</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileStudioTab("preview")}
          className={cn(
            "flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
            mobileStudioTab === "preview"
              ? "bg-amber-400 text-black shadow-md font-bold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Live Mockup</span>
        </button>
      </div>

      {/* ─── Two-Column Responsive Grid Studio ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ── LEFT COLUMN: Composer & Cryptographic Controls (7 Cols) ────── */}
        <div
          className={cn(
            "lg:col-span-7 space-y-6",
            mobileStudioTab === "preview" && "hidden lg:block",
          )}
        >
          {/* Format Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none touch-momentum border-b border-border">
            {[
              { id: "text", label: "Text", icon: PenLine },
              { id: "photo", label: "Photo", icon: ImageIcon },
              { id: "video", label: "Video", icon: Video },
              { id: "poll", label: "Poll", icon: BarChart2 },
              { id: "question", label: "Question", icon: HelpCircle },
              { id: "voice", label: "Voice", icon: Mic },
              { id: "link", label: "Link", icon: Link2 },
              { id: "ai", label: "AI Assist", icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as FormatTab);
                    if (tab.id === "photo") fileInputRef.current?.click();
                    if (tab.id === "video") videoInputRef.current?.click();
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer border",
                    active
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleMediaSelected}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={videoInputRef}
            onChange={handleMediaSelected}
            accept="video/*"
            className="hidden"
          />

          {/* ── Main Composer Card ────────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl relative backdrop-blur-2xl transition-all">
            <div className="space-y-4">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                rows={5}
                placeholder="What's on your mind? Share a thought, ask a question, start a conversation..."
                className="w-full bg-transparent text-foreground text-base outline-none resize-none placeholder:text-muted-foreground leading-relaxed font-sans"
              />

              {/* Uploaded Media Thumbnail Preview */}
              {mediaPreview && (
                <div className="relative rounded-2xl overflow-hidden border border-border max-h-56 bg-black/40 flex items-center justify-center group">
                  {mediaType === "audio" ? (
                    <audio
                      controls
                      src={mediaPreview || undefined}
                      className="w-full"
                    />
                  ) : mediaType === "video" ? (
                    <video
                      src={mediaPreview}
                      controls
                      className="max-h-56 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Attached"
                      className="max-h-56 w-full object-contain"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFile(null);
                      setMediaPreview(null);
                      setMediaType(null);
                    }}
                    className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/70 text-white hover:bg-black flex items-center justify-center transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {isProcessingMedia && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center gap-2 text-xs text-amber-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Applying Privacy Shield...</span>
                    </div>
                  )}
                </div>
              )}

              {/* Poll Options Builder (active when poll tab selected) */}
              {activeTab === "poll" && (
                <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Poll Choices
                  </span>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono w-4">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const updated = [...pollOptions];
                          updated[idx] = e.target.value;
                          setPollOptions(updated);
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 rounded-xl bg-muted/50 border border-border px-3.5 py-2 text-xs text-foreground outline-none focus:border-amber-500/40"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPollOptions(
                              pollOptions.filter((_, i) => i !== idx),
                            )
                          }
                          className="text-red-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions([...pollOptions, ""])}
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-1 font-medium cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Option
                    </button>
                  )}
                </div>
              )}

              {/* Link Input (active when link tab selected) */}
              {activeTab === "link" && (
                <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/30 border border-border">
                  <Link2 className="h-4 w-4 text-amber-500 ml-2" />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="Paste article, repo, or document URL..."
                    className="flex-1 bg-transparent text-xs text-foreground outline-none py-1.5"
                  />
                </div>
              )}

              {/* Voice Record Box (active when voice tab selected) */}
              {activeTab === "voice" && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/[0.05] border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void toggleVoiceRecording()}
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center transition cursor-pointer",
                        isRecordingVoice
                          ? "bg-red-500 text-white animate-pulse"
                          : "bg-amber-500 text-black shadow-md",
                      )}
                    >
                      <Mic className="h-4 w-4" />
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {isRecordingVoice
                          ? "Stop recording"
                          : "Record voice clip"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {voiceDuration > 0
                          ? `00:${voiceDuration.toString().padStart(2, "0")} recorded`
                          : "Direct microphone audio streaming (Preview mode)"}
                      </p>
                    </div>
                  </div>
                  {isRecordingVoice && (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping mr-2" />
                  )}
                </div>
              )}

              {/* Composer Toolbar & Character Count */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                {/* Rich text formatting tools */}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => insertFormatting("**", "**")}
                    className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("*", "*")}
                    className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("\n- ")}
                    className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Bullet List"
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting("[", "](https://)")}
                    className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Link"
                  >
                    <Link2 className="h-4 w-4" />
                  </button>

                  {/* Emoji dropdown toggle */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 rounded-lg hover:bg-muted hover:text-foreground transition cursor-pointer"
                      title="Insert Emoji"
                    >
                      <Smile className="h-4 w-4" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute left-0 bottom-full mb-2 p-2 rounded-2xl bg-card border border-border shadow-2xl z-20 flex flex-wrap gap-1.5 w-48 backdrop-blur-2xl">
                        {EMOJI_LIST.map((emo) => (
                          <button
                            key={emo}
                            type="button"
                            onClick={() => appendEmoji(emo)}
                            className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-base cursor-pointer"
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Sparkle AI quick-trigger & Counter */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAiImprove}
                    className="h-7 w-7 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 hover:scale-105 transition cursor-pointer"
                    title="AI Polish"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>

                  <span
                    className={cn(
                      "text-xs font-mono font-medium",
                      text.length > 480
                        ? "text-red-500 font-bold"
                        : "text-muted-foreground",
                    )}
                  >
                    {text.length} / 500
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Identity Selection ────────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Identity</span>
              </h3>
              <span className="text-[10px] text-muted-foreground font-mono">
                Posting identity
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Fully Anonymous */}
              <button
                type="button"
                onClick={() => setIdentity("anonymous")}
                className={cn(
                  "flex flex-col p-4 rounded-2xl border text-left transition cursor-pointer relative",
                  identity === "anonymous"
                    ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                {identity === "anonymous" && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                )}
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-300 mb-2.5">
                  <Ghost className="h-4 w-4" />
                </div>
                <span className="font-sans text-xs font-bold text-foreground">
                  Fully Anonymous
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  No profile connection
                </span>
              </button>

              {/* Option 2: Sovereign Identity */}
              <button
                type="button"
                onClick={() => setIdentity("sovereign")}
                className={cn(
                  "flex flex-col p-4 rounded-2xl border text-left transition cursor-pointer relative",
                  identity === "sovereign"
                    ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                {identity === "sovereign" && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                )}
                <div className="h-9 w-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-300 mb-2.5">
                  <User className="h-4 w-4" />
                </div>
                <span className="font-sans text-xs font-bold text-foreground">
                  Sovereign Identity
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  @{currentUser?.handle || "sovereign"}
                </span>
              </button>

              {/* Option 3: Veil Persona */}
              <button
                type="button"
                onClick={() => {
                  setIdentity("persona");
                  randomizePersona();
                }}
                className={cn(
                  "flex flex-col p-4 rounded-2xl border text-left transition cursor-pointer relative",
                  identity === "persona"
                    ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                {identity === "persona" && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </span>
                )}
                <div className="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-300 mb-2.5">
                  <Lock className="h-4 w-4" />
                </div>
                <span className="font-sans text-xs font-bold text-foreground">
                  Veil Persona
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  @{personaName}
                </span>
              </button>
            </div>
          </div>

          {/* ── Who Can See This? ─────────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span>Who Can See This?</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                {
                  id: "everyone",
                  label: "Everyone",
                  desc: "Public transmission",
                },
                {
                  id: "circle",
                  label: "Social Circle",
                  desc: "People you follow",
                },
                {
                  id: "selected",
                  label: "Selected",
                  desc: "Choose specific people",
                },
                {
                  id: "anonymous_feed",
                  label: "Anonymous Feed",
                  desc: "Discoverable without profile attribution",
                },
              ].map((aud) => {
                const active = audience === aud.id;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setAudience(aud.id as AudienceOption)}
                    className={cn(
                      "flex flex-col p-3.5 rounded-2xl border text-left transition cursor-pointer",
                      active
                        ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                        : "border-border bg-muted/20 hover:bg-muted/40",
                    )}
                  >
                    <span className="font-sans text-xs font-bold text-foreground">
                      {aud.label}
                    </span>
                    <span className="text-[9.5px] text-muted-foreground mt-0.5 leading-tight">
                      {aud.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {audience === "selected" && (
            <label className="block rounded-2xl border border-border p-4 text-sm">
              Recipient handles (comma separated)
              <input
                value={selectedHandles}
                onChange={(event) => setSelectedHandles(event.target.value)}
                placeholder="alice, bob"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
          )}

          {mediaFile && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aiModifiedMedia}
                onChange={(event) => setAiModifiedMedia(event.target.checked)}
              />
              This media was created or altered with AI
            </label>
          )}
          {/* ── Transmission Lifetime & Engagement Toggles ────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Lifetime */}
            <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-3">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Transmission Lifetime</span>
              </h3>
              <div className="grid grid-cols-4 gap-1.5">
                {(["24h", "7d", "30d", "forever"] as LifetimeOption[]).map(
                  (lt) => {
                    const active = lifetime === lt;
                    return (
                      <button
                        key={lt}
                        type="button"
                        onClick={() => setLifetime(lt)}
                        className={cn(
                          "py-2 rounded-xl text-xs font-mono font-bold transition cursor-pointer border text-center",
                          active
                            ? "border-amber-500/60 bg-amber-500/15 text-amber-600 dark:text-amber-300"
                            : "border-border bg-muted/20 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {lt === "forever" ? "∞ Forever" : lt}
                      </button>
                    );
                  },
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                Expired posts stop appearing immediately. Stored media is
                cleaned up by the retention job.
              </p>
            </div>

            {/* Engagement Controls */}
            <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-3">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Engagement</span>
              </h3>

              <div className="space-y-2 text-xs">
                {[
                  { key: "allowReplies", label: "Allow replies" },
                  { key: "allowReactions", label: "Allow reactions" },
                  { key: "allowReposts", label: "Allow reposts" },
                  {
                    key: "anonymousReplies",
                    label: "Anonymous replies",
                    beta: true,
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between cursor-pointer group"
                  >
                    <span className="text-muted-foreground group-hover:text-foreground transition flex items-center gap-1.5">
                      {item.label}
                      {item.beta && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          BETA
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={(engagement as any)[item.key]}
                      onChange={(e) =>
                        setEngagement({
                          ...engagement,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Privacy Shield, AI & Live Preview (5 Cols) ───── */}
        <div
          className={cn(
            "lg:col-span-5 space-y-6",
            mobileStudioTab === "edit" && "hidden lg:block",
          )}
        >
          {/* ── Privacy Shield Card ───────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Privacy Shield</span>
              </h3>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                On-Device
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  id: "face_shield",
                  label: "Face Shield",
                  desc: "Automatically protect faces",
                },
                {
                  id: "pixelate",
                  label: "Pixelate Faces",
                  desc: "Blur detected faces",
                },
                {
                  id: "blur_bg",
                  label: "Blur Background",
                  desc: "Keep detected faces sharp; blur the surrounding image",
                },
                {
                  id: "remove_meta",
                  label: "Remove Metadata",
                  desc: "Remove location & device data",
                },
                {
                  id: "original",
                  label: "Original Media",
                  desc: "Keep faces and background; remove metadata",
                },
              ].map((opt) => {
                const active = privacyShield === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={
                      mediaType !== "image" &&
                      mediaType !== null &&
                      ["face_shield", "pixelate", "blur_bg"].includes(opt.id)
                    }
                    onClick={() => {
                      const mode = opt.id as PrivacyShieldOption;
                      setPrivacyShield(mode);
                      if (sourceFile.current)
                        void processMedia(sourceFile.current, mode);
                    }}
                    className={cn(
                      "flex items-start gap-3 w-full p-3 rounded-2xl border text-left transition cursor-pointer",
                      active
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-border/50 hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                        active
                          ? "border-amber-500 bg-amber-500"
                          : "border-border",
                      )}
                    >
                      {active && (
                        <div className="h-1.5 w-1.5 rounded-full bg-black" />
                      )}
                    </div>
                    <div>
                      <p className="font-sans text-xs font-bold text-foreground leading-none">
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── AI Intelligence Card ──────────────────────────────────────── */}
          <div className="rounded-[28px] border border-border bg-card/90 p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>AI Intelligence</span>
              </h3>
              {isAiLoading && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                  <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                </span>
              )}
            </div>

            {aiActionMessage && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400/90 italic animate-pulse">
                {aiActionMessage}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleAiImprove}
                disabled={isAiLoading}
                className="flex items-center gap-2 p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted hover:border-amber-500/40 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Improve</span>
              </button>

              <button
                type="button"
                onClick={handlePrivacyCheck}
                disabled={isAiLoading}
                className="flex items-center gap-2 p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted hover:border-emerald-500/40 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-emerald-500" />
                <span>Privacy Check</span>
              </button>

              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={isAiLoading}
                className="flex items-center gap-2 p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted hover:border-blue-500/40 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
              >
                <FileCheck className="h-3.5 w-3.5 text-blue-500" />
                <span>Generate</span>
              </button>

              <button
                type="button"
                onClick={handleAddHashtags}
                disabled={isAiLoading}
                className="flex items-center gap-2 p-3 rounded-2xl border border-border bg-muted/30 hover:bg-muted hover:border-purple-500/40 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
              >
                <span className="font-mono text-purple-500 dark:text-purple-400 font-bold">
                  #
                </span>
                <span>Hashtags</span>
              </button>
            </div>

            {/* Privacy Check Alert Result */}
            {privacyReport && (
              <div
                className={cn(
                  "p-3.5 rounded-2xl border text-xs leading-relaxed",
                  privacyReport.clean
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                )}
              >
                {privacyReport.clean ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4" /> No matching patterns
                    found. This basic check can miss identifying information.
                  </span>
                ) : (
                  <div>
                    <span className="font-bold">Privacy Warning:</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      {privacyReport.issues.map((iss, i) => (
                        <li key={i}>{iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Live Transmission Preview Card ───────────────────────────── */}
          <div
            id="live-preview-section"
            className="rounded-[28px] border border-amber-500/30 bg-card/90 p-6 shadow-2xl backdrop-blur-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Transmission Preview</span>
              </h3>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                Live Feed Mockup
              </span>
            </div>

            {/* Post Card Preview */}
            <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3.5">
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-300 font-bold text-xs">
                    {identity === "anonymous"
                      ? "AS"
                      : identity === "persona"
                        ? "VP"
                        : currentUser?.handle?.slice(0, 2).toUpperCase() ||
                          "ME"}
                  </div>
                  <div>
                    <p className="font-sans text-xs font-bold text-foreground leading-none">
                      {identity === "anonymous"
                        ? "Anonymous Signal"
                        : identity === "persona"
                          ? `@${personaName}`
                          : `@${currentUser?.handle || "sovereign"}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Just now &bull;{" "}
                      {audience === "everyone" ? "Global" : audience}
                    </p>
                  </div>
                </div>

                {/* Lifetime pill */}
                <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {lifetime === "forever" ? "Permanent" : lifetime}
                </span>
              </div>

              {/* Card Body */}
              <div className="text-xs text-foreground leading-relaxed">
                {text.trim() ? (
                  <MarkdownRenderer content={text} />
                ) : (
                  <p className="text-muted-foreground italic">
                    "What's something you wish someone had told you before
                    graduating?"
                  </p>
                )}
              </div>

              {/* Media attached */}
              {mediaPreview && (
                <div className="rounded-xl overflow-hidden max-h-48 bg-black/40 border border-border">
                  {mediaType === "audio" ? (
                    <audio
                      controls
                      src={mediaPreview || undefined}
                      className="w-full"
                    />
                  ) : mediaType === "video" ? (
                    <video
                      src={mediaPreview}
                      className="max-h-48 w-full object-contain"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="max-h-48 w-full object-contain"
                    />
                  )}
                </div>
              )}

              {/* Poll preview */}
              {activeTab === "poll" && (
                <div className="space-y-1.5 pt-1">
                  {pollOptions
                    .filter((o) => o.trim())
                    .map((opt, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border p-2.5 text-[11px] text-muted-foreground flex justify-between items-center bg-muted/20"
                      >
                        <span>{opt}</span>
                        <span className="text-[10px] font-mono">0%</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Identity protected badge */}
              <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-semibold pt-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Public identity follows your posting choice</span>
              </div>

              {/* Mock action toolbar */}
              <div className="flex items-center justify-between pt-3 border-t border-border text-muted-foreground text-xs">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-red-500" /> 12
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" /> 4
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Repeat2 className="h-3.5 w-3.5" /> 2
                  </span>
                </div>
                <Share2 className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Broad Full-Width CTA Bar ──────────────────────────────── */}
      <div className="mt-10">
        <button
          type="button"
          onClick={handleBroadcast}
          disabled={isPublishing || (!text.trim() && !mediaFile)}
          className={cn(
            "w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3.5 transition-all shadow-[0_0_35px_rgba(245,158,11,0.3)] cursor-pointer group",
            isPublishing || (!text.trim() && !mediaFile)
              ? "bg-neutral-800 text-neutral-500 opacity-60 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black active:scale-[0.99]",
          )}
        >
          {isPublishing ? (
            <Loader2 className="h-6 w-6 animate-spin text-black" />
          ) : (
            <Radio className="h-6 w-6 text-black group-hover:scale-110 transition-transform" />
          )}
          <div className="text-left">
            <p className="font-sans text-base sm:text-lg font-extrabold tracking-wide uppercase leading-none">
              {isPublishing
                ? "Broadcasting Transmission…"
                : "Broadcast Transmission"}
            </p>
            <p className="text-[11px] font-medium opacity-80 mt-1 leading-none">
              Your signal will be sent to the cosmos
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
