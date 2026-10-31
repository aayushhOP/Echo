import dotenv from "dotenv";

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  CLOUDINARY_URL: process.env.CLOUDINARY_URL || "",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  NODE_ENV: process.env.NODE_ENV || "development",
};
