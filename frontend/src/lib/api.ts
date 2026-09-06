const API_BASE = import.meta.env.VITE_API_URL || "";

export interface SentimentAnalysis {
  sentiment: string;
  score: number;
}

export type MediaKind = "image" | "video" | "unknown";

export interface ApiPost {
  id: string;
  userId: string | null;
  content: string;
  category: string;
  mediaUrl: string | null;
  mediaStreamUrl?: string | null;
  thumbStreamUrl?: string | null;
  mediaId: string | null;
  storagePath?: string | null;
  thumbStoragePath?: string | null;
  aiLabels: string | null;
  sentimentAnalysis: string | SentimentAnalysis | null;
  isDeleted: boolean;
  sharedPostId: string | null;
  createdAt: string;
  user?: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  } | null;
  media?: {
    type: "IMAGE" | "VIDEO";
    thumbnailPath: string | null;
  } | null;
  reactionCount?: number;
  commentCount?: number;
  isAiModifiedMedia?: boolean;
}

/**
 * Authoritatively classify a media URL as image/video when possible.
 */
export function detectMediaType(url?: string | null): MediaKind {
  if (!url) return "unknown";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:image/")) return "image";
  if (url.includes("/api/media/stream") && url.includes("thumb=true")) return "image";

  const path = url.split("?")[0].split("#")[0].toLowerCase();
  const ext = path.split(".").pop() || "";
  if (["mp4", "webm", "ogg", "mov", "m4v", "avi", "mkv"].includes(ext))
    return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"].includes(ext))
    return "image";
  return "unknown";
}

export interface ApiComment {
  id: string;
  postId: string;
  userId: string | null;
  parentCommentId: string | null;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  user?: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  } | null;
}

export interface ApiChat {
  id: string;
  handle: string;
  color?: string;
  lastMessage?: string;
  disappearing?: string;
}

