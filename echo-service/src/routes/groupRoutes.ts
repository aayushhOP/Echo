import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
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
} from "../controllers/groupController";

const router = Router();

router.use(authMiddleware);

// Invite routes
router.get("/invite/:token", getGroupByInviteToken);
router.post("/invite/:token/join", joinGroupByInviteToken);

// Group admin endpoints matching /api/groups/:id/...
router.patch("/:id/settings", updateGroupSettings);
router.post("/:id/members/:targetUserId/promote", promoteMember);
router.post("/:id/members/:targetUserId/demote", demoteMember);
router.delete("/:id/members/:targetUserId", removeMember);
router.post("/:id/leave", leaveGroup);
router.post("/:id/invite-link/generate", generateInviteLink);
router.post("/:id/requests/:targetUserId/approve", approveJoinRequest);
router.post("/:id/requests/:targetUserId/reject", rejectJoinRequest);

export { router as groupRoutes };
