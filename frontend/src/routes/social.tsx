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
  createPost,
  toggleReaction,
  createComment,
  isAuthenticated,
  getCurrentUser,
  createChat,
  fetchChats,
  detectMediaType,
  deletePost,
  fetchTrendingTopics,
  fetchWhoToFollow,
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
  Flame,
  Users,
} from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { ThemeToggle } from "@/components/veil/ThemeToggle";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

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

const defaultTrendingTopics = [
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

const defaultWhoToFollow = [
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

  // Fetch trending topics dynamically
  const { data: trendingTopicsData } = useQuery({
    queryKey: ["trendingTopics"],
    queryFn: fetchTrendingTopics,
    refetchOnWindowFocus: false,
  });

  // Fetch who to follow recommendations dynamically
  const { data: whoToFollowData } = useQuery({
    queryKey: ["whoToFollow"],
    queryFn: fetchWhoToFollow,
    refetchOnWindowFocus: false,
  });

  const trendingTopics = trendingTopicsData || defaultTrendingTopics;
  const whoToFollow = whoToFollowData || defaultWhoToFollow;

  // Local state to track followed handles (interactive simulation)
  const [followedHandles, setFollowedHandles] = useState<string[]>([]);

  // Inline Quick Post state
  const [quickText, setQuickText] = useState("");
  const [quickAnon, setQuickAnon] = useState<"full" | "pseudo">("full");
  const [isQuickPosting, setIsQuickPosting] = useState(false);
  const [showMobileTrending, setShowMobileTrending] = useState(false);

  const handleQuickPost = async () => {
    if (!quickText.trim()) return;
    if (!authed) {
      navigate({ to: "/onboarding" });
      return;
    }
    setIsQuickPosting(true);
    try {
      await createPost(
        quickText,
        activeCategory === "All" ? "Life" : activeCategory,
        quickAnon,
      );
      setQuickText("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      showToast("Transmission broadcasted to Social Space!");
    } catch (err: any) {
      showToast(err.message || "Failed to publish transmission.");
    } finally {
      setIsQuickPosting(false);
    }
  };

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
    <div className="cosmic-theme w-full min-h-screen bg-[#06070a] text-white selection:bg-amber-500/30 selection:text-amber-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-500/30 bg-[#0c1017]/95 px-5 py-3 text-sm text-white shadow-2xl backdrop-blur-xl">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white"
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
        className="max-w-[1440px] px-3 sm:px-6 lg:px-8 py-4 sm:py-8 mx-auto flex gap-6 lg:gap-8 justify-center items-start min-h-screen pb-36 lg:pb-12"
      >
        {/* Center Column: Feed (Max 760px) */}
        <main className="flex-1 w-full max-w-[760px] min-w-0 flex flex-col items-center pb-6">
          <div className="w-full space-y-6">
            {/* Feed Header */}
            <div className="text-left w-full">
              <span className="text-[10px] tracking-[0.2em] font-semibold text-amber-400 uppercase">
                COMMUNITY CHRONICLES
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mt-1">
                Social Stream
              </h1>
              <p className="text-xs sm:text-sm text-white/60 mt-1">
                Uncensored thoughts, unfiltered perspectives. Zero tracking algorithms.
              </p>
            </div>

            {/* Large Search Bar */}
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search feed, handles, or topics..."
                className="w-full rounded-2xl border border-white/10 bg-[#0c1017]/90 py-3.5 pl-11 pr-12 text-sm text-white outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-inner placeholder:text-white/30"
              />
              <button
                onClick={() => showToast("Showing all verified topics")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition p-1 cursor-pointer"
                aria-label="Filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>

            {/* Horizontal scroll Categories Tab */}
            <div className="relative flex items-center w-full">
              <div className="flex-1 flex gap-2 overflow-x-auto pb-2 scrollbar-none pr-8 touch-momentum">
                {categories.map((cat) => (
                  <div key={cat} className="relative">
                    {activeCategory === cat ? (
                      <motion.button
                        layoutId="activeCategoryTab"
                        className="rounded-full px-5 py-2 text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.35)] border border-transparent whitespace-nowrap cursor-pointer z-10 relative"
                        onClick={() => {
                          setActiveCategory(cat);
                          setExpandedPostId(null);
                        }}
                      >
                        {cat}
                      </motion.button>
                    ) : (
                      <button
                        className="rounded-full px-5 py-2 text-xs font-medium bg-white/[0.04] text-white/60 border border-white/10 hover:text-white hover:bg-white/[0.08] hover:border-amber-400/30 transition-all whitespace-nowrap cursor-pointer"
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
              <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-gradient-to-l from-background via-background/90 dark:from-[#06070a] dark:via-[#06070a]/90 to-transparent pl-4 pr-1 py-1 pointer-events-none">
                <ChevronRight className="h-4 w-4 text-foreground/40 dark:text-white/40" />
              </div>
            </div>

            {/* Mobile / Tablet Trending Drawer */}
            <div className="xl:hidden w-full">
              <button
                type="button"
                onClick={() => setShowMobileTrending(!showMobileTrending)}
                className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm"
              >
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>{showMobileTrending ? "Hide Trending Topics" : "View Trending Topics"}</span>
              </button>

              <AnimatePresence>
                {showMobileTrending && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none touch-momentum">
                      {trendingTopics.map((topic) => (
                        <div
                          key={topic.id}
                          onClick={() => {
                            setSearchQuery(topic.title);
                            showToast(`Filtered by "${topic.title}"`);
                          }}
                          className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#0c1017]/90 px-3.5 py-2 shrink-0 cursor-pointer hover:border-amber-400/40 transition-colors"
                        >
                          <span className="text-xs font-mono font-bold text-white/40">#{topic.id}</span>
                          <span className="text-xs font-medium text-white truncate max-w-[150px]">{topic.title}</span>
                          <span className="text-[10px] text-amber-400/80 font-mono">{topic.posts}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Inline Quick Transmission Box */}
            <div className="w-full rounded-[26px] border border-white/10 bg-[#0c1017]/85 p-5 shadow-xl relative overflow-hidden backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-white/60">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  <span className="font-semibold text-foreground dark:text-white">Broadcast to {activeCategory}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickAnon(quickAnon === "full" ? "pseudo" : "full")}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5",
                    quickAnon === "full"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {quickAnon === "full" ? (
                    <>
                      <Shield className="h-3 w-3" /> Anonymous
                    </>
                  ) : (
                    <>
                      <UserRound className="h-3 w-3" /> @{currentUser?.handle || "pseudonym"}
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder={authed ? "Share a thought, confession, or idea anonymously..." : "Sign in or pick a handle to broadcast..."}
                rows={2}
                className="mt-3 w-full bg-transparent text-foreground dark:text-white text-sm outline-none resize-none placeholder:text-muted-foreground"
              />

              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <Link
                  to="/compose"
                  className="text-xs text-muted-foreground hover:text-foreground transition flex items-center gap-1.5"
                >
                  <PlusCircle className="h-3.5 w-3.5" /> Full Studio (Media, Articles)
                </Link>

                <button
                  type="button"
                  onClick={handleQuickPost}
                  disabled={isQuickPosting || !quickText.trim()}
                  className="rounded-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:brightness-110 text-black font-semibold px-5 py-2 text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition cursor-pointer disabled:opacity-45 disabled:from-neutral-300 disabled:via-neutral-300 disabled:to-neutral-300 dark:disabled:from-neutral-800 dark:disabled:via-neutral-800 dark:disabled:to-neutral-800 disabled:text-neutral-500 dark:disabled:text-neutral-400 disabled:shadow-none disabled:cursor-not-allowed active:scale-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isQuickPosting ? "Broadcasting…" : "Broadcast"}</span>
                </button>
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
                      className="border border-white/10 bg-[#0c1017]/85 hover:border-amber-400/35 rounded-[28px] p-6 sm:p-7 hover:shadow-2xl shadow-[0_4px_25px_rgba(0,0,0,0.35)] transition-all duration-300 relative overflow-hidden backdrop-blur-xl"
                    >
                      {/* Card Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-full flex items-center justify-center font-sans text-sm font-bold text-white shadow-md uppercase shrink-0"
                            style={{ backgroundColor: post.color }}
                          >
                            {post.author[0]}
                          </div>
                          <div>
                            <div className="flex items-center">
                              <span className="font-semibold text-white leading-none">
                                {post.author}
                              </span>
                              {post.author === "anonymous" && (
                                <CheckCircle2 className="h-4 w-4 fill-amber-400 text-black ml-1.5 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-white/40 mt-1">
                              {post.handle} &bull; {post.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/[0.05] border border-white/10 px-3 py-1 text-[10px] font-medium tracking-wide text-white/60 uppercase">
                            {post.topic}
                          </span>
                          {currentUser &&
                          post.author === currentUser.handle &&
                          post.author !== "anonymous" ? (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Are you sure you want to delete this post?",
                                  )
                                ) {
                                  deletePostMutation.mutate(post.id);
                                }
                              }}
                              disabled={deletePostMutation.isPending}
                              className="text-red-400 hover:text-red-300 p-1 cursor-pointer transition-colors"
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
                              className="text-white/40 hover:text-white p-1 cursor-pointer"
                              aria-label="Options"
                            >
                              &bull;&bull;&bull;
                            </button>
                          )}
                        </div>
                      </div>


                      {/* Card Body Content */}
                      <div className="mb-4">
                        <MarkdownRenderer content={post.body} />
                      </div>

                      {/* Media container: fits media without cropping; type detected client-side */}
                      {(() => {
                        const streamUrl = post.mediaStreamUrl || post.mediaUrl;
                        const mediaObj = streamUrl
                          ? {
                              url: streamUrl,
                              thumbUrl: post.thumbStreamUrl || `${streamUrl}?thumb=true`,
                              type: post.mediaType === "video" ? "video" : detectMediaType(streamUrl),
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
                                  poster={"thumbUrl" in mediaObj ? mediaObj.thumbUrl : undefined}
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
                        <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
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
          <div className="border border-white/10 bg-[#0c1017]/85 p-6 rounded-[28px] shadow-xl backdrop-blur-xl shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-sm font-bold text-foreground dark:text-white flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <span>Trending Transmissions</span>
              </h2>
              <button
                onClick={() => showToast("Showing top signals")}
                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400/80 hover:text-amber-500 cursor-pointer uppercase tracking-wider"
              >
                Live
              </button>
            </div>

            <div className="space-y-3.5">
              {trendingTopics.map((topic) => (
                <div
                  key={topic.id}
                  onClick={() => {
                    setSearchQuery(topic.title);
                    showToast(`Filtered by "${topic.title}"`);
                  }}
                  className="flex items-center gap-3.5 group cursor-pointer hover:bg-white/[0.04] p-2 rounded-2xl transition duration-200"
                >
                  <span className="text-xs font-mono font-bold text-white/40 w-4 text-center">
                    {topic.id}
                  </span>

                  <div
                    className={`h-10 w-10 rounded-xl bg-gradient-to-br ${topic.gradient} shrink-0 border border-white/10 flex items-center justify-center`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300 group-hover:scale-110 transition duration-300" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-white group-hover:text-amber-300 transition truncate">
                      {topic.title}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5 font-mono">
                      {topic.posts}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Who to Follow Card */}
          <div className="border border-white/10 bg-[#0c1017]/85 p-6 rounded-[28px] shadow-xl backdrop-blur-xl shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans text-sm font-bold text-foreground dark:text-white flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span>Community Signals</span>
              </h2>
              <button
                onClick={() => showToast("Directory updated")}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer uppercase tracking-wider"
              >
                Discover
              </button>
            </div>

            <div className="space-y-3.5">
              {whoToFollow.map((user) => {
                const isFollowing = followedHandles.includes(user.name);
                return (
                  <div
                    key={user.name}
                    className="flex items-center justify-between gap-2.5 p-1 rounded-2xl hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-xs ${user.color} border border-white/10 font-bold shrink-0 text-white`}
                      >
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-white leading-none truncate">
                          {user.name}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1 truncate">
                          {user.handle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleStartChat(user.name)}
                        className="rounded-full border border-white/10 bg-white/[0.05] p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white cursor-pointer"
                        title={`Encrypted message ${user.handle}`}
                        aria-label={`Message ${user.handle}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (isFollowing) {
                            setFollowedHandles((prev) => prev.filter((h) => h !== user.name));
                            showToast(`Unfollowed ${user.handle}`);
                          } else {
                            setFollowedHandles((prev) => [...prev, user.name]);
                            showToast(`Following ${user.handle}`);
                          }
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[10px] font-semibold transition cursor-pointer",
                          isFollowing
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-300"
                            : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        {isFollowing ? "Connected" : "Connect"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sovereign Guarantee Card */}
          <div className="rounded-[28px] border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-amber-500/[0.03] to-white/95 dark:to-[#0c1017] p-5 relative overflow-hidden shadow-xl w-full shrink-0">
            <div className="flex gap-3.5 items-start">
              <div className="h-10 w-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <Shield className="h-5 w-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Zero Surveillance Invariant
                </h3>
                <p className="text-xs text-foreground/75 dark:text-white/60 leading-relaxed">
                  No shadow-bans. No engagement scoring. Your posts flow directly to readers in honest chronological order.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </motion.div>
    </div>
  );
}