export interface ApiUser {
  id: string;
  handle: string;
  avatarUrl: string | null;
  createdAt: string;
  pendingDeletionAt: string | null;
  chatPublicKey: string | null;
  chatPublicKeyAlgo: string | null;
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#0D7377",
    "#8B5CF6",
    "#E5C07B",
    "#3EC5A6",
    "#EF4444",
    "#3B82F6",
    "#10B981",
    "#F59E0B",
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

export function mapApiPostToUiPost(p: ApiPost) {
  const author = p.user ? p.user.handle : "anonymous";
  const handle = p.user ? `@${p.user.handle}` : "@anonymous";
  const color = p.user ? stringToColor(p.user.handle) : "#555555"; // Dark gray for fully anonymous

  const streamUrl = p.mediaStreamUrl || (p.mediaUrl?.startsWith("/api/media/stream") ? p.mediaUrl : null);
  const isVideoMedia = p.media?.type === "VIDEO" || p.category === "Video";

  return {
    id: p.id,
    author,
    color,
    handle,
    topic: p.category,
    time: formatRelativeTime(p.createdAt),
    body: p.content,
    media: (streamUrl || p.mediaUrl) ? "portrait" : null,
    mediaUrl: streamUrl || p.mediaUrl || null,
    mediaStreamUrl: streamUrl || null,
    thumbStreamUrl: p.thumbStreamUrl || (streamUrl ? `${streamUrl}?thumb=true` : null),
    mediaType: isVideoMedia ? "video" : (p.media?.type === "IMAGE" ? "image" : detectMediaType(p.mediaUrl)),
    sentimentAnalysis: p.sentimentAnalysis
      ? typeof p.sentimentAnalysis === "string"
        ? JSON.parse(p.sentimentAnalysis)
        : p.sentimentAnalysis
      : null,
    synthetic: p.isAiModifiedMedia || false,
    reactions: p.reactionCount || 0,
    replies: p.commentCount || 0,
  };
}

// Helper to get auth header
function getHeaders(
  extraHeaders: Record<string, string> = {},
): Record<string, string> {
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
    let msg =
      errorData.message ||
      (typeof errorData.error === "string"
        ? errorData.error
        : errorData.error?.message) ||
      `HTTP error! status: ${response.status}`;
    throw new Error(msg);
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
export async function fetchFeed(category?: string, page?: number) {
  let url = `${API_BASE}/v1/posts`;
  const params = new URLSearchParams();
  if (category && category !== "All") {
    params.append("category", category);
  }
  if (page) {
    params.append("page", page.toString());
  }
  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const res = await fetch(url, {
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
export async function createPost(
  content: string,
  category: string,
  mode: string,
  mediaPayload?:
    | string
    | {
        storagePath?: string | null;
        thumbStoragePath?: string | null;
        mediaId?: string | null;
        mediaUrl?: string | null;
      }
    | null,
) {
  let bodyPayload: Record<string, any> = { content, category, mode };
  if (typeof mediaPayload === "string") {
    if (mediaPayload.startsWith("media/")) {
      bodyPayload.storagePath = mediaPayload;
    } else {
      bodyPayload.mediaUrl = mediaPayload;
    }
  } else if (mediaPayload && typeof mediaPayload === "object") {
    bodyPayload = { ...bodyPayload, ...mediaPayload };
  }

  const res = await fetch(`${API_BASE}/v1/posts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(bodyPayload),
  });
  return handleResponse(res);
}

/**
 * Delete a post (soft delete).
 */
export async function deletePost(postId: string) {
  const res = await fetch(`${API_BASE}/v1/posts/${postId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  return handleResponse(res);
}

/**
 * Add a comment/reply to a post.
 */
export async function createComment(
  postId: string,
  content: string,
  mode = "pseudo",
  parentCommentId: string | null = null,
) {
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
export async function toggleReaction({
  postId,
  commentId,
  reactionType,
}: ReactionParams) {
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
export async function fetchNews(topic = "") {
  let url = `${API_BASE}/api/rss`;
  if (topic) {
    const params = new URLSearchParams();
    params.append("topic", topic);
    url += `?${params.toString()}`;
  }
  const res = await fetch(url, {
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
 * Client-side estimated duration check (UX-only, fast rejection before upload).
 * Never sent to backend as authoritative value.
 */
export async function getVideoDurationInBrowser(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const timer = setTimeout(() => {
      window.URL.revokeObjectURL(video.src);
      resolve(null);
    }, 2500);

    video.onloadedmetadata = () => {
      clearTimeout(timer);
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration || null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      window.URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Captures a local canvas frame (~0.5s) for instant client UI feedback in composer.
 * This preview is NEVER uploaded to the server.
 */
export async function captureLocalVideoFrame(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const timer = setTimeout(() => {
      window.URL.revokeObjectURL(video.src);
      resolve(null);
    }, 3000);

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          window.URL.revokeObjectURL(video.src);
          resolve(dataUrl);
          return;
        }
      } catch {
        // Fallback gracefully on CORS/tainted canvas
      }
      window.URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      window.URL.revokeObjectURL(video.src);
      resolve(null);
    };
    video.src = URL.createObjectURL(file);
  });
}

export interface UploadMediaResult {
  mediaId: string;
  storagePath: string;
  thumbStoragePath: string | null;
  type: "video" | "image";
  url?: string;
}

/**
 * Uploads media directly to Supabase Storage via presigned upload URL,
 * then calls /api/media/confirm for server-authoritative ffprobe check & ffmpeg thumbnail generation.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (status: "uploading" | "processing" | "ready") => void,
): Promise<UploadMediaResult> {
  // Fast client UX check
  if (file.size > 52428800) {
    throw new Error("File exceeds 50MB limit. Please select a smaller media file.");
  }

  onProgress?.("uploading");

  // Step 1: Request presigned upload URL
  const initRes = await fetch(`${API_BASE}/api/media/upload-url`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const initData = await handleResponse(initRes);

  // Step 2: Direct storage upload to Supabase
  if (initData.signedUrl) {
    const uploadRes = await fetch(initData.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`Direct storage upload failed with status ${uploadRes.status}`);
    }
  }

  onProgress?.("processing");

  // Step 3: Server-authoritative confirmation (ffprobe duration + ffmpeg thumbnail)
  const confirmRes = await fetch(`${API_BASE}/api/media/confirm`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      mediaId: initData.mediaId,
      storagePath: initData.storagePath,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const confirmData = await handleResponse(confirmRes);
  onProgress?.("ready");

  const serverType: "video" | "image" =
    confirmData?.type === "VIDEO" || file.type.startsWith("video/")
      ? "video"
      : "image";

  return {
    mediaId: confirmData.mediaId || initData.mediaId,
    storagePath: confirmData.storagePath || initData.storagePath,
    thumbStoragePath: confirmData.thumbStoragePath || null,
    type: serverType,
  };
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

export const threadKeyCache: Record<string, CryptoKey> = {};

export function clearThreadKeyCache() {
  for (const k in threadKeyCache) {
    delete threadKeyCache[k];
  }
}

export async function sendChatMessage(
  threadId: string,
  body: string,
  recipientId: string,
  mediaUrl: string | null = null,
) {
  let aesKey = threadKeyCache[threadId];
  if (!aesKey) {
    const sender = getCurrentUser();
    if (!sender) throw new Error("User not authenticated.");

    const { getKeyRecord, importPublicKeyBase64, deriveSharedAesKey } =
      await import("./crypto");
    const record = await getKeyRecord(sender.id);
    if (!record) {
      throw new Error(
        "Secure chat keys missing locally. Reset your keys in the messaging side panel.",
      );
    }

    const recipientKeyData = await getUserPublicKey(recipientId);
    if (!recipientKeyData || !recipientKeyData.chatPublicKey) {
      throw new Error("Recipient has not set up secure chat keys yet.");
    }

    const recipientPubKey = await importPublicKeyBase64(
      recipientKeyData.chatPublicKey,
    );
    aesKey = await deriveSharedAesKey(record.privateKey, recipientPubKey);
    threadKeyCache[threadId] = aesKey;
  }

  const { encryptText } = await import("./crypto");
  const encrypted = await encryptText(body, aesKey);
  const ciphertextPayload = JSON.stringify({
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
  });

  const res = await fetch(`${API_BASE}/v1/chats/${threadId}/messages`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ body: ciphertextPayload, mediaUrl }),
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

/** @deprecated Use changePassphrase instead */
export async function updateSecurityKey(_newPassphrase: string) {
  return Promise.reject(
    new Error("updateSecurityKey is deprecated. Use changePassphrase."),
  );
}

export async function changePassphrase(
  currentPassphrase: string,
  newPassphrase: string,
) {
  const res = await fetch(`${API_BASE}/v1/auth/passphrase/change`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase, newPassphrase }),
  });
  const data = await handleResponse(res);
  // Update stored token since tokenVersion changed
  if (data.token) localStorage.setItem("veil_auth_token", data.token);
  return data;
}

export async function logoutAllDevices() {
  const res = await fetch(`${API_BASE}/v1/auth/logout-all`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  // Keep new token for current session
  if (data.token) localStorage.setItem("veil_auth_token", data.token);
  return data;
}

export async function redeemRecoveryCode(
  handle: string,
  recoveryCode: string,
  newPassphrase: string,
) {
  const res = await fetch(`${API_BASE}/v1/auth/recovery-codes/redeem`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ handle, recoveryCode, newPassphrase }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("veil_auth_token", data.token);
    localStorage.setItem("veil_user", JSON.stringify(data.user));
  }
  return data;
}

export async function regenerateRecoveryCodes(currentPassphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/recovery-codes/regenerate`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase }),
  });
  return handleResponse(res);
}

export async function deleteAccount(currentPassphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/account`, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase }),
  });
  const data = await handleResponse(res);
  logoutUser();
  return data;
}

/** TOTP API */
export async function getTotpStatus() {
  const res = await fetch(`${API_BASE}/v1/auth/mfa/totp/status`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function setupTotp() {
  const res = await fetch(`${API_BASE}/v1/auth/mfa/totp/setup`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function enableTotp(totpCode: string) {
  const res = await fetch(`${API_BASE}/v1/auth/mfa/totp/enable`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ totpCode }),
  });
  return handleResponse(res);
}

export async function disableTotp(currentPassphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/mfa/totp/disable`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase }),
  });
  return handleResponse(res);
}

/** Passkey API */
export async function getPasskeyRegisterOptions() {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys/register-options`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function verifyPasskeyRegistration(
  credential: unknown,
  nickname?: string,
) {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys/register-verify`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ credential, nickname }),
  });
  return handleResponse(res);
}

export async function getPasskeyLoginOptions() {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys/login-options`, {
    method: "POST",
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function verifyPasskeyLogin(
  credential: unknown,
  sessionToken: string,
) {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys/login-verify`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ credential, sessionToken }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("veil_auth_token", data.token);
    localStorage.setItem("veil_user", JSON.stringify(data.user));
  }
  return data;
}

export async function listPasskeys() {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function removePasskey(id: string, currentPassphrase: string) {
  const res = await fetch(`${API_BASE}/v1/auth/passkeys/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase }),
  });
  return handleResponse(res);
}

/** Current user profile (includes pendingDeletionAt) */
export async function getMe(): Promise<{
  id: string;
  handle: string;
  createdAt: string;
  pendingDeletionAt: string | null;
  chatPublicKey: string | null;
  chatPublicKeyAlgo: string | null;
}> {
  const res = await fetch(`${API_BASE}/v1/auth/me`, { headers: getHeaders() });
  return handleResponse(res);
}

/** Security Events */
export async function getSecurityEvents() {
  const res = await fetch(`${API_BASE}/v1/auth/security-events`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

/** Login with TOTP MFA step 2 */
export async function loginVerifyTotp(
  challengeToken: string,
  totpCode: string,
) {
  const res = await fetch(`${API_BASE}/v1/auth/login/totp`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ challengeToken, totpCode }),
  });
  const data = await handleResponse(res);
  if (data.token) {
    localStorage.setItem("veil_auth_token", data.token);
    localStorage.setItem("veil_user", JSON.stringify(data.user));
  }
  return data;
}

/** Chat key management */
export async function updateChatPublicKey(chatPublicKey: string) {
  const res = await fetch(`${API_BASE}/v1/auth/chat-public-key`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ chatPublicKey }),
  });
  return handleResponse(res);
}

export async function getUserPublicKey(userId: string): Promise<{
  id: string;
  chatPublicKey: string | null;
  chatPublicKeyAlgo: string | null;
}> {
  const res = await fetch(`${API_BASE}/v1/users/${userId}/chat-public-key`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export interface TrendingTopic {
  id: number;
  title: string;
  posts: string;
  gradient: string;
}

export interface WhoToFollowUser {
  name: string;
  handle: string;
  color: string;
}

export async function fetchTrendingTopics(): Promise<TrendingTopic[]> {
  const res = await fetch(`${API_BASE}/v1/posts/trending`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function fetchWhoToFollow(): Promise<WhoToFollowUser[]> {
  const res = await fetch(`${API_BASE}/v1/users/who-to-follow`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}
