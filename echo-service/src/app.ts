import express, { Application } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { ENV } from "./config/env";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";
import { conversationRoutes } from "./routes/conversationRoutes";
import { messageRoutes } from "./routes/messageRoutes";
import { errorHandler } from "./middlewares/errorHandler";

export const createApp = (): Application => {
  const app = express();

  // Trust reverse proxy (Render, Heroku, etc.) for secure cookie handling
  app.set("trust proxy", 1);

  // Security & Utility Middlewares
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: ENV.CLIENT_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  if (ENV.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // Health check route
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageRoutes);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
