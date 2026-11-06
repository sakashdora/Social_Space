export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const resolveMediaUrl = (url?: string | null) =>
  url?.startsWith("/") ? `${API_BASE}${url}` : url || null;

export interface SentimentAnalysis {
  sentiment: string;
  score: number;
}

export type MediaKind = "image" | "video" | "audio" | "unknown";

export interface ApiPost {
  canDelete?: boolean;
  audience?: string;
  expiresAt?: string | null;
  allowReplies?: boolean;
  allowReactions?: boolean;
  allowReposts?: boolean;
  anonymousReplies?: boolean;
  pollOptions?: { text: string; votes: number }[];
  votedOption?: number | null;
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
    type: "IMAGE" | "VIDEO" | "AUDIO";
    thumbnailPath: string | null;
  } | null;
  reactionCount?: number;
  commentCount?: number;
  isAiModifiedMedia?: boolean;
  sharedPost?: {
    id: string;
    content: string;
    category: string;
    mediaStreamUrl?: string | null;
    thumbStreamUrl?: string | null;
    createdAt: string;
    user?: {
      id: string;
      handle: string;
      avatarUrl: string | null;
    } | null;
  } | null;
}

/**
 * Authoritatively classify a media URL as image/video when possible.
 */
export function detectMediaType(url?: string | null): MediaKind {
  if (!url) return "unknown";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:image/")) return "image";
  if (url.includes("/api/media/stream") && url.includes("thumb=true"))
    return "image";

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
  isModerator?: boolean;
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

export function mapApiPostToUiPost(p: ApiPost & { userHasReacted?: boolean }) {
  const author = p.user ? p.user.handle : "anonymous";
  const handle = p.user ? `@${p.user.handle}` : "@anonymous";
  const color = p.user ? stringToColor(p.user.handle) : "#555555"; // Dark gray for fully anonymous

  const streamUrl = resolveMediaUrl(
    p.mediaStreamUrl ||
      (p.mediaUrl?.startsWith("/api/media/stream") ? p.mediaUrl : null),
  );
  const isVideoMedia = p.media?.type === "VIDEO" || p.category === "Video";

  return {
    id: p.id,
    author,
    canDelete: p.canDelete ?? false,
    audience: p.audience,
    expiresAt: p.expiresAt,
    allowReplies: p.allowReplies ?? true,
    allowReactions: p.allowReactions ?? true,
    allowReposts: p.allowReposts ?? true,
    anonymousReplies: p.anonymousReplies ?? false,
    pollOptions: p.pollOptions ?? [],
    votedOption: p.votedOption ?? null,
    color,
    handle,
    topic: p.category,
    time: formatRelativeTime(p.createdAt),
    body: p.content,
    media: streamUrl || p.mediaUrl ? "portrait" : null,
    mediaUrl: streamUrl || p.mediaUrl || null,
    mediaStreamUrl: streamUrl || null,
    thumbStreamUrl: resolveMediaUrl(p.thumbStreamUrl),
    mediaType:
      p.media?.type === "AUDIO"
        ? "audio"
        : isVideoMedia
          ? "video"
          : p.media?.type === "IMAGE"
            ? "image"
            : detectMediaType(p.mediaUrl),
    sentimentAnalysis: p.sentimentAnalysis
      ? typeof p.sentimentAnalysis === "string"
        ? JSON.parse(p.sentimentAnalysis)
        : p.sentimentAnalysis
      : null,
    synthetic: p.isAiModifiedMedia || false,
    reactions: p.reactionCount || 0,
    replies: p.commentCount || 0,
    userHasReacted: p.userHasReacted ?? false,
    sharedPostId: p.sharedPostId || null,
    sharedPost: p.sharedPost
      ? {
          id: p.sharedPost.id,
          author: p.sharedPost.user ? p.sharedPost.user.handle : "anonymous",
          handle: p.sharedPost.user
            ? `@${p.sharedPost.user.handle}`
            : "@anonymous",
          topic: p.sharedPost.category,
          time: formatRelativeTime(p.sharedPost.createdAt),
          body: p.sharedPost.content,
          mediaUrl: resolveMediaUrl(p.sharedPost.mediaStreamUrl),
        }
      : null,
  };
}

// Helper to get auth header
export function getHeaders(
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
export async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg =
      errorData.message ||
      (typeof errorData.error === "string"
        ? errorData.error
        : errorData.error?.message) ||
      `HTTP error! status: ${response.status}`;
    throw new Error(msg);
  }
  return response.json();
}

