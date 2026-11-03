import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { avatarUploadMiddleware } from "../middlewares/avatarUpload";
import {
  getMeHandler,
  updateMeHandler,
  updatePreferencesHandler,
  searchUsersHandler,
  getOnlineUsersHandler,
  blockUserHandler,
  unblockUserHandler,
  getBlockedUsersHandler,
  updateAvatarHandler,
  updateProfileDetailsHandler,
} from "../controllers/userController";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/me", getMeHandler);
router.get("/online", getOnlineUsersHandler);
router.get("/blocked", getBlockedUsersHandler);
router.get("/privacy/blocked-contacts", getBlockedUsersHandler);
router.post("/block", blockUserHandler);
router.post("/unblock", unblockUserHandler);
router.patch("/me", updateMeHandler);
router.patch("/me/preferences", updatePreferencesHandler);
router.post("/profile/avatar", avatarUploadMiddleware, updateAvatarHandler);
router.patch("/profile/details", updateProfileDetailsHandler);
router.get("/search", searchUsersHandler);

export { router as userRoutes };
