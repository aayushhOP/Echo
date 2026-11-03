import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import { ENV } from "../config/env";

// Ensure local storage directory exists
const uploadDir = path.join(process.cwd(), "uploads", "voice-notes");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = file.mimetype.includes("mp4") ? ".m4a" : ".webm";
    cb(null, `voice-${uniqueSuffix}${ext}`);
  },
});

export const audioUploadMiddleware = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
}).single("audio");

export const handleVoiceUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No audio file uploaded" });
    }

    const { duration, waveform } = req.body;

    let parsedWaveform: number[] = [];
    if (waveform) {
      if (typeof waveform === "string") {
        try {
          parsedWaveform = JSON.parse(waveform);
        } catch {
          parsedWaveform = [];
        }
      } else if (Array.isArray(waveform)) {
        parsedWaveform = waveform;
      }
    }

    const parsedDuration = duration ? parseFloat(duration) : 0;

    let fileUrl: string;

    // If Cloudinary is configured (production or cloud environment)
    if (ENV.CLOUDINARY_URL) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video", // Cloudinary processes audio under the video resource_type
          folder: "echo-voice-notes",
        });

        fileUrl = uploadResult.secure_url;

        // Clean up local temp file
        try {
          fs.unlinkSync(req.file.path);
        } catch {}
      } catch (cloudErr) {
        console.error("[Cloudinary Audio Upload Error]:", cloudErr);
        // Fallback to local URL if Cloudinary fails
        const protocol = req.protocol;
        const host = req.get("host");
        fileUrl = `${protocol}://${host}/uploads/voice-notes/${req.file.filename}`;
      }
    } else {
      // Local URL with protocol & host so it works anywhere
      const protocol = req.protocol;
      const host = req.get("host");
      fileUrl = `${protocol}://${host}/uploads/voice-notes/${req.file.filename}`;
    }

    return res.status(200).json({
      success: true,
      fileUrl,
      mediaUrl: fileUrl,
      audioMetadata: {
        duration: parsedDuration,
        waveform: parsedWaveform,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    console.error("Audio upload error:", error);
    return res.status(500).json({ message: "Failed to upload audio" });
  }
};

