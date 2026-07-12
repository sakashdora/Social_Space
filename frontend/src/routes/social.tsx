import {
  createFileRoute,
  Link,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import {
  fetchFeed,
  toggleReaction,
  createComment,
  isAuthenticated,
  getCurrentUser,
  createChat,
  fetchChats,
  detectMediaType,
  deletePost,
} from "@/lib/api";
import type { ApiComment, ApiChat } from "@/lib/api";
import {
  Heart,
  MessageSquare,
  Send,
  Sparkles,
  Search,
  CornerDownRight,
  MessageCircle,
  X,
  Bell,
  Bookmark,
  SlidersHorizontal,
  Repeat,
  Share2,
  Shield,
  CheckCircle2,
  ChevronRight,
  Home,
  Rss,
  PlusCircle,
  UserRound,
  Video,
  Loader2,
  Menu,
  Trash2,
} from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { ThemeToggle } from "@/components/veil/ThemeToggle";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social Feed — Social Space" },
      { name: "description", content: "Read and share anonymous posts." },
    ],
  }),
  component: SocialComponent,
});

const categories = [
  "All",
  "Life",
  "Mental Health",
  "Career",
  "Ideas",
  "Confessions",
];

const trendingTopics = [
  {
    id: 1,
    title: "AI is changing the world",
    posts: "12.5K posts",
    gradient: "from-purple-500/20 to-indigo-500/20",
  },
  {
    id: 2,
    title: "Healing in silence",
    posts: "9.8K posts",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    id: 3,
    title: "Late night thoughts",
    posts: "8.2K posts",
    gradient: "from-pink-500/20 to-rose-500/20",
  },
  {
    id: 4,
    title: "Building in public",
    posts: "6.7K posts",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    id: 5,
    title: "The power of mindset",
    posts: "5.3K posts",
    gradient: "from-teal-500/20 to-emerald-500/20",
  },
];

const whoToFollow = [
  {
    name: "silent_wanderer",
    handle: "@silent_wanderer",
    color: "text-amber-500 bg-amber-500/10",
  },
  {
    name: "thoughts_unfiltered",
    handle: "@thoughts_unfiltered",
    color: "text-purple-500 bg-purple-500/10",
  },
  {
    name: "dream_builder",
    handle: "@dream_builder",
    color: "text-teal-500 bg-teal-500/10",
  },
];

const detectMediaInText = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const match = text.match(urlRegex);
  if (match) {
    for (const url of match) {
      const cleanUrl = url.split("?")[0].split("#")[0].toLowerCase();
      if (
        cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/) ||
        url.startsWith("data:image/")
      ) {
        return { url, type: "image" };
      }
      if (
        cleanUrl.match(/\.(mp4|webm|ogg|mov|m4v)$/) ||
        url.startsWith("data:video/")
      ) {
        return { url, type: "video" };
      }
    }
  }
  return null;
};

function PostCardSkeleton() {
  return (
    <div className="border border-border bg-white/[0.01] rounded-[28px] p-6 space-y-4 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/5" />
          <div className="space-y-2">
            <div className="h-3.5 w-20 bg-white/5 rounded-full" />
            <div className="h-2.5 w-28 bg-white/5 rounded-full" />
          </div>
        </div>
        <div className="h-6 w-16 bg-white/5 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-white/5 rounded-full" />
        <div className="h-4 w-5/6 bg-white/5 rounded-full" />
      </div>
      <div className="h-44 w-full bg-white/5 rounded-[20px]" />
      <div className="flex justify-between pt-2">
        <div className="h-4 w-12 bg-white/5 rounded-full" />
        <div className="h-4 w-12 bg-white/5 rounded-full" />
        <div className="h-4 w-12 bg-white/5 rounded-full" />
      </div>
    </div>
  );
}

function SocialComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [localReactions, setLocalReactions] = useState<
    Record<string, { count: number; active: boolean }>
  >({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [allPosts, setAllPosts] = useState<any[]>([]);

  const observerTarget = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const authed = isAuthenticated();
  const currentUser = getCurrentUser();

  // Reset pagination when category changes
  useEffect(() => {
    setPage(1);
    setAllPosts([]);
  }, [activeCategory]);

  // Fetch chronological feed with pagination
  const {
    data: pagePosts,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["posts", activeCategory, page],
    queryFn: () => fetchFeed(activeCategory, page),
  });

  // Append new paginated posts
  useEffect(() => {
    if (pagePosts) {
      if (page === 1) {
        setAllPosts(pagePosts);
      } else {
        setAllPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const newPosts = pagePosts.filter((p: any) => !ids.has(p.id));
          return [...prev, ...newPosts];
        });
      }
    }
  }, [pagePosts, page]);

  // Set up IntersectionObserver for Infinite Scroll
  useEffect(() => {
    if (!observerTarget.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !isFetching &&
          pagePosts &&
          pagePosts.length > 0
        ) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [isFetching, pagePosts]);

  // Fetch Chats
  const { data: chats = [] } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    enabled: authed,
    refetchInterval: 5000,
  });

  // Comments Query
  const { data: expandedPostDetails, isLoading: isCommentsLoading } = useQuery({
    queryKey: ["post-details", expandedPostId],
    queryFn: async () => {
      if (!expandedPostId) return null;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || ""}/v1/posts/${expandedPostId}`,
      );
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: !!expandedPostId,
  });

  // React Mutation
  const reactMutation = useMutation({
    mutationFn: toggleReaction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (expandedPostId === variables.postId) {
        queryClient.invalidateQueries({
          queryKey: ["post-details", expandedPostId],
        });
      }
    },
  });

  // Comment Mutation
  const commentMutation = useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) =>
      createComment(postId, text, "pseudo"),
    onSuccess: (_, variables) => {
      setCommentTexts((prev) => ({ ...prev, [variables.postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({
        queryKey: ["post-details", variables.postId],
      });
    },
  });

  // Delete Post Mutation
  const deletePostMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      showToast("Post deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setExpandedPostId(null);
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to delete post.");
    },
  });

  // Start Chat Mutation
  const createChatMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (data) => {
      navigate({
        to: "/messages/$threadId",
        params: { threadId: data.threadId },
      });
    },
    onError: (err: any) => {
      showToast(err.message || "Failed to start chat.");
    },
  });

  const handleStartChat = (targetHandle: string) => {
    if (!authed) {
      navigate({ to: "/onboarding" });
      return;
    }
    if (currentUser && targetHandle === currentUser.handle) {
      showToast("You cannot start a chat with yourself.");
      return;
    }
    createChatMutation.mutate(targetHandle);
  };

  const handleReact = (postId: string, currentCount: number) => {
    if (!authed) {
      navigate({ to: "/onboarding" });
      return;
    }

    const hasReacted = localReactions[postId]?.active;
    setLocalReactions((prev) => ({
      ...prev,
      [postId]: {
        active: !hasReacted,
        count: hasReacted ? currentCount - 1 : currentCount + 1,
      },
    }));

    reactMutation.mutate({ postId, reactionType: "heart" });
  };

  const handleToggleComments = (postId: string) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  const handleSendComment = (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    if (!authed) {
      navigate({ to: "/onboarding" });
      return;
    }
    commentMutation.mutate({ postId, text });
  };

  const filteredPosts = allPosts.filter(
    (p: any) =>
      p.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.topic.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="w-full min-h-screen bg-ink text-foreground selection:bg-amber-500/30 selection:text-white">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm shadow-xl">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="max-w-[1440px] px-4 sm:px-6 lg:px-8 py-8 mx-auto flex gap-6 lg:gap-8 justify-center items-start min-h-screen pt-4 md:pt-8 pb-28 lg:pb-10"
      >
        {/* Center Column: Feed (Max 760px) */}
        <main className="flex-1 w-full max-w-[760px] min-w-0 flex flex-col items-center pb-6">
          <div className="w-full space-y-8">
            {/* Feed Header */}
            <div className="text-left w-full">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Social Feed
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Share anonymously. Connect freely.
              </p>
            </div>

            {/* Large Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feed, authors, or topics..."
                className="w-full rounded-[20px] border border-border bg-ink-raised py-4 pl-12 pr-12 text-sm outline-none focus:border-[color:var(--primary)] focus:ring-1 focus:ring-[color:var(--primary)]/30 transition-all shadow-md placeholder:text-muted-foreground/60"
              />
              <button
                onClick={() => showToast("Search filters coming soon")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition p-1 cursor-pointer"
                aria-label="Filters"
              >
                <SlidersHorizontal className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Horizontal scroll Categories Tab */}
            <div className="relative flex items-center w-full">
              <div className="flex-1 flex gap-2.5 overflow-x-auto pb-2 scrollbar-none pr-8">
                {categories.map((cat) => (
                  <div key={cat} className="relative">
                    {activeCategory === cat ? (
                      <motion.button
                        layoutId="activeCategoryTab"
                        className="rounded-full px-5 py-2 text-xs font-bold bg-amber-500 text-zinc-950 shadow-md border border-transparent whitespace-nowrap cursor-pointer z-10 relative"
                        onClick={() => {
                          setActiveCategory(cat);
                          setExpandedPostId(null);
                        }}
                      >
                        {cat}
                      </motion.button>
                    ) : (
                      <button
                        className="rounded-full px-5 py-2 text-xs font-semibold bg-white/5 text-muted-foreground border border-border hover:text-foreground hover:bg-white/10 transition-all whitespace-nowrap cursor-pointer"
                        onClick={() => {
                          setActiveCategory(cat);
                          setExpandedPostId(null);
                        }}
                      >
                        {cat}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-gradient-to-l from-ink via-ink/80 to-transparent pl-4 pr-1 py-1 pointer-events-none">
                <ChevronRight className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
            </div>

            {/* Loading skeletons on first load */}
            {isLoading && page === 1 && (
              <div className="space-y-6 w-full">
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-400 w-full">
                Failed to load social feed: {(error as Error).message}
              </div>
            )}

            {/* Empty state */}
            {filteredPosts && filteredPosts.length === 0 && !isLoading && (
              <FrostedPanel className="border border-border p-14 text-center text-muted-foreground rounded-[28px] w-full shadow-lg">
                No posts found. Start the conversation by publishing a new post!
              </FrostedPanel>
            )}

            {/* Posts List */}
            {filteredPosts && filteredPosts.length > 0 && (
              <div className="space-y-6 w-full">
                {filteredPosts.map((post: any) => {
                  const reactionState = localReactions[post.id] || {
                    count: post.reactions,
                    active: false,
                  };
                  const isCommentsOpen = expandedPostId === post.id;

                  return (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="border border-border bg-white/[0.01] hover:bg-white/[0.02] rounded-[28px] p-6 hover:shadow-2xl shadow-lg hover:shadow-amber-500/[0.01] transition-all duration-300"
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center font-serif text-lg font-bold text-white shadow-md uppercase shrink-0"
                            style={{ backgroundColor: post.color }}
                          >
                            {post.author[0]}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <span className="font-semibold text-foreground leading-none">
                                {post.author}
                              </span>
                              {post.author === "anonymous" && (
                                <CheckCircle2 className="h-4.5 w-4.5 fill-amber-500 text-zinc-950 ml-1.5 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {post.handle} &bull; {post.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/5 border border-border px-3 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                            {post.topic}
                          </span>
                          {currentUser && post.author === currentUser.handle && post.author !== "anonymous" ? (
                            <button
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this post?")) {
                                  deletePostMutation.mutate(post.id);
                                }
                              }}
                              disabled={deletePostMutation.isPending}
                              className="text-red-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
                              title="Delete post"
                              aria-label="Delete post"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                showToast("Post options coming soon")
                              }
                              className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                              aria-label="Options"
                            >
                              &bull;&bull;&bull;
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Body Content */}
                      <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-all break-words [word-break:break-all] [overflow-wrap:anywhere] mb-4">
                        {post.body}
                      </p>

                      {/* Media container: fits media without cropping; type detected client-side */}
                      {(() => {
                        const mediaObj = post.mediaUrl
                          ? {
                              url: post.mediaUrl,
                              type: detectMediaType(post.mediaUrl),
                            }
                          : detectMediaInText(post.body);

                        if (!mediaObj) return null;
                        const isVideo = mediaObj.type === "video";

                        return (
                          <div className="rounded-[20px] border border-border overflow-hidden mb-4 bg-black/40 relative">
                            {isVideo ? (
                              <div className="relative w-full flex justify-center">
                                <video
                                  src={mediaObj.url}
                                  controls
                                  loop
                                  muted
                                  playsInline
                                  className="w-full max-h-[420px] object-contain bg-black"
                                />
                              </div>
                            ) : (
                              <div className="relative w-full flex justify-center bg-black/10">
                                <motion.img
                                  src={mediaObj.url}
                                  alt="Post media"
                                  whileHover={{ scale: 1.02 }}
                                  transition={{ duration: 0.3 }}
                                  loading="lazy"
                                  className="max-h-[420px] w-auto max-w-full object-contain"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Sentiment Analysis */}
                      {post.sentimentAnalysis && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[color:var(--primary)]/10 text-[10px] font-medium text-[color:var(--primary)] mb-4 border border-[color:var(--primary)]/20 shadow-sm shadow-amber-500/[0.01]">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>
                            Sentiment: {post.sentimentAnalysis.sentiment} (
                            {Math.round(
                              Math.abs(post.sentimentAnalysis.score) * 100,
                            )}
                            %)
                          </span>
                        </div>
                      )}

                      {/* Card Footer Toolbar */}
                      <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                        <div className="flex items-center gap-6">
                          {/* Like */}
                          <button
                            onClick={() => handleReact(post.id, post.reactions)}
                            className={cn(
                              "flex items-center gap-2 text-xs font-semibold transition hover:scale-105 cursor-pointer",
                              reactionState.active
                                ? "text-red-500"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Heart
                              className={cn(
                                "h-4.5 w-4.5",
                                reactionState.active && "fill-current",
                              )}
                            />
                            <span>{reactionState.count}</span>
                          </button>

                          {/* Comment */}
                          <button
                            onClick={() => handleToggleComments(post.id)}
                            className={cn(
                              "flex items-center gap-2 text-xs font-semibold transition hover:scale-105 cursor-pointer",
                              isCommentsOpen
                                ? "text-[color:var(--primary)]"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <MessageSquare className="h-4.5 w-4.5" />
                            <span>{post.replies}</span>
                          </button>

                          {/* Repost */}
                          <button
                            onClick={() => showToast("Reposted successfully")}
                            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition hover:scale-105 cursor-pointer"
                            aria-label="Repost"
                          >
                            <Repeat className="h-4.5 w-4.5" />
                            <span>3</span>
                          </button>

                          {/* Share */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                `${window.location.origin}/social?post=${post.id}`,
                              );
                              showToast("Link copied to clipboard");
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition hover:scale-105 cursor-pointer"
                          >
                            <Share2 className="h-4.5 w-4.5" />
                            <span>Share</span>
                          </button>
                        </div>

                        {/* Bookmark */}
                        <button
                          onClick={() => showToast("Bookmarked successfully")}
                          className="text-muted-foreground hover:text-foreground transition hover:scale-105 cursor-pointer"
                          aria-label="Bookmark"
                        >
                          <Bookmark className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Expanded Comments Thread */}
                      {isCommentsOpen && (
                        <div className="mt-4 border-t border-border pt-4 space-y-4 animate-fade-in">
                          {isCommentsLoading ? (
                            <div className="space-y-3 animate-pulse">
                              <div className="h-10 rounded-xl bg-white/5"></div>
                              <div className="h-10 rounded-xl bg-white/5"></div>
                            </div>
                          ) : expandedPostDetails?.comments &&
                            expandedPostDetails.comments.length > 0 ? (
                            <div className="space-y-3 pl-3 border-l-2 border-white/5">
                              {expandedPostDetails.comments.map(
                                (comment: ApiComment) => (
                                  <div
                                    key={comment.id}
                                    className="text-sm bg-black/10 dark:bg-white/[0.02] border border-border p-3.5 rounded-2xl flex gap-3"
                                  >
                                    <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-foreground">
                                          @{comment.user?.handle || "anonymous"}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {new Date(
                                            comment.createdAt,
                                          ).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="text-foreground/90 leading-relaxed">
                                        {comment.content}
                                      </p>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic text-center py-2">
                              No replies yet. Be the first to add one!
                            </p>
                          )}

                          {/* Quick Reply Form */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={commentTexts[post.id] || ""}
                              onChange={(e) =>
                                setCommentTexts((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              placeholder="Write a reply..."
                              className="flex-1 rounded-xl border border-border bg-black/20 px-4 py-2.5 text-xs outline-none focus:border-[color:var(--primary)] transition-colors"
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleSendComment(post.id);
                              }}
                            />
                            <button
                              onClick={() => handleSendComment(post.id)}
                              disabled={
                                commentMutation.isPending ||
                                !commentTexts[post.id]?.trim()
                              }
                              className="rounded-xl bg-[color:var(--primary)] px-3.5 py-2.5 text-primary-foreground transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Loader indicator while fetching more items */}
            {isFetching && page > 1 && (
              <div className="flex justify-center items-center py-4 w-full">
                <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
              </div>
            )}

            {/* Target element for Infinite Scroll IntersectionObserver */}
            <div ref={observerTarget} className="h-4 w-full" />

            {/* Active Chats Section (for Quick Navigation) */}
            {authed && chats.length > 0 && (
              <div className="mt-16 border-t border-white/10 pt-10 w-full">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-[color:var(--primary)] animate-pulse" />
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                      Active Conversations
                    </h2>
                  </div>
                  <Link
                    to="/messages"
                    className="text-xs font-semibold text-[color:var(--primary)] hover:underline flex items-center gap-1"
                  >
                    Open Inbox &rarr;
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {chats.slice(0, 4).map((chat: ApiChat) => {
                    const color = chat.color || "#8B5CF6";
                    return (
                      <Link
                        key={chat.id}
                        to="/messages/$threadId"
                        params={{ threadId: chat.id }}
                        className="flex items-center gap-3 bg-ink-raised/50 border border-border hover:border-white/20 p-4 rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg duration-300"
                      >
                        <div
                          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-serif text-sm font-bold text-white shadow-sm uppercase"
                          style={{ backgroundColor: color }}
                        >
                          {chat.handle[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm text-foreground truncate">
                              @{chat.handle}
                            </p>
                            <span className="text-[10px] text-muted-foreground">
                              {chat.disappearing || "7d"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {chat.lastMessage || "No messages yet"}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Sticky Sidebar Widgets */}
        <aside className="hidden xl:flex flex-col shrink-0 sticky top-4 max-h-[calc(100vh-32px)] w-[320px] overflow-y-auto space-y-6 scrollbar-none pr-1">
          {/* What's Trending Card */}
          <FrostedPanel className="border border-border p-5 rounded-[28px] shadow-lg shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <span>🔥</span> What's Trending
              </h2>
              <button
                onClick={() => showToast("Trending details coming soon")}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-4">
              {trendingTopics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center gap-3.5 group cursor-pointer hover:bg-white/5 p-1 rounded-xl transition duration-300"
                >
                  <span className="text-sm font-semibold text-muted-foreground w-4 text-center">
                    {topic.id}
                  </span>

                  {/* Frosted gradient thumbnail */}
                  <div
                    className={`h-11 w-11 rounded-lg bg-gradient-to-br ${topic.gradient} shrink-0 border border-white/5 flex items-center justify-center`}
                  >
                    <Sparkles className="h-4 w-4 text-white/40 group-hover:scale-110 transition duration-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs text-foreground group-hover:text-[color:var(--primary)] transition truncate">
                      {topic.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {topic.posts}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FrostedPanel>

          {/* Who to Follow Card */}
          <FrostedPanel className="border border-border p-5 rounded-[28px] shadow-lg shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <span>👤</span> Who to follow
              </h2>
              <button
                onClick={() => showToast("User directory coming soon")}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-4">
              {whoToFollow.map((user) => (
                <div
                  key={user.name}
                  className="flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${user.color} border border-white/5 font-serif`}
                    >
                      🎭
                    </div>
                    <div>
                      <p className="font-semibold text-xs text-foreground leading-none">
                        {user.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {user.handle}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleStartChat(user.name)}
                    className="rounded-full border border-amber-500/30 hover:border-amber-500/60 bg-amber-500/5 hover:bg-amber-500/10 px-4 py-1.5 text-[10px] font-bold text-amber-500 transition cursor-pointer"
                  >
                    Follow
                  </button>
                </div>
              ))}
            </div>
          </FrostedPanel>

          {/* Your voice matters Card */}
          <div className="rounded-[24px] border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.04] to-transparent p-5 relative overflow-hidden shadow-lg hover:border-amber-500/30 transition-all duration-300 group w-full shrink-0">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            <div className="flex gap-4 items-start">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform duration-300">
                <Shield className="h-5 w-5 text-amber-500" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-sans">
                  Your voice matters
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Speak freely. Stay anonymous. We protect your privacy with
                  client-side keys and strict data deletion policies.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
