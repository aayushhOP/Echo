import dotenv from "dotenv";

dotenv.config();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://echo-sable-seven.vercel.app",
];

if (process.env.CLIENT_ORIGIN) {
  // Support comma-separated origins or single origin
  process.env.CLIENT_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .forEach((origin) => {
      if (!allowedOrigins.includes(origin)) {
        allowedOrigins.push(origin);
      }
    });
}

export const ENV = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatapp",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || "",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
  CLOUDINARY_URL: process.env.CLOUDINARY_URL || "",
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  ALLOWED_ORIGINS: allowedOrigins,
  NODE_ENV: process.env.NODE_ENV || "development",
};
