import { Router } from "express";
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
  meHandler,
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { authRateLimiter } from "../middlewares/rateLimiter";

const router = Router();

router.post("/register", authRateLimiter, registerHandler);
router.post("/login", authRateLimiter, loginHandler);
router.post("/refresh", refreshHandler);
router.post("/logout", authMiddleware, logoutHandler);
router.get("/me", authMiddleware, meHandler);

export { router as authRoutes };
