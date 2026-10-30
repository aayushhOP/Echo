import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { ENV } from "../config/env";

// Ensure local uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer memory or disk storage. Using disk storage with a 10MB limit.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, pdf, zip, docx, txt, etc.
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "audio/mpeg",
      "audio/webm",
      "video/mp4",
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new AppError("Unsupported file type", 400));
    }
  },
});

// Configure cloudinary if URL is present
if (ENV.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: ENV.CLOUDINARY_URL,
  });
}

export const uploadFile = async (
  req: Request,
  file: Express.Multer.File
): Promise<{
  url: string;
  fileName: string;
  fileSize: number;
  mimetype: string;
  type: "image" | "file";
}> => {
  const isImage = file.mimetype.startsWith("image/");
  const fileType: "image" | "file" = isImage ? "image" : "file";

  // If Cloudinary is configured, upload to Cloudinary
  if (ENV.CLOUDINARY_URL) {
    try {
      const uploadResult = await cloudinary.uploader.upload(file.path, {
        resource_type: "auto",
        folder: "echo-uploads",
        use_filename: true,
      });

      // Remove local temporary file
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        // ignore unlink error
      }

      return {
        url: uploadResult.secure_url,
        fileName: file.originalname,
        fileSize: file.size,
        mimetype: file.mimetype,
        type: fileType,
      };
    } catch (err: any) {
      console.error("[Cloudinary Upload Error]:", err);
      // Fallback to serving locally if cloudinary fails
    }
  }

  // Fallback: Local file serving
  const protocol = req.protocol;
  const host = req.get("host");
  const localUrl = `${protocol}://${host}/uploads/${file.filename}`;

  return {
    url: localUrl,
    fileName: file.originalname,
    fileSize: file.size,
    mimetype: file.mimetype,
    type: fileType,
  };
};
