import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getMeHandler,
  updateMeHandler,
  updatePreferencesHandler,
  searchUsersHandler,
  getOnlineUsersHandler,
} from "../controllers/userController";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/me", getMeHandler);
router.get("/online", getOnlineUsersHandler);
router.patch("/me", updateMeHandler);
router.patch("/me/preferences", updatePreferencesHandler);
router.get("/search", searchUsersHandler);

export { router as userRoutes };
