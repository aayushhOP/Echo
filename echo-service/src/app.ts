import express, { Application } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import { ENV } from "./config/env";
import { healthRoutes } from "./routes/healthRoutes";
import { webhookRoutes } from "./routes/webhookRoutes";
import { userRoutes } from "./routes/userRoutes";
import { conversationRoutes } from "./routes/conversationRoutes";
import { messageRoutes } from "./routes/messageRoutes";
import { errorHandler } from "./middlewares/errorHandler";

export const createApp = (): Application => {
  const app = express();

  // Trust reverse proxy (Render, Heroku, etc.) for secure cookie handling
  app.set("trust proxy", 1);

  // Security & CORS (Must be before health routes so CORS headers are attached)
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (ENV.ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    })
  );

  // Health check endpoints (ultra-fast, mounted BEFORE parsers, auth middlewares & rate limiters)
  app.use("/api/health", healthRoutes);
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "healthy", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // 1. Webhooks MUST be registered BEFORE standard body parsers
  app.use("/api/webhooks", webhookRoutes);

  // 2. Standard parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // 3. Mount Clerk Middleware globally (hydrates req.auth)
  app.use(clerkMiddleware());

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  if (ENV.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // API Routes
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
