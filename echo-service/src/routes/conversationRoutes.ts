import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getConversationsHandler,
  createConversationHandler,
  getConversationByIdHandler,
  updateConversationHandler,
  getMessagesHandler,
  getConversationMediaHandler,
  pinConversationHandler,
  muteConversationHandler,
  markConversationAsReadHandler,
  deleteConversationHandler,
  deleteSelectedMessagesHandler,
} from "../controllers/conversationController";
import { clearChatMessages } from "../controllers/messageController";
import {
  updateGroupSettings,
  promoteMember,
  demoteMember,
  removeMember,
  leaveGroup,
  generateInviteLink,
  getGroupByInviteToken,
  joinGroupByInviteToken,
  approveJoinRequest,
  rejectJoinRequest,
  deleteGroup,
} from "../controllers/groupController";

const router = Router();

// Protect all conversation routes
router.use(authMiddleware);

// Invite routes
router.get("/invite/:token", getGroupByInviteToken);
router.post("/invite/:token/join", joinGroupByInviteToken);

router.get("/", getConversationsHandler);
router.post("/", createConversationHandler);
router.get("/:id", getConversationByIdHandler);
router.patch("/:id", updateConversationHandler);
router.delete("/:id", deleteConversationHandler);
router.delete("/:id/delete-group", deleteGroup);
router.post("/:id/clear", clearChatMessages);
router.delete("/:id/messages", deleteSelectedMessagesHandler);
router.post("/:id/read", markConversationAsReadHandler);
router.get("/:id/messages", getMessagesHandler);
router.get("/:id/media", getConversationMediaHandler);
router.patch("/:id/pin", pinConversationHandler);
router.patch("/:id/mute", muteConversationHandler);

// Advanced Group Governance Routes
router.patch("/:id/settings", updateGroupSettings);
router.post("/:id/members/:targetUserId/promote", promoteMember);
router.post("/:id/members/:targetUserId/demote", demoteMember);
router.delete("/:id/members/:targetUserId", removeMember);
router.post("/:id/leave", leaveGroup);
router.post("/:id/invite-link/generate", generateInviteLink);
router.post("/:id/requests/:targetUserId/approve", approveJoinRequest);
router.post("/:id/requests/:targetUserId/reject", rejectJoinRequest);

export { router as conversationRoutes };
