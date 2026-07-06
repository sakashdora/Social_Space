import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { fetchFeed, toggleReaction, createComment, isAuthenticated, getCurrentUser, createChat, fetchChats } from "@/lib/api";
import { Heart, MessageSquare, Send, Sparkles, Search, CornerDownRight, MessageCircle } from "lucide-react";
import { FrostedPanel } from "@/components/veil/FrostedPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/social")({
  component: SocialComponent,
});

const categories = ["All", "Life", "Mental Health", "Relationships", "Career", "Confessions", "Ideas"];

const isVideoUrl = (url: string) => {
  if (!url) return false;
  if (url.startsWith("data:video/")) return true;
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ["mp4", "webm", "ogg", "mov", "m4v"].includes(ext || "");
};

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

function SocialComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [localReactions, setLocalReactions] = useState<Record<string, { count: number, active: boolean }>>({});

  const authed = isAuthenticated();
  const currentUser = getCurrentUser();

  // 1. Fetch Feed
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["posts", activeCategory],
    queryFn: () => fetchFeed(activeCategory),
  });

  // Fetch Chats for Bottom Navigation/Quick Access
  const { data: chats = [], isLoading: isChatsLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: fetchChats,
    enabled: authed,
    refetchInterval: 5000,
  });

  // 2. Fetch Comments for Expanded Post
  const { data: expandedPostDetails, isLoading: isCommentsLoading } = useQuery({
    queryKey: ["post-details", expandedPostId],
    queryFn: async () => {
      if (!expandedPostId) return null;
      const res = await fetch(`http://localhost:3000/v1/posts/${expandedPostId}`);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: !!expandedPostId,
  });

  // 3. React Mutation
  const reactMutation = useMutation({
    mutationFn: toggleReaction,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      if (expandedPostId === variables.postId) {
        queryClient.invalidateQueries({ queryKey: ["post-details", expandedPostId] });
      }
    },
  });

  // 4. Comment Mutation
  const commentMutation = useMutation({
    mutationFn: ({ postId, text }: { postId: string, text: string }) => 
      createComment(postId, text, "pseudo"),
    onSuccess: (_, variables) => {
      setCommentTexts(prev => ({ ...prev, [variables.postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post-details", variables.postId] });
    },
  });

  // 5. Start Chat Mutation
  const createChatMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (data) => {
      navigate({
        to: "/messages/$threadId",
        params: { threadId: data.threadId },
      });
    },
    onError: (err: any) => {
      alert(err.message || "Failed to start chat.");
    }
  });

  const handleStartChat = (targetHandle: string) => {
    if (!authed) {
      alert("Please login/onboard to start messaging!");
      navigate({ to: "/onboarding" });
      return;
    }
    if (currentUser && targetHandle === currentUser.handle) {
      alert("You cannot message yourself.");
      return;
    }
    createChatMutation.mutate(targetHandle);
  };

  const handleReact = (postId: string, currentCount: number) => {
    if (!authed) {
      alert("Please login/onboard to react to posts!");
      window.location.href = "/onboarding";
      return;
    }

    // Toggle local state optimistically
    const hasReacted = localReactions[postId]?.active;
    setLocalReactions(prev => ({
      ...prev,
      [postId]: {
        active: !hasReacted,
        count: hasReacted ? currentCount - 1 : currentCount + 1
      }
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
      alert("Please login/onboard to write comments!");
      window.location.href = "/onboarding";
      return;
    }
    commentMutation.mutate({ postId, text });
  };

  // Filter posts by search query local filter
  const filteredPosts = posts?.filter((p: any) => 
    p.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 pb-32">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-medium tracking-tight mb-4">Social Feed</h1>
        
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feed, authors, or topics..."
            className="w-full rounded-2xl border border-border bg-ink-raised py-3 pl-10 pr-4 text-sm outline-none focus:border-[color:var(--primary)] transition-colors"
          />
        </div>

        {/* Category Selector Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setExpandedPostId(null);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium border transition-all whitespace-nowrap",
                activeCategory === cat
                  ? "bg-[color:var(--primary)] text-primary-foreground border-transparent"
                  : "bg-white/5 text-muted-foreground border-border hover:text-foreground hover:bg-white/10"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {isLoading && (
        <div className="space-y-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 rounded-3xl bg-white/5 border border-border"></div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load social feed: {(error as Error).message}
        </div>
      )}

      {filteredPosts && filteredPosts.length === 0 && (
        <div className="rounded-xl border border-border bg-ink-raised p-8 text-center text-muted-foreground">
          No posts found. Start the conversation by publishing a new post!
        </div>
      )}

      {filteredPosts && filteredPosts.length > 0 && (
        <div className="space-y-6">
          {filteredPosts.map((post: any) => {
            // Read reaction state from local optimistic map or fallback to post count
            const reactionState = localReactions[post.id] || { count: post.reactions, active: false };
            const isCommentsOpen = expandedPostId === post.id;

            return (
              <FrostedPanel key={post.id} className="border border-border p-6 transition-all duration-300">
                {/* Post Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-full flex items-center justify-center font-serif text-lg font-bold text-white shadow-md uppercase"
                      style={{ backgroundColor: post.color }}
                    >
                      {post.author[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground leading-none">{post.author}</p>
                      <p className="text-xs text-muted-foreground mt-1">{post.handle} &bull; {post.time}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/5 border border-border px-3 py-1 text-[10px] font-medium tracking-wide text-muted-foreground">
                    {post.topic}
                  </span>
                </div>

                {/* Content */}
                <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-all break-words [word-break:break-all] [overflow-wrap:anywhere] mb-4">
                  {post.body}
                </p>

                {/* Optional Media (direct upload or parsed URL) */}
                {(() => {
                  const mediaObj = post.mediaUrl 
                    ? { url: post.mediaUrl, type: isVideoUrl(post.mediaUrl) ? "video" : "image" }
                    : detectMediaInText(post.body);

                  if (!mediaObj) return null;

                  return (
                    <div className="rounded-3xl border border-border overflow-hidden mb-4 bg-black/40 relative">
                      {mediaObj.type === "video" ? (
                        <div className="relative w-full">
                          <video 
                            src={mediaObj.url} 
                            controls 
                            loop 
                            muted 
                            playsInline
                            className="w-full max-h-[450px] object-contain bg-black"
                          />
                          <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur border border-white/10 shadow-md">
                            Video Media
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full">
                          <img 
                            src={mediaObj.url} 
                            alt="Post media" 
                            className="w-full max-h-[450px] object-cover hover:scale-[1.01] transition-transform duration-500" 
                          />
                          <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold text-white backdrop-blur border border-white/10 shadow-md">
                            Image Media
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Sentiment Badge (Veil AI) */}
                {post.sentimentAnalysis && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[color:var(--primary)]/10 text-[10px] font-medium text-[color:var(--primary)] mb-4">
                    <Sparkles className="h-3 w-3" />
                    <span>Sentiment: {post.sentimentAnalysis.sentiment} ({Math.round(Math.abs(post.sentimentAnalysis.score) * 100)}%)</span>
                  </div>
                )}

                {/* Actions Toolbar */}
                <div className="flex items-center gap-6 border-t border-border pt-4 mt-2">
                  <button 
                    onClick={() => handleReact(post.id, post.reactions)}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium transition hover:scale-105",
                      reactionState.active 
                        ? "text-red-500 font-semibold" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Heart className={cn("h-4.5 w-4.5", reactionState.active && "fill-current")} />
                    <span>{reactionState.count}</span>
                  </button>

                  <button 
                    onClick={() => handleToggleComments(post.id)}
                    className={cn(
                      "flex items-center gap-2 text-xs font-medium transition hover:scale-105",
                      isCommentsOpen ? "text-[color:var(--primary)] font-semibold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="h-4.5 w-4.5" />
                    <span>{post.replies} Replies</span>
                  </button>

                  <button 
                    onClick={() => handleStartChat(post.author)}
                    disabled={currentUser && post.author === currentUser.handle}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-[color:var(--veil-glow)] transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
                    title={currentUser && post.author === currentUser.handle ? "You cannot message yourself" : `Chat with @${post.author}`}
                  >
                    <MessageCircle className="h-4.5 w-4.5" />
                    <span>Message</span>
                  </button>
                </div>

                {/* Expanded Inline Comment Thread */}
                {isCommentsOpen && (
                  <div className="mt-4 border-t border-border pt-4 space-y-4 animate-fade-in">
                    {/* List of comments */}
                    {isCommentsLoading ? (
                      <div className="space-y-3 animate-pulse">
                        <div className="h-10 rounded-xl bg-white/5"></div>
                        <div className="h-10 rounded-xl bg-white/5"></div>
                      </div>
                    ) : expandedPostDetails?.comments && expandedPostDetails.comments.length > 0 ? (
                      <div className="space-y-3 pl-3 border-l-2 border-white/5">
                        {expandedPostDetails.comments.map((comment: any) => (
                          <div key={comment.id} className="text-sm bg-black/10 dark:bg-white/[0.02] border border-border p-3.5 rounded-2xl flex gap-3">
                            <CornerDownRight className="h-4 w-4 shrink-0 text-muted-foreground/60 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-foreground">@{comment.user?.handle || "anonymous"}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-foreground/90 leading-relaxed">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-2">
                        No replies yet. Be the first to add one!
                      </p>
                    )}

                    {/* Quick Comment Input Form */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentTexts[post.id] || ""}
                        onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a reply..."
                        className="flex-1 rounded-xl border border-border bg-black/20 px-4 py-2.5 text-xs outline-none focus:border-[color:var(--primary)] transition-colors"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendComment(post.id);
                        }}
                      />
                      <button
                        onClick={() => handleSendComment(post.id)}
                        disabled={commentMutation.isPending || !commentTexts[post.id]?.trim()}
                        className="rounded-xl bg-[color:var(--primary)] px-3.5 py-2.5 text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </FrostedPanel>
            );
          })}
        </div>
      )}

      {/* Active Chats Section for Quick Navigation */}
      {authed && (
        <div className="mt-16 border-t border-white/10 pt-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[color:var(--primary)] animate-pulse" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">Active Conversations</h2>
            </div>
            <Link 
              to="/messages" 
              className="text-xs font-semibold text-[color:var(--primary)] hover:underline flex items-center gap-1"
            >
              Open Inbox &rarr;
            </Link>
          </div>

          {isChatsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
              <div className="h-20 rounded-2xl bg-white/5 border border-border"></div>
              <div className="h-20 rounded-2xl bg-white/5 border border-border"></div>
            </div>
          ) : chats.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground bg-ink-raised/30">
              No active conversations. Click "Message" on any post above to start chatting anonymously!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {chats.map((chat: any) => {
                const color = chat.color || "#8B5CF6";
                return (
                  <Link
                    key={chat.id}
                    to="/messages/$threadId"
                    params={{ threadId: chat.id }}
                    className="flex items-center gap-3 bg-ink-raised/50 border border-border hover:border-white/20 p-4 rounded-2xl transition hover:-translate-y-0.5 hover:shadow-lg duration-300"
                  >
                    <div 
                      className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-serif text-sm font-bold text-white shadow-sm uppercase animate-fade-in"
                      style={{ backgroundColor: color }}
                    >
                      {chat.handle[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-foreground truncate">@{chat.handle}</p>
                        <span className="text-[10px] text-muted-foreground">{chat.disappearing || "7d"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {chat.lastMessage || "No messages yet"}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

