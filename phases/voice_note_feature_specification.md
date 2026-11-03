# WhatsApp-Style Voice Note System — Technical Specification

**Project Stack:** React 19 · TypeScript · Tailwind CSS · Lucide React · Express 5 · Node.js · MongoDB / Mongoose · Socket.IO · Cloudinary / S3 / Local Multer

---

## 1. Architectural Overview & Workflow

The voice note system follows the modern messaging standard:
1. **Recording Pipeline:**
   * Uses browser-native `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`.
   * Records in lightweight `audio/webm;codecs=opus` (or `audio/mp4` fallback for Safari iOS).
   * Generates live audio frequency data using the Web Audio API (`AudioContext` + `AnalyserNode`) to display animated recording bars.
   * Features: Record, Pause/Resume, Cancel/Delete (trash can), and Send.
2. **Persistence & Payload:**
   * Audio is captured as a binary `Blob`, packed into a `FormData` object, and uploaded to the server (or S3/Cloudinary).
   * The server saves the file and returns a `fileUrl`, `duration` (in seconds), and a pre-sampled array of normalized waveform peaks (e.g., 30–50 integer amplitude values).
   * The message is saved in MongoDB with `type: "audio"` and emitted via Socket.IO.
3. **Playback Pipeline:**
   * A custom WhatsApp-style audio player bubble showing:
     * Play/Pause button.
     * Scrubbable visual waveform with current playback progress fill.
     * Duration timer countdown.
     * Multi-speed toggle button ($1\times$, $1.5\times$, $2\times$).
     * Sender avatar badge with a mic icon.

---

## 2. Database Schema Updates

### 2.1 Update Message Model (`server/src/models/Message.ts`)

Extend the message schema with audio metadata:

```typescript
// server/src/models/Message.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IMessage extends Document {
  conversationId: Types.ObjectId;
  senderId: string;
  content: string; // Optional caption or empty string
  type: "text" | "image" | "file" | "audio";
  fileUrl?: string;
  audioMetadata?: {
    duration: number;        // Total duration in seconds (e.g. 14.5)
    waveform: number[];      // Array of normalized amplitude values (0-100)
    mimeType: string;        // e.g. "audio/webm" or "audio/mp4"
  };
  status: "sent" | "delivered" | "read";
  isDeletedForEveryone: boolean;
  deletedForUsers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: String, required: true, index: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "file", "audio"], default: "text" },
    fileUrl: { type: String },
    audioMetadata: {
      duration: { type: Number, default: 0 },
      waveform: [{ type: Number }],
      mimeType: { type: String, default: "audio/webm" }
    },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    isDeletedForEveryone: { type: Boolean, default: false },
    deletedForUsers: [{ type: String, index: true }]
  },
  { timestamps: true }
);

export default model<IMessage>("Message", messageSchema);
```

---

## 3. Backend Upload Handler

### 3.1 Multer & Voice Upload Controller (`server/src/controllers/mediaController.ts`)

Configure file ingestion for audio files:

```typescript
// server/src/controllers/mediaController.ts
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure local storage (or replace with Cloudinary/S3 storage engine)
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
    
    // Construct accessible media URL
    const fileUrl = `/uploads/voice-notes/${req.file.filename}`;

    const parsedWaveform = waveform ? JSON.parse(waveform) : [];
    const parsedDuration = duration ? parseFloat(duration) : 0;

    return res.status(200).json({
      success: true,
      fileUrl,
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
```

Mount route in `server/src/routes/media.ts`:
```typescript
import { Router } from "express";
import { audioUploadMiddleware, handleVoiceUpload } from "../controllers/mediaController";

const router = Router();
router.post("/voice-note", audioUploadMiddleware, handleVoiceUpload);

export default router;
```

---

## 4. Frontend Audio Recording Engine

### 4.1 Custom Hook: `useAudioRecorder.ts` (`client/src/hooks/useAudioRecorder.ts`)

Captures microphone audio, records amplitude samples for real-time waveform bars, and packages the result into a playable blob:

