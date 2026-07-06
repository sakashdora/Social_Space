import prisma from "../config/prisma.js";

/**
 * List all active 1:1 chat rooms the user belongs to.
 * GET /v1/chats
 */
export async function getChats(req, res) {
  try {
    const participantRooms = await prisma.threadParticipant.findMany({
      where: { userId: req.user.id },
      select: { threadId: true }
    });
    
    const roomIds = participantRooms.map((r) => r.threadId);
    
    const threads = await prisma.thread.findMany({
      where: { id: { in: roomIds } },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                avatarUrl: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const formatted = threads.map((t) => {
      const otherParticipant = t.participants.find((p) => p.userId !== req.user.id)?.user || { handle: "unknown", avatarUrl: null };
      const lastMsg = t.messages[0];
      
      // Dynamic color code based on the username
      const hash = otherParticipant.handle.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const color = "#" + Math.floor((Math.abs(hash * 48271) % 16777215)).toString(16).padStart(6, "0");
      
      // friendly timer representation
      let timerLabel = "Off";
      if (t.deleteAfterSeconds) {
        if (t.deleteAfterSeconds >= 86400) {
          timerLabel = `${Math.round(t.deleteAfterSeconds / 86400)}d`;
        } else if (t.deleteAfterSeconds >= 3600) {
          timerLabel = `${Math.round(t.deleteAfterSeconds / 3600)}h`;
        } else {
          timerLabel = `${Math.round(t.deleteAfterSeconds / 60)}m`;
        }
      }

      return {
        id: t.id,
        handle: otherParticipant.handle,
        avatarUrl: otherParticipant.avatarUrl,
        color,
        time: lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "New",
        preview: lastMsg ? lastMsg.body : "No messages yet",
        disappearing: timerLabel,
        deleteAfterSeconds: t.deleteAfterSeconds,
        unread: 0
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("Fetch chats error:", error);
    return res.status(500).json({ error: "Failed to load chats." });
  }
}

/**
 * Get message history in an active thread.
 * GET /v1/chats/:threadId
 */
export async function getChatMessages(req, res) {
  try {
    const threadId = req.params.threadId;

    // Check if participant
    const isParticipant = await prisma.threadParticipant.findFirst({
      where: { threadId, userId: req.user.id }
    });
    if (!isParticipant) {
      return res.status(403).json({ error: "Access denied. You are not a participant in this conversation." });
    }

    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" }
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      body: m.body,
      mediaUrl: m.mediaUrl,
      mine: m.senderId === req.user.id,
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("Fetch chat messages error:", error);
    return res.status(500).json({ error: "Failed to load chat history." });
  }
}

/**
 * Create/Start a conversation thread.
 * POST /v1/chats
 */
export async function startChat(req, res) {
  try {
    const { targetHandle } = req.body;
    if (!targetHandle) {
      return res.status(400).json({ error: "Recipient username handle is required." });
    }

    const targetUser = await prisma.user.findUnique({
      where: { handle: targetHandle.trim().toLowerCase() }
    });
    if (!targetUser) {
      return res.status(404).json({ error: `User @${targetHandle} does not exist.` });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: "You cannot message yourself." });
    }

    // Check if 1:1 room already exists
    const existing = await prisma.thread.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.user.id } } },
          { participants: { some: { userId: targetUser.id } } }
        ]
      },
      include: {
        participants: true
      }
    });

    // Make sure it is strictly a 1:1 room
    const matchingThread = existing?.participants.length === 2 ? existing : null;

    if (matchingThread) {
      return res.status(200).json({ threadId: matchingThread.id });
    }

    // Create room
    const newThread = await prisma.thread.create({
      data: {
        participants: {
          create: [
            { userId: req.user.id },
            { userId: targetUser.id }
          ]
        }
      }
    });

    return res.status(201).json({ threadId: newThread.id });
  } catch (error) {
    console.error("Start chat error:", error);
    return res.status(500).json({ error: "Failed to open conversation." });
  }
}

/**
 * Send a chat message.
 * POST /v1/chats/:threadId/messages
 */
export async function sendChatMessage(req, res) {
  try {
    const threadId = req.params.threadId;
    const { body, mediaUrl } = req.body;

    if (!body && !mediaUrl) {
      return res.status(400).json({ error: "Message content or attachment is required." });
    }

    // Confirm participant
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
      include: {
        participants: true
      }
    });

    if (!thread) {
      return res.status(404).json({ error: "Chat thread not found." });
    }

    const isPart = thread.participants.some((p) => p.userId === req.user.id);
    if (!isPart) {
      return res.status(403).json({ error: "Access denied." });
    }

    // Calculate strict expiration bounds
    const expiresAt = new Date(Date.now() + thread.deleteAfterSeconds * 1000);

    const message = await prisma.message.create({
      data: {
        threadId,
        senderId: req.user.id,
        body: body || "",
        mediaUrl: mediaUrl || null,
        expiresAt
      }
    });

    return res.status(201).json({
      id: message.id,
      body: message.body,
      mediaUrl: message.mediaUrl,
      mine: true,
      time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
  } catch (error) {
    console.error("Send message error:", error);
    return res.status(500).json({ error: "Failed to send message." });
  }
}

/**
 * Configure dynamic thread-level auto-delete timer.
 * PATCH /v1/chats/:threadId/timer
 */
export async function updateChatTimer(req, res) {
  try {
    const threadId = req.params.threadId;
    const { seconds } = req.body;

    if (typeof seconds !== "number" || seconds <= 0) {
      return res.status(400).json({ error: "Expiration limit must be a positive integer in seconds." });
    }

    // Deletion cap: 7 days = 604800 seconds
    if (seconds > 604800) {
      return res.status(400).json({ error: "Timer cannot exceed the maximum 7-day policy limit (604,800 seconds)." });
    }

    // Confirm participant
    const isParticipant = await prisma.threadParticipant.findFirst({
      where: { threadId, userId: req.user.id }
    });
    if (!isParticipant) {
      return res.status(403).json({ error: "Access denied." });
    }

    await prisma.thread.update({
      where: { id: threadId },
      data: { deleteAfterSeconds: seconds }
    });

    return res.status(200).json({ message: "Retention timer updated successfully." });
  } catch (error) {
    console.error("Update chat timer error:", error);
    return res.status(500).json({ error: "Failed to configure message deletion settings." });
  }
}
