import { Router } from "express";
import express from "express";
import User from "../models/User";
import { ENV } from "../config/env";

const router = Router();

// Middleware to parse raw body specifically for this route
router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const SIGNING_SECRET = ENV.CLERK_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_SECRET;
    if (!SIGNING_SECRET) {
      console.error("Missing CLERK_WEBHOOK_SECRET");
      return res.status(500).json({ success: false, message: "Missing CLERK_WEBHOOK_SECRET" });
    }

    const payload = req.body.toString();
    const headers = req.headers;

    let evt: any;

    try {
      const { Webhook } = await import("svix");
      const wh = new Webhook(SIGNING_SECRET);
      evt = wh.verify(payload, headers as any);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const { id } = evt.data;
    const eventType = evt.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const email = evt.data.email_addresses?.[0]?.email_address || "";
      const username =
        evt.data.username ||
        evt.data.first_name ||
        (email ? email.split("@")[0] : `user_${id.slice(-6)}`);
      const avatarUrl = evt.data.image_url || "";

      await User.findOneAndUpdate(
        { clerkId: id },
        {
          $set: {
            clerkId: id,
            email: email.toLowerCase(),
            username,
            avatarUrl,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else if (eventType === "user.deleted") {
      await User.findOneAndDelete({ clerkId: id });
    }

    res.status(200).json({ success: true });
  }
);

export { router as webhookRoutes };
