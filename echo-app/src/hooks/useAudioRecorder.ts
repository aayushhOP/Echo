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
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Web Audio API refs for amplitude extraction
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const waveformSamplesRef = useRef<number[]>([]);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine supported mime-type
      const mimeType =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      waveformSamplesRef.current = [];
      durationRef.current = 0;

      // Setup Web Audio Analyser for real-time waveform peaks
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // Small size for fast responsive amplitude
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
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
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        durationRef.current = elapsed;
        setRecordingDuration(elapsed);
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
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
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

        const finalDuration = durationRef.current || recordingDuration || 1;

        resolve({
          blob: audioBlob,
          duration: finalDuration,
          waveform: downsampled,
        });

        // Cleanup
        streamRef.current?.getTracks().forEach((track) => track.stop());
        audioContextRef.current?.close().catch(() => {});
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

        setIsRecording(false);
        setIsPaused(false);
        setRecordingDuration(0);
        durationRef.current = 0;
      };

      mediaRecorder.stop();
    });
  }, [recordingDuration]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioContextRef.current?.close().catch(() => {});
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);

    audioChunksRef.current = [];
    waveformSamplesRef.current = [];
    durationRef.current = 0;
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
  }, []);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
