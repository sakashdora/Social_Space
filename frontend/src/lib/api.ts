const API_BASE = "http://localhost:3000";

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#0D7377", "#8B5CF6", "#E5C07B", "#3EC5A6", 
    "#EF4444", "#3B82F6", "#10B981", "#F59E0B"
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

export function mapApiPostToUiPost(p: any) {
  const author = p.user ? p.user.handle : "anonymous";
  const handle = p.user ? `@${p.user.handle}` : "@anonymous";
  const color = p.user ? stringToColor(p.user.handle) : "#555555"; // Dark gray for fully anonymous

  return {
    id: p.id,
    author,
    color,
    handle,
    topic: p.category,
    time: formatRelativeTime(p.createdAt),
    body: p.content,
    media: p.mediaUrl ? "portrait" : null,
    synthetic: p.isAiModifiedMedia || false,
    reactions: p.reactionCount || 0,
    replies: p.commentCount || 0,
  };
}

// Helper to get auth header
function getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("veil_auth_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Check response status
async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Register a new anonymous user.
 */
export async function registerUser(handle: string, passphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/register`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ handle, passphrase }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("veil_auth_token", data.token);
    localStorage.setItem("veil_user", JSON.stringify(data.user));
  }
  return data;
}

/**
 * Login an existing user.
 */
export async function loginUser(handle: string, passphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ handle, passphrase }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("veil_auth_token", data.token);
    localStorage.setItem("veil_user", JSON.stringify(data.user));
  }
  return data;
}

/**
 * Log out user by clearing storage.
 */
export function logoutUser() {
  localStorage.removeItem("veil_auth_token");
  localStorage.removeItem("veil_user");
}

/**
 * Get current authenticated user details.
 */
export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("veil_user");
  return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("veil_auth_token");
}

/**
 * Fetch chronological feed.
 */
export async function fetchFeed(category?: string) {
  const url = new URL(`${API_BASE}/v1/posts`);
  if (category && category !== "All") {
    url.searchParams.append("category", category);
  }

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
  });
  const posts = await handleResponse(res);
  return posts.map(mapApiPostToUiPost);
}

/**
 * Fetch details of a single post (including comments).
 */
export async function fetchPostDetails(postId: string) {
  const res = await fetch(`${API_BASE}/v1/posts/${postId}`, {
    headers: getHeaders(),
  });
  const post = await handleResponse(res);
  return mapApiPostToUiPost(post);
}

/**
 * Create a new post.
 */
export async function createPost(content: string, category: string, mode: string, mediaUrl: string | null = null) {
  const res = await fetch(`${API_BASE}/v1/posts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content, category, mode, mediaUrl }),
  });
  return handleResponse(res);
}

/**
 * Add a comment/reply to a post.
 */
export async function createComment(postId: string, content: string, mode = "pseudo", parentCommentId: string | null = null) {
  const res = await fetch(`${API_BASE}/v1/posts/${postId}/comments`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ content, mode, parentCommentId }),
  });
  return handleResponse(res);
}

interface ReactionParams {
  postId?: string;
  commentId?: string;
  reactionType: string;
}

/**
 * Toggle reaction on a post or comment.
 */
export async function toggleReaction({ postId, commentId, reactionType }: ReactionParams) {
  const res = await fetch(`${API_BASE}/v1/reactions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ postId, commentId, reactionType }),
  });
  return handleResponse(res);
}

/**
 * Fetch RSS News feed.
 */
export async function fetchNews(topic = '') {
  const url = new URL(`${API_BASE}/api/rss`);
  if (topic) url.searchParams.append("topic", topic);
  const res = await fetch(url.toString(), {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

/**
 * Grok AI Helpers
 */
export async function generateArticle(topic: string, context = "") {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ topic, context }),
  });
  return handleResponse(res);
}

export async function correctGrammar(text: string) {
  const res = await fetch(`${API_BASE}/api/correct`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ text }),
  });
  return handleResponse(res);
}

export async function getSuggestions(text: string) {
  const res = await fetch(`${API_BASE}/api/suggest`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ text }),
  });
  return handleResponse(res);
}

/**
 * Upload Media (Mock)
 */
export async function uploadMedia(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await handleResponse(res);
  return data.url;
}

/**
 * Chat & Messages API
 */
export async function fetchChats() {
  const res = await fetch(`${API_BASE}/v1/chats`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function fetchChatMessages(threadId: string) {
  const res = await fetch(`${API_BASE}/v1/chats/${threadId}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function createChat(targetHandle: string) {
  const res = await fetch(`${API_BASE}/v1/chats`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ targetHandle }),
  });
  return handleResponse(res);
}

export async function sendChatMessage(threadId: string, body: string, mediaUrl: string | null = null) {
  const res = await fetch(`${API_BASE}/v1/chats/${threadId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ body, mediaUrl }),
  });
  return handleResponse(res);
}

export async function updateChatTimer(threadId: string, seconds: number) {
  const res = await fetch(`${API_BASE}/v1/chats/${threadId}/timer`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ seconds }),
  });
  return handleResponse(res);
}

/**
 * User Key & Account Management API
 */
export async function updateSecurityKey(newPassphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/security-key`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ newPassphrase }),
  });
  return handleResponse(res);
}

export async function deleteAccount() {
  const res = await fetch(`${API_BASE}/v1/auth/account`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  logoutUser();
  return data;
}