```typescript
// client/src/hooks/useAudioRecorder.ts
import { useState, useRef, useCallback } from "react";

export interface RecordingResult {
  blob: Blob;
  duration: number;
  waveform: number[];
}

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Web Audio API refs for amplitude extraction
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);
  const sampleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported mime-type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      waveformSamplesRef.current = [];

      // Setup Web Audio Analyser for real-time waveform peaks
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Small size for fast responsive amplitude
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // 100ms slice
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      // Duration counter
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Sample normalized waveform peak every 120ms
      sampleIntervalRef.current = setInterval(() => {
        if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          // Average the frequency bins
          const sum = dataArrayRef.current.reduce((acc, val) => acc + val, 0);
          const avg = sum / dataArrayRef.current.length;
          // Normalize to 15 - 100 range for visual bars
          const normalized = Math.max(15, Math.min(100, Math.round((avg / 255) * 100)));
          waveformSamplesRef.current.push(normalized);
        }
      }, 120);
    } catch (err) {
      console.error("Microphone access denied or not available", err);
      alert("Microphone permission is required to record voice notes.");
    }
  }, []);

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !isRecording) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        // Normalize samples down to 35 evenly-spaced peak points for UI rendering
        const total = waveformSamplesRef.current;
        const targetBars = 35;
        const downsampled: number[] = [];

        if (total.length > targetBars) {
          const step = total.length / targetBars;
          for (let i = 0; i < targetBars; i++) {
            downsampled.push(total[Math.floor(i * step)]);
          }
        } else {
          downsampled.push(...total);
          while (downsampled.length < targetBars) {
            downsampled.push(18); // Default fallback min height
          }
        }

        resolve({
          blob: audioBlob,
          duration: recordingDuration || 1,
          waveform: downsampled,
        });

        // Cleanup
        streamRef.current?.getTracks().forEach((track) => track.stop());
        audioContextRef.current?.close();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

        setIsRecording(false);
        setIsPaused(false);
        setRecordingDuration(0);
      };

      mediaRecorderRef.current.stop();
    });
  }, [isRecording, recordingDuration]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

    audioChunksRef.current = [];
    waveformSamplesRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  }, [isRecording]);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
```

---

## 5. UI Components

### 5.1 Dynamic Recording Bar (`client/src/components/chat/VoiceRecordingOverlay.tsx`)

Replaces the text input bar during an active recording session:

```tsx
// client/src/components/chat/VoiceRecordingOverlay.tsx
import React from "react";
import { Trash2, Send, Mic } from "lucide-react";

interface VoiceRecordingOverlayProps {
  isRecording: boolean;
  duration: number;
  onCancel: () => void;
  onSend: () => void;
}

export const VoiceRecordingOverlay: React.FC<VoiceRecordingOverlayProps> = ({
  isRecording,
  duration,
  onCancel,
  onSend,
}) => {
  if (!isRecording) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="h-16 w-full bg-[#171824] border-t border-white/[0.08] px-4 flex items-center justify-between animate-in slide-in-from-bottom duration-150 z-20">
      {/* Delete / Cancel Button */}
      <button
        onClick={onCancel}
        className="p-2.5 rounded-full text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
        title="Cancel voice note"
      >
        <Trash2 size={18} />
      </button>

      {/* Recording Indicator & Timer */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
        </span>
        <span className="font-mono text-sm font-semibold text-white">
          {formatDuration(duration)}
        </span>
        {/* Animated Soundwave Pulse Bars */}
        <div className="flex items-center gap-1 h-5 px-2">
          {[40, 75, 55, 90, 60, 85, 45].map((height, i) => (
            <div
              key={i}
              className="w-0.5 bg-rose-400 rounded-full animate-pulse"
              style={{
                height: `${height}%`,
                animationDelay: `${i * 120}ms`,
                animationDuration: "800ms",
              }}
            />
          ))}
        </div>
      </div>

      {/* Commit & Send Button */}
      <button
        onClick={onSend}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-[#0066ff]/25 transition-transform active:scale-95"
        title="Send voice note"
      >
        <Send size={16} />
      </button>
    </div>
  );
};
```

---

### 5.2 WhatsApp Audio Player Bubble (`client/src/components/chat/VoiceNotePlayer.tsx`)

Renders inside the chat message bubble with interactive scrubber, wave bars, and playback speed changer:

