import { Router } from "express";
import { audioUploadMiddleware, handleVoiceUpload } from "../controllers/mediaController";

const router = Router();

router.post("/voice-note", audioUploadMiddleware, handleVoiceUpload);

export { router as mediaRoutes };
export default router;
