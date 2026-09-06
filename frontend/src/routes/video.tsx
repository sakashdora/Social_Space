import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed, mapApiPostToUiPost, detectMediaType } from "@/lib/api";
import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Sparkles,
  Film,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/video")({
  component: VideoFeed,
});

function PremiumPlayer({
  post,
}: {
  post: ReturnType<typeof mapApiPostToUiPost>;
}) {
  const streamUrl = post.mediaStreamUrl || post.mediaUrl || "";
  const thumbUrl = post.thumbStreamUrl || (streamUrl ? `${streamUrl}?thumb=true` : undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isVideo, setIsVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!streamUrl) return;
    setIsVideo(post.mediaType === "video" || post.topic === "Video" || detectMediaType(streamUrl) === "video");
  }, [streamUrl, post]);

  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

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
      { threshold: 0.5 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isVideo]);

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
  };

  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    setProgress(value);
  };

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] sm:aspect-[9/16] max-h-[70vh] sm:max-h-[78vh] bg-[#0c1017] flex items-center justify-center overflow-hidden group select-none transition-all duration-300 border border-white/10 hover:border-amber-500/40 rounded-3xl shadow-[0_0_35px_rgba(0,0,0,0.7)]"
    >
      {isVideo ? (
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
            className="w-full h-full object-contain cursor-pointer"
            onClick={handlePlayPause}
          />

          {/* Custom Controls Overlay */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 flex flex-col justify-between p-4 transition-opacity duration-300 z-10",
            isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100",
          )}>
            {/* Top Bar */}
            <div className="flex justify-between items-start">
              {post.synthetic ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-amber-500/40">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  Synthetic AI Modified
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-white/10">
                  Direct Raw Stream
                </span>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col gap-3 mt-auto pointer-events-auto">
              <div className="flex items-center gap-2 w-full px-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleTimelineChange}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:h-1.5 transition-all"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayPause}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4 fill-current" />
                    )}
                  </button>

                  <button
                    onClick={handleMuteToggle}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </button>

                  <span className="text-[10px] text-white/80 font-mono tracking-wider">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!isPlaying && (
            <div
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer z-0"
            >
              <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-md flex items-center justify-center transition group-hover:scale-110 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
                <Play className="h-7 w-7 text-amber-300 fill-current translate-x-0.5" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full h-full flex items-center justify-center group/img">
          <img
            src={streamUrl}
            alt="Media broadcast"
            className="max-w-full max-h-full object-contain transition-transform duration-700 group-hover/img:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
        </div>
      )}

      {/* Persistent Info Overlay */}
      <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end pointer-events-none z-20 bg-gradient-to-t from-[#06070a] via-[#06070a]/70 to-transparent">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center font-serif text-sm font-bold text-white shadow-lg uppercase border border-white/20"
            style={{ backgroundColor: post.color || "#d97706" }}
          >
            {post.author[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white leading-tight truncate">
              @{post.author}
            </p>
            <p className="text-xs text-white/50">{post.time}</p>
          </div>
        </div>
        <p className="text-xs text-white/80 line-clamp-2 mt-2 pointer-events-auto">
          {post.body}
        </p>
      </div>
    </div>
  );
}

function VideoFeed() {
  const {
    data: posts,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["posts", "Video"],
    queryFn: () => fetchFeed("Video"),
  });

  return (
    <div className="cosmic-theme min-h-screen text-white mx-auto w-full max-w-lg sm:max-w-xl py-6 sm:py-8 px-4 sm:px-6 pb-36 lg:pb-16">
      <header className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-medium tracking-wide text-amber-300 backdrop-blur-md mb-3">
          <Film className="h-3.5 w-3.5" />
          <span>ENCRYPTED MEDIA FEEDS</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Visual Signals
        </h1>
        <p className="text-xs text-white/60 mt-2 max-w-sm mx-auto">
          End-to-end stripped metadata media feeds. No telemetry or watch trackers.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-8 animate-pulse">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="w-full aspect-[3/4] sm:aspect-[9/16] rounded-3xl bg-[#0c1017] border border-white/10"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-300 backdrop-blur-xl">
          Failed to load media stream: {(error as Error).message}
        </div>
      )}

      {posts && posts.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-[#0c1017]/80 backdrop-blur-xl p-10 text-center text-white/60 text-xs leading-relaxed flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <Film className="h-6 w-6" />
          </div>
          <p className="text-base font-serif font-bold text-white mb-1">No transmissions detected yet</p>
          <p className="max-w-xs text-white/50 mb-6">Be the first to share an encrypted photo or video with zero metadata footprint.</p>
          <Link
            to="/compose"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 text-xs font-semibold transition shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          >
            <PlusCircle className="h-4 w-4" />
            Broadcast Visual Media
          </Link>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className="space-y-8 flex flex-col items-center">
          {posts.map((post: any) => (
            <div key={post.id} className="w-full">
              {post.mediaStreamUrl || post.mediaUrl ? (
                <PremiumPlayer post={post} />
              ) : (
                <div className="p-8 text-center border border-white/10 rounded-2xl bg-[#0c1017]">
                  <p className="text-white/40 text-xs">
                    Media payload unavailable or expired.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

