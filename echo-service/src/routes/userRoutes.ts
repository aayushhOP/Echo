import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getMeHandler,
  updateMeHandler,
  searchUsersHandler,
} from "../controllers/userController";

const router = Router();

// Protect all user routes
router.use(authMiddleware);

router.get("/me", getMeHandler);
router.patch("/me", updateMeHandler);
router.get("/search", searchUsersHandler);

export { router as userRoutes };
