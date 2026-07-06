import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/api";
import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Sparkles } from "lucide-react";

export const Route = createFileRoute("/video")({
  component: VideoFeed,
});

function PremiumPlayer({ post }: { post: any }) {
  const url = post.mediaUrl || "";
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isVideo, setIsVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Detect if video format
  useEffect(() => {
    if (!url) return;
    if (url.startsWith("data:video/")) {
      setIsVideo(true);
      return;
    }
    const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
    const isVid = ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext || "");
    setIsVideo(isVid);
  }, [url]);

  // Autoplay when visible in viewport
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 } // Play when 50% visible
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
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
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
    const progressPercent = (videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100;
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
      className="relative w-full aspect-[3/4] sm:aspect-[9/16] max-h-[75vh] bg-black/95 flex items-center justify-center overflow-hidden group select-none transition-all duration-300 hover:shadow-2xl border border-white/5 rounded-3xl"
    >
      {isVideo ? (
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            src={url}
            loop
            playsInline
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            className="w-full h-full object-contain cursor-pointer"
            onClick={handlePlayPause}
          />

          {/* Custom Media Controls Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
            {/* Top Bar: Info Badge */}
            <div className="flex justify-between items-start">
              {post.synthetic ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-yellow-500/30">
                  <Sparkles className="h-3 w-3" />
                  Synthetic AI Modified
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-[10px] font-semibold tracking-wide backdrop-blur-md border border-white/10">
                  Secure Media
                </span>
              )}
            </div>

            {/* Bottom Controls panel */}
            <div className="flex flex-col gap-3 mt-auto pointer-events-auto">
              {/* Timeline slider */}
              <div className="flex items-center gap-2 w-full px-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={handleTimelineChange}
                  className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[color:var(--primary)] hover:h-1.5 transition-all"
                />
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between">
                {/* Left controls */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePlayPause}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                  </button>

                  <button 
                    onClick={handleMuteToggle}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>

                  <span className="text-[10px] text-white/80 font-mono tracking-wider">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right controls */}
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

          {/* Big Center Play Icon when paused */}
          {!isPlaying && (
            <div 
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/35 cursor-pointer z-0"
            >
              <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/25 transition group-hover:scale-110 shadow-2xl">
                <Play className="h-7 w-7 text-white fill-current translate-x-0.5" />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Image Media rendering */
        <div className="relative w-full h-full flex items-center justify-center group/img">
          <img 
            src={url} 
            alt="Media Card" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
        </div>
      )}

      {/* Persistent Static Info Overlay (User Badge and Caption) */}
      <div className="absolute bottom-0 inset-x-0 p-5 flex flex-col justify-end pointer-events-none z-20 bg-gradient-to-t from-black/90 via-black/30 to-transparent">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div 
            className="h-9 w-9 rounded-full flex items-center justify-center font-serif text-sm font-bold text-white shadow-lg uppercase"
            style={{ backgroundColor: post.color }}
          >
            {post.author[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white leading-tight truncate">@{post.author}</p>
            <p className="text-[10px] text-white/50 leading-none mt-1">{post.time}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/90 line-clamp-2 max-w-[85%]">
          {post.body}
        </p>
      </div>
    </div>
  );
}

function VideoFeed() {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["posts", "Video"],
    queryFn: () => fetchFeed("Video"),
  });

  return (
    <div className="mx-auto max-w-lg py-8 px-4 pb-32 h-full">
      <header className="text-center mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Media Portal</h1>
        <p className="text-xs text-muted-foreground mt-2">End-to-end secure, untraceable media streams.</p>
      </header>

      {isLoading && (
        <div className="space-y-8 animate-pulse">
          {[1, 2].map(i => (
            <div key={i} className="w-full aspect-[3/4] sm:aspect-[9/16] rounded-3xl bg-white/5 border border-white/5"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load media: {(error as Error).message}
        </div>
      )}

      {posts && posts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-muted-foreground text-xs leading-relaxed">
          No secure media uploaded yet.<br />Go to Compose to share a photo or video anonymously!
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className="space-y-10 flex flex-col items-center">
          {posts.map((post: any) => (
            <div key={post.id} className="w-full">
              {post.mediaUrl ? (
                <PremiumPlayer post={post} />
              ) : (
                <div className="p-8 text-center border border-white/10 rounded-2xl bg-white/5">
                  <p className="text-muted-foreground text-xs">Media unavailable or expired.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
