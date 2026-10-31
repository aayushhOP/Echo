import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getMeHandler,
  updateMeHandler,
  updatePreferencesHandler,
  searchUsersHandler,
  getOnlineUsersHandler,
  blockUserHandler,
  unblockUserHandler,
  getBlockedUsersHandler,
} from "../controllers/userController";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/me", getMeHandler);
router.get("/online", getOnlineUsersHandler);
router.get("/blocked", getBlockedUsersHandler);
router.post("/block", blockUserHandler);
router.post("/unblock", unblockUserHandler);
router.patch("/me", updateMeHandler);
router.patch("/me/preferences", updatePreferencesHandler);
router.get("/search", searchUsersHandler);

export { router as userRoutes };
