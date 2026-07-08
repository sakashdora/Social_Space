import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  getChats,
  getChatMessages,
  startChat,
  sendChatMessage,
  updateChatTimer
} from "../controllers/chats.controller.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  startChatSchema,
  sendChatMessageSchema,
  updateChatTimerSchema
} from "../schemas/chats.schema.js";

const router = Router();

// Secure all endpoints with authentication
router.use(requireAuth);

router.get("/", getChats);
router.post("/", validateBody(startChatSchema), startChat);
router.get("/:threadId", getChatMessages);
router.post("/:threadId/messages", validateBody(sendChatMessageSchema), sendChatMessage);
router.patch("/:threadId/timer", validateBody(updateChatTimerSchema), updateChatTimer);

export default router;
