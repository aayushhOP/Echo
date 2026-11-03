import React, { useState, useRef, useEffect } from "react";
import { X, Check, Plus, Minus, RotateCcw } from "lucide-react";

export interface AvatarCropModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.15, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.15, 0.6));

  const handleExportCropped = async () => {
    if (!imageRef.current) return;
    setIsUploading(true);

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const cropSize = 320; // 320x320 export resolution

      canvas.width = cropSize;
      canvas.height = cropSize;

      if (!ctx) return;

      // Circular clipping path
      ctx.beginPath();
      ctx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const img = imageRef.current;
      const naturalAspect = img.naturalWidth / img.naturalHeight;
      const renderWidth = cropSize * scale;
      const renderHeight = (cropSize / naturalAspect) * scale;

      const drawX = (cropSize - renderWidth) / 2 + position.x;
      const drawY = (cropSize - renderHeight) / 2 + position.y;

      ctx.drawImage(img, drawX, drawY, renderWidth, renderHeight);

      canvas.toBlob((blob) => {
        if (blob) {
          onCropComplete(blob).finally(() => {
            setIsUploading(false);
            onClose();
          });
        } else {
          setIsUploading(false);
        }
      }, "image/png", 0.95);
    } catch (err) {
      console.error("Cropping failed", err);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#171824] border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <h3 className="text-sm font-semibold text-white">Drag the image to adjust</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>

        {/* Viewport & Circular Aperture Mask */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative w-full h-80 bg-[#0d0e15] overflow-hidden flex items-center justify-center cursor-move select-none"
        >
          {/* User Image undergoing transform */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop candidate"
            draggable={false}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: isDragging ? "none" : "transform 0.1s ease-out",
            }}
            className="max-w-none max-h-none pointer-events-none"
          />

          {/* WhatsApp Circular Aperture Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark Mask with circular knockout */}
            <div
              className="w-full h-full"
              style={{
                background:
                  "radial-gradient(circle 120px at center, transparent 120px, rgba(13, 14, 21, 0.75) 121px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            />
            {/* Circular Border Ring */}
            <div className="absolute w-60 h-60 rounded-full border-2 border-[#0066ff] shadow-2xl" />
          </div>

          {/* Zoom Controls floating on right */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-[#171824]/90 border border-white/10 rounded-xl p-1 backdrop-blur-md shadow-lg">
            <button
              type="button"
              onClick={zoomIn}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              title="Zoom in"
            >
              <Plus size={16} />
            </button>
            <div className="h-px bg-white/10 mx-1" />
            <button
              type="button"
              onClick={zoomOut}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              title="Zoom out"
            >
              <Minus size={16} />
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#13141d] border-t border-white/[0.06]">
          <span className="text-xs text-slate-400">Position and frame your profile avatar</span>

          <button
            type="button"
            disabled={isUploading}
            onClick={handleExportCropped}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-[#0066ff] hover:bg-[#0052cc] text-white shadow-lg shadow-[#0066ff]/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Apply profile picture"
          >
            <Check size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