export function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("veil-auth-change"));
  }
}

export function setAuthSession(token: string, user?: any) {
  if (typeof window === "undefined") return;
  clearThreadKeyCache();
  localStorage.setItem("veil_auth_token", token);
  if (user) {
    localStorage.setItem("veil_user", JSON.stringify(user));
  }
  notifyAuthChange();
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
    setAuthSession(data.token, data.user);
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
    setAuthSession(data.token, data.user);
  }
  return data;
}

/**
 * Log out user by clearing storage.
 */
export function logoutUser() {
  if (typeof window === "undefined") return;
  clearThreadKeyCache();
  localStorage.removeItem("veil_auth_token");
  localStorage.removeItem("veil_user");
  notifyAuthChange();
}

/**
 * Get current authenticated user details.
 */
export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const user = localStorage.getItem("veil_user");
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
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
export async function fetchFeed(
  category?: string,
  page?: number,
  filters?: {
    handle?: string;
    userId?: string;
    hasMedia?: boolean;
    mine?: boolean;
  },
) {
  let url = `${API_BASE}/v1/posts`;
  const params = new URLSearchParams();
  if (category && category !== "All") {
    params.append("category", category);
  }
  if (page) {
    params.append("page", page.toString());
  }
  if (filters?.handle) {
    params.append("handle", filters.handle);
  }
  if (filters?.userId) {
    params.append("userId", filters.userId);
  }
  if (filters?.hasMedia) {
    params.append("hasMedia", "true");
  }
  if (filters?.mine) params.append("mine", "true");
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
  const comments = await handleResponse(
    await fetch(`${API_BASE}/v1/posts/${postId}/comments`, {
      headers: getHeaders(),
    }),
  );
  return {
    ...mapApiPostToUiPost(post),
    comments,
  };
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
  sharedPostId?: string | null,
  options: {
    audience?: string;
    lifetime?: string;
    selectedHandles?: string[];
    engagement?: Record<string, boolean>;
    pollOptions?: string[];
    isAiModifiedMedia?: boolean;
  } = {},
) {
  let bodyPayload: Record<string, any> = {
    content,
    category,
    mode,
    ...options,
  };
  if (sharedPostId) {
    bodyPayload.sharedPostId = sharedPostId;
  }
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
 * Repost an existing transmission.
 */
export async function repostPost(postId: string, comment?: string) {
  return createPost(
    comment && comment.trim().length > 0
      ? comment.trim()
      : "Transmitted via Repost",
    "General",
    "pseudo",
    null,
    postId,
  );
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
export async function getVideoDurationInBrowser(
  file: File,
): Promise<number | null> {
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
export async function captureLocalVideoFrame(
  file: File,
): Promise<string | null> {
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
  storagePath?: string;
  thumbStoragePath?: string | null;
  type: MediaKind;
  url?: string;
}

/**
 * Uploads media through a short-lived, single-purpose upload URL issued by the API,
 * then calls /api/media/confirm, which verifies the real file format and duration on the server.
 */
export async function uploadMedia(
  file: File,
  onProgress?: (status: "uploading" | "processing" | "ready") => void,
  options: { purpose?: "post" | "chat"; threadId?: string } = {},
): Promise<UploadMediaResult> {
  // Fast client UX check
  if (file.size > 52428800) {
    throw new Error(
      "File exceeds 50MB limit. Please select a smaller media file.",
    );
  }

  onProgress?.("uploading");

  // Step 1: Request presigned upload URL
  const initRes = await fetch(`${API_BASE}/api/media/upload-url`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      ...options,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const initData = await handleResponse(initRes);

  // Step 2: Upload the raw bytes to the API-issued upload URL
  if (!initData.signedUrl) throw new Error("Storage upload is unavailable.");
  if (initData.signedUrl) {
    const uploadRes = await fetch(initData.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(
        `Direct storage upload failed with status ${uploadRes.status}`,
      );
    }
  }

  onProgress?.("processing");

  // Step 3: Server-authoritative confirmation (format and duration checks)
  const confirmRes = await fetch(`${API_BASE}/api/media/confirm`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      mediaId: initData.mediaId,
    }),
  });
  const confirmData = await handleResponse(confirmRes);
  onProgress?.("ready");

  const serverType: MediaKind =
    confirmData?.type === "AUDIO"
      ? "audio"
      : confirmData?.type === "FILE"
        ? "unknown"
        : confirmData?.type === "VIDEO" || file.type.startsWith("video/")
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

export interface ChatAttachment {
  mediaId: string;
  key: string;
  iv: string;
  mimeType: string;
  name: string;
  previewUrl?: string;
}

export async function fetchChatMessages(
  threadId: string,
  cursor?: { before?: string; after?: string },
) {
  const params = new URLSearchParams(
    cursor as Record<string, string> | undefined,
  );
  return handleResponse(
    await fetch(`${API_BASE}/v1/chats/${threadId}?${params}`, {
      headers: getHeaders(),
    }),
  );
}

export async function createChat(targetHandle: string) {
  return handleResponse(
    await fetch(`${API_BASE}/v1/chats`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ targetHandle }),
    }),
  );
}

