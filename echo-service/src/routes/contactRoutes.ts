import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  getSavedContacts,
  saveContact,
  deleteContact,
} from "../controllers/contactController";

const router = Router();

router.use(authMiddleware);

router.get("/", getSavedContacts);
router.post("/", saveContact);
router.delete("/:contactUserId", deleteContact);

export { router as contactRoutes };
