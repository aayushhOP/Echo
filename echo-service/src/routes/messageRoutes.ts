import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { uploadMiddleware } from "../services/uploadService";
import { uploadMessageHandler } from "../controllers/messageController";

const router = Router();

// Protect message routes
router.use(authMiddleware);

// POST /api/messages/upload
router.post("/upload", uploadMiddleware.single("file"), uploadMessageHandler);

export { router as messageRoutes };
