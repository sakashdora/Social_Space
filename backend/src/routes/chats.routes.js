import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getChats,
  getChatMessages,
  startChat,
  sendChatMessage,
  updateChatTimer
} from "../controllers/chats.controller.js";

const router = Router();

// Secure all endpoints with authentication
router.use(requireAuth);

router.get("/", getChats);
router.post("/", startChat);
router.get("/:threadId", getChatMessages);
router.post("/:threadId/messages", sendChatMessage);
router.patch("/:threadId/timer", updateChatTimer);

export default router;
