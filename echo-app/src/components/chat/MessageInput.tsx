import { FC, useState, useRef, useEffect, FormEvent, KeyboardEvent, ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  Send,
  Smile,
  Paperclip,
  Loader2,
  X,
  FileText,
  Image as ImageIcon,
  Camera,
} from "lucide-react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import { useTypingIndicator } from "../../hooks/useTypingIndicator";
import { messageApi } from "../../api/messageApi";
import { cn } from "../../utils/cn";

interface MessageInputProps {
  conversationId: string;
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "file",
    metadata?: { mediaUrl?: string; fileName?: string; fileSize?: number }
  ) => void;
  disabled?: boolean;
}

export const MessageInput: FC<MessageInputProps> = ({
  conversationId,
  onSendMessage,
  disabled = false,
}) => {
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl?: string;
    isImage: boolean;
  } | null>(null);

  // Camera modal streaming state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Specific file input refs
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { handleKeystroke, handleStopTyping } = useTypingIndicator(conversationId);

  // Close emoji picker and attachment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }

      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(target) &&
        attachmentButtonRef.current &&
        !attachmentButtonRef.current.contains(target)
      ) {
        setShowAttachmentMenu(false);
      }
    };

    if (showEmojiPicker || showAttachmentMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker, showAttachmentMenu]);

  // Clean up preview object URL
  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) {
        URL.revokeObjectURL(pendingFile.previewUrl);
      }
    };
  }, [pendingFile]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);

    // If getUserMedia is not supported in this browser/protocol context (e.g. non-https on remote host)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn("getUserMedia is not supported, falling back to native file input");
      cameraInputRef.current?.click();
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // First try simple video request
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (firstErr) {
        // Fallback constraint attempt if exact facingMode was rejected
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "user" } },
          audio: false,
        });
      }

      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      const isPermissionDenied =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      const isNotFound =
        err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError";
      const isOverconstrained = err?.name === "OverconstrainedError";

      let errorMessage = "Could not access camera.";
      if (isPermissionDenied) {
        errorMessage =
          "Camera permission was blocked. Please click the camera/tune icon in your browser address bar to allow camera access.";
      } else if (isNotFound) {
        errorMessage = "No camera was detected on your device.";
      } else if (isOverconstrained) {
        errorMessage = "Camera constraints not satisfied by device hardware.";
      } else if (err?.message) {
        errorMessage = `Camera error: ${err.message}`;
      }

      alert(errorMessage);
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const photoFile = new File([blob], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(photoFile);
        setPendingFile({
          file: photoFile,
          previewUrl,
          isImage: true,
        });
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  // Wire video element when camera is mounted or stream changes
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.onloadedmetadata = () => {
        video.play().catch((err) => {
          console.warn("Video play error on loadedmetadata:", err);
        });
      };
    }
  }, [isCameraActive]);

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setPendingFile({
      file,
      previewUrl,
      isImage,
    });

    // Reset input value so same file can be selected again
    e.target.value = "";
    setShowAttachmentMenu(false);
  };

  const removePendingFile = () => {
    if (pendingFile?.previewUrl) {
      URL.revokeObjectURL(pendingFile.previewUrl);
    }
    setPendingFile(null);
  };

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (disabled || isUploading) return;

    const trimmed = content.trim();

    // If there is an attached file, upload first
    if (pendingFile) {
      try {
        setIsUploading(true);
        const uploadRes = await messageApi.uploadFile(pendingFile.file);

        const type = pendingFile.isImage ? "image" : "file";
        onSendMessage(trimmed, type, {
          mediaUrl: uploadRes.url,
          fileName: uploadRes.fileName,
          fileSize: uploadRes.fileSize,
        });

        setContent("");
        removePendingFile();
        handleStopTyping();
      } catch (err: any) {
        console.error("Upload error", err);
        alert(err?.response?.data?.error?.message || "Failed to upload file attachment.");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Regular text message
    if (!trimmed) return;

    onSendMessage(trimmed, "text");
    setContent("");
    handleStopTyping();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setContent((prev) => prev + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const handleChange = (val: string) => {
    setContent(val);
    handleKeystroke();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const canSend = !disabled && !isUploading && (content.trim().length > 0 || !!pendingFile);

  return (
    <div className="px-4 pt-1.5 pb-3 bg-transparent shrink-0 relative z-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-2 relative">
        {/* Floating Emoji Picker Portal with Smooth Enter/Exit Transitions */}
        <div
          ref={pickerRef}
          className={cn(
            "absolute bottom-16 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden border border-white/[0.06] transition-all duration-200 ease-out origin-bottom-left",
            showEmojiPicker
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none"
          )}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={Theme.DARK}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            width={340}
            height={380}
          />
        </div>

        {/* Attachment Options Dropdown Menu */}
        <div
          ref={attachmentMenuRef}
          className={cn(
            "absolute bottom-16 left-0 z-50 min-w-[200px] bg-[#161722] border border-white/[0.08] rounded-2xl p-1.5 shadow-2xl transition-all duration-200 ease-out origin-bottom-left",
            showAttachmentMenu
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 translate-y-2 pointer-events-none"
          )}
        >
          <div className="flex flex-col gap-1">
            {/* 1. Document Option */}
            <button
              type="button"
              onClick={() => docInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#f0f2f8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer text-left w-full group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25 flex items-center justify-center shrink-0 transition-colors">
                <FileText size={17} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs">Document</span>
                <span className="text-[10px] text-[#767b93]">PDF, DOCX, ZIP, TXT</span>
              </div>
            </button>

            {/* 2. Photos & Videos Option */}
            <button
              type="button"
              onClick={() => mediaInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#f0f2f8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer text-left w-full group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0066ff]/15 text-[#0066ff] group-hover:bg-[#0066ff]/25 flex items-center justify-center shrink-0 transition-colors">
                <ImageIcon size={17} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs">Photos & Videos</span>
                <span className="text-[10px] text-[#767b93]">Images and video clips</span>
              </div>
            </button>

            {/* 3. Camera Option */}
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-[#f0f2f8] hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer text-left w-full group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-400 group-hover:bg-rose-500/25 flex items-center justify-center shrink-0 transition-colors">
                <Camera size={17} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-xs">Camera</span>
                <span className="text-[10px] text-[#767b93]">Capture a live photo</span>
              </div>
            </button>
          </div>
        </div>

        {/* Attachment Preview Card */}
        {pendingFile && (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#13141d] border border-white/[0.04] w-fit max-w-sm animate-in fade-in duration-150 shadow-lg">
            {pendingFile.isImage && pendingFile.previewUrl ? (
              <img
                src={pendingFile.previewUrl}
                alt="Upload preview"
                className="w-12 h-12 rounded-xl object-cover border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#232533] border border-white/10 flex items-center justify-center text-[#0066ff]">
                <FileText size={22} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {pendingFile.file.name}
              </p>
              <p className="text-[10px] text-[#767b93]">
                {Math.round(pendingFile.file.size / 1024)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={removePendingFile}
              className="text-[#767b93] hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Remove attachment"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Main Docked Floating Input Surface */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#13141d] border border-white/[0.08] focus-within:border-[#0066ff]/50 focus-within:shadow-[0_0_20px_rgba(0,102,255,0.18)] rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-inner transition-all"
        >
          {/* Hidden File Inputs for Options */}
          <input
            type="file"
            ref={docInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.zip,.docx,.txt,.doc,.xlsx,.xls,.csv"
          />
          <input
            type="file"
            ref={mediaInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*"
            capture="environment"
          />

          {/* Attachment Paperclip Button (Left Side) */}
          <button
            ref={attachmentButtonRef}
            type="button"
            disabled={disabled || isUploading}
            onClick={() => {
              setShowAttachmentMenu((prev) => !prev);
              setShowEmojiPicker(false);
            }}
            className={cn(
              "transition-colors p-1.5 shrink-0 cursor-pointer disabled:opacity-40 rounded-lg hover:bg-white/[0.04]",
              showAttachmentMenu
                ? "text-[#0066ff] bg-white/[0.06]"
                : "text-[#505469] hover:text-[#767b93]"
            )}
            title="Attach file, photo or open camera"
          >
            <Paperclip size={18} />
          </button>

          {/* Emoji Trigger (Left Side) */}
          <button
            ref={emojiButtonRef}
            type="button"
            disabled={disabled || isUploading}
            onClick={() => {
              setShowEmojiPicker((prev) => !prev);
              setShowAttachmentMenu(false);
            }}
            className={cn(
              "transition-colors p-1.5 shrink-0 cursor-pointer disabled:opacity-40 rounded-lg hover:bg-white/[0.04]",
              showEmojiPicker
                ? "text-[#0066ff] bg-white/[0.06]"
                : "text-[#505469] hover:text-[#767b93]"
            )}
            title={showEmojiPicker ? "Close emoji picker" : "Pick an emoji"}
          >
            <Smile size={18} />
          </button>

          {/* Text input / textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploading
                ? "Uploading attachment..."
                : pendingFile
                ? "Add an optional caption..."
                : "Type something..."
            }
            disabled={disabled || isUploading}
            className="flex-1 bg-transparent text-sm text-[#f0f2f8] placeholder-[#505469] focus:outline-none resize-none max-h-32 py-1 leading-relaxed px-1"
          />

          {/* Send Button (Right Side) */}
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              "transition-all p-2 shrink-0 cursor-pointer rounded-xl",
              canSend
                ? "bg-gradient-to-tr from-[#0052cc] to-[#0066ff] text-white shadow-md shadow-[#0066ff]/40 hover:scale-105 active:scale-95"
                : "text-[#313545] cursor-not-allowed hover:bg-white/[0.02]"
            )}
            title="Send message"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </form>
      </div>

      {/* Live Webcam Capture Modal Portaled Directly to document.body */}
      {isCameraActive &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#161722] border border-white/[0.08] rounded-3xl p-5 flex flex-col gap-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <h3 className="text-sm font-semibold text-white">Live Camera</h3>
                </div>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="p-1.5 rounded-lg text-[#767b93] hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                  title="Cancel camera"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Video Viewport */}
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={closeCamera}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#767b93] hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0066ff] hover:bg-[#005ce6] text-xs font-semibold text-white shadow-lg shadow-[#0066ff]/30 transition-transform active:scale-95 cursor-pointer"
                >
                  <Camera size={16} />
                  <span>Take Photo</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
