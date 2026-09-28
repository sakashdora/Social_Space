import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchFeed,
  mapApiPostToUiPost,
  detectMediaType,
  toggleReaction,
  createComment,
  fetchPostDetails,
  getCurrentUser,
  type ApiPost,
} from "@/lib/api";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Film,
  PlusCircle,
  Heart,
  MessageCircle,
  Share2,
  Check,
  RotateCcw,
  SlidersHorizontal,
  LayoutGrid,
  Radio,
  Send,
  X,
  Eye,
  Clock,
  ShieldCheck,
  AlertCircle,
  PictureInPicture2,
  FastForward,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { SocialSpaceEmblem } from "@/components/veil/SocialSpaceEmblem";

export const Route = createFileRoute("/video")({
  head: () => ({
    meta: [
      { title: "Visual Signals — Social Space" },
      {
        name: "description",
        content:
          "Encrypted, metadata-stripped video feeds and visual transmissions with zero trackers.",
      },
    ],
  }),
  component: VideoFeed,
});

type UiPostType = ReturnType<typeof mapApiPostToUiPost>;

/* ─── Video Comment Drawer Component ─────────────────────────────────────── */
function VideoCommentsDrawer({
  postId,
  isOpen,
  onClose,
}: {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: postDetails, isLoading } = useQuery({
    queryKey: ["post-details", postId],
    queryFn: () => fetchPostDetails(postId),
    enabled: isOpen,
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => createComment(postId, text, "pseudo"),
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["post-details", postId] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || commentMutation.isPending) return;
    commentMutation.mutate(commentText.trim());
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 220 }}
      className="absolute inset-x-0 bottom-0 z-40 max-h-[85%] flex flex-col rounded-t-3xl border-t border-amber-500/30 bg-[#090d14]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">
            Cryptographic Whispers ({postDetails?.comments?.length ?? 0})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
          aria-label="Close whispers"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-[160px] max-h-[280px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-xs text-white/40 animate-pulse">
            Decrypting transmission comments…
          </div>
        ) : !postDetails?.comments || postDetails.comments.length === 0 ? (
          <div className="text-center py-8 text-xs text-white/40">
            No whispers recorded yet. Be the first to add your cipher note.
          </div>
        ) : (
          postDetails.comments.map((c: any) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-amber-300">
                  @{c.user?.handle || "anonymous"}
                </span>
                <span className="text-[10px] text-white/40">
                  {new Date(c.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-white/80 leading-relaxed break-words">{c.content}</p>
            </div>
          ))
        )}
      </div>

      {/* Input Field */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-black/40 flex items-center gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Transmit an anonymous reply…"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-amber-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || commentMutation.isPending}
          className="rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 p-2 text-black transition"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </motion.div>
  );
}

