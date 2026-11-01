import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

export interface ServerWarmupState {
  isWarmingUp: boolean;
  isReady: boolean;
  elapsedSeconds: number;
  estimatedProgress: number;
}

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// If VITE_API_URL ends in /api, strip it to get the server base, or keep base for health route
const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/, "");
const COLD_START_ESTIMATE_SECONDS = 45;

export const useServerWarmup = (): ServerWarmupState => {
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFinishedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/health`, {
        timeout: 60000, // Render cold boots can take up to 60s
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout>;

    // Only present warm-up indicator if server takes > 2.5s to respond
    delayTimer = setTimeout(() => {
      if (!hasFinishedRef.current) {
        setIsWarmingUp(true);
      }
    }, 2500);

    const executeCheck = async () => {
      const isAwake = await pingServer();

      if (isAwake) {
        hasFinishedRef.current = true;
        clearTimeout(delayTimer);
        cleanup();
        setIsWarmingUp(false);
        setIsReady(true);
        return;
      }

      // If asleep, track seconds elapsed and poll every 3.5s
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
      }

      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(async () => {
          const ready = await pingServer();
          if (ready) {
            hasFinishedRef.current = true;
            clearTimeout(delayTimer);
            cleanup();
            setIsWarmingUp(false);
            setIsReady(true);
          }
        }, 3500);
      }
    };

    executeCheck();

    return () => {
      clearTimeout(delayTimer);
      cleanup();
    };
  }, [pingServer, cleanup]);

  // Non-linear progress approximation capping at 95% until final HTTP 200 arrives
  const estimatedProgress = Math.min(
    Math.round((elapsedSeconds / COLD_START_ESTIMATE_SECONDS) * 100),
    95
  );

  return {
    isWarmingUp,
    isReady,
    elapsedSeconds,
    estimatedProgress: isReady ? 100 : estimatedProgress,
  };
};