```tsx
// client/src/components/chat/VoiceNotePlayer.tsx
import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, Mic } from "lucide-react";

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration: number;
  waveform?: number[];
  isOwnMessage: boolean;
  senderAvatar?: string;
}

const PLAYBACK_SPEEDS = [1, 1.5, 2];

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioUrl,
  duration,
  waveform = [],
  isOwnMessage,
  senderAvatar,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Normalize fallback waveform if none provided
  const bars = waveform.length > 0 ? waveform : new Array(32).fill(30);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current) return;
    const progress = index / bars.length;
    const targetTime = progress * (audioRef.current.duration || duration);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    const nextIdx = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIdx);
    audioRef.current.playbackRate = PLAYBACK_SPEEDS[nextIdx];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const currentProgressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 py-1 px-1 min-w-[260px] max-w-[320px]">
      {/* Sender Avatar with Mic Badge */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center">
          {senderAvatar ? (
            <img src={senderAvatar} alt="Voice sender" className="w-full h-full object-cover" />
          ) : (
            <Mic size={18} className="text-slate-300" />
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#13141d]">
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${isOwnMessage ? "bg-white text-[#0066ff]" : "bg-[#0066ff] text-white"}`}>
            <Mic size={9} />
          </div>
        </div>
      </div>

      {/* Play / Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          isOwnMessage
            ? "bg-white text-[#0066ff] hover:bg-white/90"
            : "bg-[#0066ff] text-white hover:bg-[#0052cc]"
        }`}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Waveform Scrubber & Timer */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Waveform visual bars */}
        <div className="flex items-center gap-[2.5px] h-7 cursor-pointer" title="Seek audio">
          {bars.map((amplitude, i) => {
            const barProgress = (i / bars.length) * 100;
            const isPlayed = barProgress <= currentProgressPercent;

            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                className={`w-[2.5px] rounded-full transition-colors ${
                  isPlayed
                    ? isOwnMessage
                      ? "bg-white"
                      : "bg-[#0066ff]"
                    : isOwnMessage
                    ? "bg-white/35 hover:bg-white/60"
                    : "bg-slate-600 hover:bg-slate-400"
                }`}
                style={{ height: `${Math.max(20, Math.min(100, amplitude))}%` }}
              />
            );
          })}
        </div>

        {/* Time & Speed Controls */}
        <div className="flex items-center justify-between text-[11px] text-white/70 mt-0.5 font-mono">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration)}</span>

          {/* Speed Toggle ($1\times, 1.5\times, 2\times$) */}
          <button
            onClick={toggleSpeed}
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-all ${
              isOwnMessage
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-white/[0.08] hover:bg-white/[0.15] text-slate-300"
            }`}
          >
            {PLAYBACK_SPEEDS[speedIndex]}x
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 6. Integration into Chat Composer (`client/src/components/chat/ChatInput.tsx`)

Wire the microphone trigger into the main chat footer:

```tsx
// Inside ChatInput.tsx
import React, { useState } from "react";
import { Mic, Send } from "lucide-react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { VoiceRecordingOverlay } from "./VoiceRecordingOverlay";
import axios from "axios";

interface ChatInputProps {
  conversationId: string;
  onSendMessage: (payload: any) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ conversationId, onSendMessage }) => {
  const [text, setText] = useState("");
  const {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const handleSendVoiceNote = async () => {
    const result = await stopRecording();
    if (!result || result.blob.size === 0) return;

    // Build multipart upload payload
    const formData = new FormData();
    formData.append("audio", result.blob, "voice-note.webm");
    formData.append("duration", result.duration.toString());
    formData.append("waveform", JSON.stringify(result.waveform));

    try {
      const response = await axios.post("/api/media/voice-note", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        onSendMessage({
          conversationId,
          content: "",
          type: "audio",
          fileUrl: response.data.fileUrl,
          audioMetadata: response.data.audioMetadata,
        });
      }
    } catch (error) {
      console.error("Failed to upload voice note:", error);
    }
  };

  // If currently recording, show the voice recording overlay
  if (isRecording) {
    return (
      <VoiceRecordingOverlay
        isRecording={isRecording}
        duration={recordingDuration}
        onCancel={cancelRecording}
        onSend={handleSendVoiceNote}
      />
    );
  }

  return (
    <div className="h-16 bg-[#13141d] border-t border-white/[0.06] px-4 flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
      />

      {text.trim() ? (
        <button
          onClick={() => {
            onSendMessage({ conversationId, content: text, type: "text" });
            setText("");
          }}
          className="p-2 rounded-full bg-[#0066ff] text-white"
        >
          <Send size={16} />
        </button>
      ) : (
        <button
          onClick={startRecording}
          className="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Hold/Click to record voice note"
        >
          <Mic size={18} />
        </button>
      )}
    </div>
  );
};
```

---

## 7. Agent Verification Checklist

- [x] **Database Schema:** Extended `Message` model with `type: "audio"`, `fileUrl`, and `audioMetadata` (`duration`, `waveform` array, `mimeType`).
- [x] **Upload Route:** Created `POST /api/media/voice-note` using Multer to accept audio files and save them to `/uploads/voice-notes/`.
- [x] **Audio Recorder Hook (`useAudioRecorder.ts`):**
  - [x] Captures audio using `navigator.mediaDevices.getUserMedia`.
  - [x] Extracts frequency peaks via `AudioContext` and `AnalyserNode` into a downsampled 35-bar array.
  - [x] Tracks recording elapsed time in seconds.
  - [x] Supports cancel/cleanup releasing mic tracks.
- [x] **VoiceRecordingOverlay Component:**
  - [x] Animated red pulse badge and live duration display.
  - [x] Trash button to discard recording.
  - [x] Send button to trigger upload and socket broadcast.
- [x] **VoiceNotePlayer Component:**
  - [x] Play/Pause toggle with audio state sync.
  - [x] Visual amplitude waveform with interactive seeking.
  - [x] Multi-speed toggle cycle ($1\times \to 1.5\times \to 2\times$).
  - [x] Sender avatar with small microphone badge.