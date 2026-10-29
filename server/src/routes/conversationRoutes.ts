import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getConversationsHandler,
  createConversationHandler,
  getConversationByIdHandler,
  updateConversationHandler,
  getMessagesHandler,
} from "../controllers/conversationController";

const router = Router();

// Protect all conversation routes
router.use(authMiddleware);

router.get("/", getConversationsHandler);
router.post("/", createConversationHandler);
router.get("/:id", getConversationByIdHandler);
router.patch("/:id", updateConversationHandler);
router.get("/:id/messages", getMessagesHandler);

export { router as conversationRoutes };
