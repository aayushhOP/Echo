import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { uploadMiddleware } from "../services/uploadService";
import {
  uploadMessageHandler,
  deleteForEveryone,
  deleteForMe,
  undoDeleteForMe,
  clearChatMessages,
  getConversationMessagesHandler,
} from "../controllers/messageController";

const router = Router();

// Protect message routes
router.use(authMiddleware);

// POST /api/messages/upload
router.post("/upload", uploadMiddleware.single("file"), uploadMessageHandler);

// WhatsApp message deletion routes
router.get("/conversations/:id/messages", getConversationMessagesHandler);
router.post("/conversations/:id/clear", clearChatMessages);
router.patch("/:id/delete-for-everyone", deleteForEveryone);
router.patch("/:id/delete-for-me", deleteForMe);
router.post("/:id/undo-delete-for-me", undoDeleteForMe);

export { router as messageRoutes };