/* ─── Premium Modern Video Player Component ─────────────────────────────── */
function ModernVideoPlayer({
  post,
  isActiveInReel = false,
}: {
  post: UiPostType;
  isActiveInReel?: boolean;
}) {
  const qc = useQueryClient();
  const streamUrl = post.mediaStreamUrl || post.mediaUrl || "";
  const thumbUrl =
    post.thumbStreamUrl || (streamUrl ? `${streamUrl}?thumb=true` : undefined);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [reactionCount, setReactionCount] = useState(post.reactions || 0);

  const speeds = [1.0, 1.25, 1.5, 2.0];
  const isVideo =
    post.mediaType === "video" ||
    post.topic === "Video" ||
    detectMediaType(streamUrl) === "video";

  // Intersection observer auto-play
  useEffect(() => {
    if (!isVideo || !videoRef.current || hasError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current
              ?.play()
              .then(() => setIsPlaying(true))
              .catch(() => {});
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.6 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isVideo, hasError]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextIndex = (speedIndex + 1) % speeds.length;
    setSpeedIndex(nextIndex);
    videoRef.current.playbackRate = speeds[nextIndex];
  };

  const togglePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP not supported or failed", err);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    const progressPercent =
      (videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100;
    setProgress(progressPercent);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setHasError(false);
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * (videoRef.current.duration || 1);
    videoRef.current.currentTime = newTime;
    setProgress(value);
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  // Real-time Like Mutation
  const reactionMutation = useMutation({
    mutationFn: () => toggleReaction({ postId: post.id, reactionType: "heart" }),
    onMutate: () => {
      setIsLiked((prev) => !prev);
      setReactionCount((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1));
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 900);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const handleDoubleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    reactionMutation.mutate();
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/social?highlight=${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      onDoubleClick={handleDoubleTap}
      className={cn(
        "relative w-full aspect-[9/16] sm:aspect-[4/5] max-h-[76vh] sm:max-h-[82vh] bg-[#070a0f] flex items-center justify-center overflow-hidden rounded-[28px] border border-white/10 group select-none transition-all duration-300 shadow-[0_12px_45px_rgba(0,0,0,0.85)]",
        "hover:border-amber-500/40 hover:shadow-[0_0_35px_rgba(245,158,11,0.15)]",
      )}
    >
      {/* Double Tap Heart Burst Animation */}
      <AnimatePresence>
        {showHeartBurst && (
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1.3, opacity: 1 }}
            exit={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute z-40 flex items-center justify-center"
          >
            <Heart className="h-24 w-24 fill-amber-400 text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.9)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Video or Fallback */}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0c1017] to-[#06080d]">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Radio className="h-7 w-7 animate-pulse text-amber-400" />
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-400 border border-amber-500/20 mb-2">
            Archived Transmission
          </span>
          <p className="text-sm font-serif font-bold text-white mb-1">
            Visual Signal Expired
          </p>
          <p className="text-xs text-white/50 max-w-xs mb-4 leading-relaxed">
            This media payload was safely purged under Social Space's zero-retention privacy policy.
          </p>
          <button
            onClick={() => {
              setHasError(false);
              videoRef.current?.load();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
          >
            <RotateCcw className="h-3 w-3" />
            Reconnect Stream
          </button>
        </div>
      ) : isVideo ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            src={streamUrl}
            poster={thumbUrl}
            loop
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => setHasError(true)}
            onClick={handlePlayPause}
            className="w-full h-full object-cover sm:object-contain cursor-pointer"
          />

          {/* Center Play/Pause Indicator when paused */}
          {!isPlaying && !hasError && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/35 cursor-pointer z-10 backdrop-blur-[2px]"
            >
              <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500/50 backdrop-blur-md flex items-center justify-center transition group-hover:scale-110 shadow-[0_0_35px_rgba(245,158,11,0.35)]">
                <Play className="h-7 w-7 text-amber-300 fill-current translate-x-0.5" />
              </div>
            </motion.div>
          )}

          {/* Top Pill Overlay */}
          <div className="absolute top-4 left-4 right-16 flex items-center gap-2 pointer-events-none z-20">
            {post.synthetic ? (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/25 text-amber-300 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-amber-500/40 shadow-lg">
                <Sparkles className="h-3 w-3 text-amber-400" />
                AI Synthetic
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 text-white/90 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-white/10 shadow-lg">
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                Metadata Stripped
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-black/40 text-white/60 text-[10px] backdrop-blur-md border border-white/10 font-mono">
              {post.topic || "Visual"}
            </span>
          </div>

          {/* Floating Right Action Bar */}
          <div className="absolute right-3.5 bottom-24 flex flex-col items-center gap-4 z-20 pointer-events-auto">
            {/* Heart Reaction */}
            <button
              onClick={() => reactionMutation.mutate()}
              aria-label="React to transmission"
              className="flex flex-col items-center gap-1 group/btn"
            >
              <div
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-md border shadow-lg active:scale-90",
                  isLiked
                    ? "bg-amber-500 border-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                    : "bg-black/50 border-white/15 text-white hover:border-amber-400/50 hover:bg-black/70",
                )}
              >
                <Heart
                  className={cn(
                    "h-5 w-5 transition-transform group-hover/btn:scale-110",
                    isLiked && "fill-current",
                  )}
                />
              </div>
              <span className="text-[10px] font-bold text-white/80 drop-shadow">
                {reactionCount}
              </span>
            </button>

            {/* Comment Drawer Trigger */}
            <button
              onClick={() => setShowComments((v) => !v)}
              aria-label="View or post whispers"
              className="flex flex-col items-center gap-1 group/btn"
            >
              <div className="h-11 w-11 rounded-full bg-black/50 border border-white/15 text-white hover:border-amber-400/50 hover:bg-black/70 flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-lg active:scale-90">
                <MessageCircle className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
              </div>
              <span className="text-[10px] font-bold text-white/80 drop-shadow">
                {post.replies || 0}
              </span>
            </button>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopyLink}
              aria-label="Share cipher link"
              className="flex flex-col items-center gap-1 group/btn"
            >
              <div className="h-11 w-11 rounded-full bg-black/50 border border-white/15 text-white hover:border-amber-400/50 hover:bg-black/70 flex items-center justify-center transition-all duration-200 backdrop-blur-md shadow-lg active:scale-90">
                {copied ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Share2 className="h-5 w-5 transition-transform group-hover/btn:scale-110" />
                )}
              </div>
              <span className="text-[10px] font-bold text-white/80 drop-shadow">
                {copied ? "Copied" : "Share"}
              </span>
            </button>

            {/* Playback Speed Pill */}
            <button
              onClick={cycleSpeed}
              className="h-8 px-2 rounded-full bg-black/50 border border-white/15 text-[10px] font-mono font-bold text-amber-300 hover:border-amber-400/50 backdrop-blur-md shadow-lg transition active:scale-90"
            >
              {speeds[speedIndex]}x
            </button>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              aria-label="Picture-in-picture mode"
              className="h-8 w-8 rounded-full bg-black/50 border border-white/15 text-white/80 hover:text-white hover:border-amber-400/50 flex items-center justify-center backdrop-blur-md shadow-lg transition active:scale-90"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom Scrubbing and Quick Controls Overlay */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 pb-16 pt-8 px-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end transition-opacity duration-300 z-10",
              isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100",
            )}
          >
            {/* Timeline Progress Scrubber */}
            <div className="flex items-center gap-2 w-full mb-2">
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={handleTimelineChange}
                aria-label="Scrub video timeline"
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-2 transition-all"
              />
            </div>

            {/* Time readout and primary control buttons */}
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="p-1 rounded-lg hover:bg-white/10 transition"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                </button>

                <button
                  onClick={handleMuteToggle}
                  className="p-1 rounded-lg hover:bg-white/10 transition"
                  aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-amber-300" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>

                <span className="text-[10px] text-white/70 font-mono tracking-wider">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <button
                onClick={handleFullscreen}
                className="p-1 rounded-lg hover:bg-white/10 transition"
                aria-label="Toggle fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Image Broadcast Card */
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={streamUrl}
            alt="Transmitted media signal"
            onError={() => setHasError(true)}
            className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 pointer-events-none" />

          {/* Right Action Bar for Image */}
          <div className="absolute right-3.5 bottom-24 flex flex-col items-center gap-4 z-20 pointer-events-auto">
            <button
              onClick={() => reactionMutation.mutate()}
              className="flex flex-col items-center gap-1"
            >
              <div
                className={cn(
                  "h-11 w-11 rounded-full flex items-center justify-center backdrop-blur-md border shadow-lg",
                  isLiked
                    ? "bg-amber-500 border-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                    : "bg-black/50 border-white/15 text-white",
                )}
              >
                <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
              </div>
              <span className="text-[10px] font-bold text-white/80">{reactionCount}</span>
            </button>

            <button
              onClick={() => setShowComments((v) => !v)}
              className="flex flex-col items-center gap-1"
            >
              <div className="h-11 w-11 rounded-full bg-black/50 border border-white/15 text-white flex items-center justify-center backdrop-blur-md shadow-lg">
                <MessageCircle className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-white/80">{post.replies || 0}</span>
            </button>

            <button onClick={handleCopyLink} className="flex flex-col items-center gap-1">
              <div className="h-11 w-11 rounded-full bg-black/50 border border-white/15 text-white flex items-center justify-center backdrop-blur-md shadow-lg">
                {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Share2 className="h-5 w-5" />}
              </div>
              <span className="text-[10px] font-bold text-white/80">Share</span>
            </button>
          </div>
        </div>
      )}

      {/* Author and Payload Info Overlay */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 flex flex-col justify-end pointer-events-none z-20 bg-gradient-to-t from-[#05070a] via-[#05070a]/80 to-transparent">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center font-serif text-xs font-bold text-white shadow-md uppercase border border-white/20"
            style={{ backgroundColor: post.color || "#d97706" }}
          >
            {post.author[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-xs sm:text-sm text-white leading-tight truncate">
              @{post.author}
            </p>
            <p className="text-[10px] text-white/50">{post.time}</p>
          </div>
        </div>

        {post.body && (
          <p className="text-xs text-white/85 line-clamp-2 mt-2 leading-relaxed pointer-events-auto">
            {post.body}
          </p>
        )}
      </div>

      {/* Real-time Comments Drawer */}
      <AnimatePresence>
        {showComments && (
          <VideoCommentsDrawer
            postId={post.id}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main VideoFeed Page Component ───────────────────────────────────────── */
function VideoFeed() {
  const [activeFilter, setActiveFilter] = useState<"All" | "Video" | "Synthetic">("All");
  const [viewMode, setViewMode] = useState<"theater" | "grid">("theater");

  // Fetch posts with media
  const {
    data: allPosts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["posts", "media-feed"],
    queryFn: () => fetchFeed(undefined, 1, { hasMedia: true }),
  });

  // Filter posts client-side for ultra-fast snappy switching
  const filteredPosts = React.useMemo(() => {
    return allPosts.filter((post: UiPostType) => {
      // Must have stream URL or media
      if (!post.mediaStreamUrl && !post.mediaUrl) return false;

      if (activeFilter === "Video") {
        return (
          post.mediaType === "video" ||
          post.topic === "Video" ||
          detectMediaType(post.mediaStreamUrl || post.mediaUrl) === "video"
        );
      }
      if (activeFilter === "Synthetic") {
        return post.synthetic === true;
      }
      return true;
    });
  }, [allPosts, activeFilter]);

  return (
    <div className="cosmic-theme min-h-screen text-white mx-auto w-full max-w-4xl py-6 sm:py-8 px-4 sm:px-6 pb-36 lg:pb-20">
      {/* Page Header */}
      <header className="text-center mb-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-amber-300 backdrop-blur-md mb-3 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <Film className="h-3.5 w-3.5 text-amber-400" />
          <span>CIPHER MEDIA BROADCASTS</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          Visual Signals
        </h1>
        <p className="text-xs sm:text-sm text-white/60 mt-2 max-w-md mx-auto leading-relaxed">
          Zero-telemetry cryptographic video reels and captures. All EXIF metadata and device fingerprints automatically stripped at ingestion.
        </p>
      </header>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-8">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl border border-white/10 bg-[#0c1017]/80 backdrop-blur-xl">
          <button
            onClick={() => setActiveFilter("All")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
              activeFilter === "All"
                ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "text-white/60 hover:text-white hover:bg-white/5",
            )}
          >
            All Signals
          </button>
          <button
            onClick={() => setActiveFilter("Video")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
              activeFilter === "Video"
                ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "text-white/60 hover:text-white hover:bg-white/5",
            )}
          >
            <Film className="h-3.5 w-3.5" />
            Motion & Reels
          </button>
          <button
            onClick={() => setActiveFilter("Synthetic")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
              activeFilter === "Synthetic"
                ? "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "text-white/60 hover:text-white hover:bg-white/5",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Synthetic
          </button>
        </div>

        {/* View Mode & Compose CTA */}
        <div className="flex items-center gap-2">
          {/* Layout switcher */}
          <div className="flex items-center p-1 rounded-xl border border-white/10 bg-[#0c1017]/80">
            <button
              onClick={() => setViewMode("theater")}
              aria-label="Theater Reel View"
              className={cn(
                "p-1.5 rounded-lg transition",
                viewMode === "theater"
                  ? "bg-white/15 text-amber-300"
                  : "text-white/50 hover:text-white",
              )}
            >
              <Radio className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Gallery Grid View"
              className={cn(
                "p-1.5 rounded-lg transition",
                viewMode === "grid"
                  ? "bg-white/15 text-amber-300"
                  : "text-white/50 hover:text-white",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Broadcast Button */}
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 text-xs font-bold transition shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Broadcast Signal</span>
          </Link>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && (
        <div className="space-y-8 flex flex-col items-center animate-pulse">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="w-full max-w-lg aspect-[9/16] sm:aspect-[4/5] rounded-[28px] bg-[#0c1017] border border-white/10 shadow-xl"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center backdrop-blur-xl">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-300">
            Failed to connect to cipher transmission feed
          </p>
          <p className="text-xs text-red-300/70 mt-1 max-w-sm mx-auto">
            {(error as Error).message}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/30 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry Feed
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredPosts.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-[#0c1017]/85 backdrop-blur-xl p-10 sm:p-12 text-center text-white/60 text-xs leading-relaxed flex flex-col items-center shadow-2xl">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
            <Film className="h-7 w-7" />
          </div>
          <p className="text-lg font-serif font-bold text-white mb-1">
            No transmissions detected
          </p>
          <p className="max-w-sm text-white/50 mb-6">
            There are currently no media broadcasts matching "{activeFilter}". Publish the first sovereign video with zero telemetry.
          </p>
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black px-6 py-3 text-xs font-bold transition shadow-[0_0_25px_rgba(245,158,11,0.35)] active:scale-95"
          >
            <PlusCircle className="h-4 w-4" />
            Broadcast Visual Media
          </Link>
        </div>
      )}

      {/* Posts Feed Display */}
      {!isLoading && filteredPosts.length > 0 && (
        <div
          className={cn(
            viewMode === "theater"
              ? "space-y-10 flex flex-col items-center max-w-lg sm:max-w-xl mx-auto"
              : "grid grid-cols-1 sm:grid-cols-2 gap-6",
          )}
        >
          {filteredPosts.map((post: UiPostType) => (
            <div key={post.id} className="w-full">
              <ModernVideoPlayer post={post} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