export const threadKeyCache: Record<string, CryptoKey> = {};
export function clearThreadKeyCache() {
  for (const key of Object.keys(threadKeyCache)) delete threadKeyCache[key];
}

export async function uploadChatAttachment(
  file: File,
  threadId: string,
): Promise<ChatAttachment> {
  if (
    !/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|audio\/(webm|ogg|mp4))$/.test(
      file.type,
    )
  )
    throw new Error("Choose a supported image, video or audio file.");
  if (file.size > 50 * 1024 * 1024 - 16)
    throw new Error("Attachment exceeds 50 MB.");
  const { encryptAttachment } = await import("./crypto");
  const encrypted = await encryptAttachment(await file.arrayBuffer());
  const uploaded = await uploadMedia(
    new File([encrypted.bytes], "attachment.bin", {
      type: "application/octet-stream",
    }),
    undefined,
    { purpose: "chat", threadId },
  );
  return {
    mediaId: uploaded.mediaId,
    key: encrypted.key,
    iv: encrypted.iv,
    mimeType: file.type,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

export async function sendChatMessage(
  threadId: string,
  body: string,
  recipientId: string,
  attachment: ChatAttachment | null = null,
) {
  if (body.length > 5000)
    throw new Error("Messages are limited to 5,000 characters.");
  const sender = getCurrentUser();
  if (!sender) throw new Error("Sign in to send a message.");
  const {
    getKeyRecord,
    importPublicKeyBase64,
    deriveSharedAesKey,
    encryptText,
  } = await import("./crypto");
  const record = await getKeyRecord(sender.id);
  if (!record)
    throw new Error(
      "Chat keys are missing on this device. Open Messages to set them up.",
    );
  const recipient = await getUserPublicKey(recipientId);
  if (!recipient?.chatPublicKey)
    throw new Error("The recipient has not set up chat keys yet.");
  const senderKey = record.publicKeyBase64,
    recipientKey = recipient.chatPublicKey;
  const cacheKey = [sender.id, threadId, senderKey, recipientKey].join(":");
  const aesKey = (threadKeyCache[cacheKey] ||= await deriveSharedAesKey(
    record.privateKey,
    await importPublicKeyBase64(recipientKey),
  ));
  const attachmentData = attachment
    ? {
        mediaId: attachment.mediaId,
        key: attachment.key,
        iv: attachment.iv,
        mimeType: attachment.mimeType,
        name: attachment.name,
      }
    : null;
  const encrypted = await encryptText(
    JSON.stringify({ text: body, attachment: attachmentData }),
    aesKey,
    [threadId, senderKey, recipientKey].join("|"),
  );
  const envelope = { v: 2, ...encrypted, senderKey, recipientKey };
  return handleResponse(
    await fetch(`${API_BASE}/v1/chats/${threadId}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        body: JSON.stringify(envelope),
        mediaId: attachment?.mediaId || null,
      }),
    }),
  );
}

export async function decryptChatMessage(
  threadId: string,
  message: any,
  recipientId: string,
) {
  if (message.sending) return message;
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in to read messages.");
  const {
    getKeyRecord,
    importPublicKeyBase64,
    deriveSharedAesKey,
    decryptText,
  } = await import("./crypto");
  const envelope = JSON.parse(message.body);
  const ownPublicKey =
    envelope.v === 2
      ? message.mine
        ? envelope.senderKey
        : envelope.recipientKey
      : undefined;
  const peerPublicKey =
    envelope.v === 2
      ? message.mine
        ? envelope.recipientKey
        : envelope.senderKey
      : (await getUserPublicKey(recipientId)).chatPublicKey;
  const record = await getKeyRecord(user.id, ownPublicKey);
  if (!record || !peerPublicKey)
    throw new Error("The key for this message is unavailable on this device.");
  const cacheKey = [
    user.id,
    threadId,
    record.publicKeyBase64,
    peerPublicKey,
  ].join(":");
  const key = (threadKeyCache[cacheKey] ||= await deriveSharedAesKey(
    record.privateKey,
    await importPublicKeyBase64(peerPublicKey),
  ));
  const plaintext = await decryptText(
    envelope.ciphertext,
    envelope.iv,
    key,
    envelope.v === 2
      ? [threadId, envelope.senderKey, envelope.recipientKey].join("|")
      : undefined,
  );
  if (envelope.v !== 2) return { ...message, body: plaintext };
  const content = JSON.parse(plaintext);
  return {
    ...message,
    body: content.text || "",
    attachment:
      content.attachment?.mediaId === message.mediaId
        ? content.attachment
        : null,
  };
}

export async function downloadChatAttachment(attachment: ChatAttachment) {
  const ticket = await handleResponse(
    await fetch(`${API_BASE}/api/media/attachments/${attachment.mediaId}`, {
      headers: getHeaders(),
    }),
  );
  const response = await fetch(ticket.url);
  if (!response.ok) throw new Error("Attachment is unavailable.");
  const { decryptAttachment } = await import("./crypto");
  const bytes = await decryptAttachment(
    await response.arrayBuffer(),
    attachment.key,
    attachment.iv,
  );
  return URL.createObjectURL(new Blob([bytes], { type: attachment.mimeType }));
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
  if (data.token) setAuthSession(data.token);
  return data;
}

export async function logoutAllDevices() {
  const res = await fetch(`${API_BASE}/v1/auth/logout-all`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await handleResponse(res);
  // Keep new token for current session
  if (data.token) setAuthSession(data.token);
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
    setAuthSession(data.token, data.user);
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
  const userId = getCurrentUser()?.id;
  const res = await fetch(`${API_BASE}/v1/auth/account`, {
    method: "DELETE",
    headers: getHeaders(),
    body: JSON.stringify({ currentPassphrase }),
  });
  const data = await handleResponse(res);
  logoutUser();
  if (userId) {
    const { deletePrivateKey } = await import("./crypto");
    await deletePrivateKey(userId).catch(() => undefined);
    localStorage.removeItem(`veil_bookmarks_${userId}`);
  }
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
    setAuthSession(data.token, data.user);
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
  isModerator: boolean;
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
    setAuthSession(data.token, data.user);
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
  following: boolean;
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

export async function communityRequest(
  path: string,
  data?: unknown,
  method = "POST",
) {
  return handleResponse(
    await fetch(`${API_BASE}/v1/community/${path}`, {
      method: data === undefined ? "GET" : method,
      headers: getHeaders(),
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
  );
}
export async function followUser(handle: string, following: boolean) {
  return handleResponse(
    await fetch(
      `${API_BASE}/v1/users/${encodeURIComponent(handle.replace(/^@/, ""))}/follow`,
      { method: following ? "PUT" : "DELETE", headers: getHeaders() },
    ),
  );
}
export async function voteOnPoll(postId: string, optionIndex: number) {
  return handleResponse(
    await fetch(`${API_BASE}/v1/posts/${postId}/vote`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ optionIndex }),
    }),
  );
}
