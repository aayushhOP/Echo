# Render Cold-Start Mitigation & Server Warm-Up Overlay — Technical Specification

**Target Stack:** Express 5 · Node.js · React 19 · TypeScript · Tailwind CSS · Lucide React

---

## 1. Architectural Strategy

Render's free compute tier spins web services down after 15 minutes of inactivity. When a subsequent request arrives, spin-up latency ranges from 35 to 60 seconds.

This specification implements a two-layer solution:
1. **Frontend Graceful Degradation (In-App Warm-Up Modal):** A non-blocking health-ping pre-flight layer that detects cold starts (>2.5s pending), displays an animated countdown/progress modal, and polls until HTTP 200 before unblocking the UI.
2. **Scheduled Keep-Alive (UptimeRobot / Cron-Job.org):** Configured with schedules or manual toggle controls to prevent spin-down during active evaluation or development windows without exhausting the 750 free monthly compute hours.

---

## 2. Backend Implementation (Express)

Create an ultra-lightweight health endpoint that does not query MongoDB, Redis, or perform external I/O.

### 2.1 File: `server/src/routes/health.ts`

```typescript
import { Router, Request, Response } from "express";

const router = Router();

/**
 * GET /api/health
 * Ultra-fast endpoint to verify Express process boot.
 * Intentionally avoids DB access so ping responses return in single-digit milliseconds once awake.
 */
router.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

### 2.2 Register Route in `server/src/app.ts`

Mount the route at the top of middleware registrations before any rate limiters or session parsers:

```typescript
import express from "express";
import healthRouter from "./routes/health";

const app = express();

// Mount BEFORE auth middlewares and rate limiters
app.use("/api/health", healthRouter);

// ... existing Clerk webhooks, json body parsers, and protected routes ...
```

---

## 3. Frontend Implementation (React 19 + TypeScript)

### 3.1 Custom Hook: `client/src/hooks/useServerWarmup.ts`

This hook triggers on app initialization, issues a low-overhead pre-flight ping, and monitors elapsed wake-up time.

```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

interface ServerWarmupState {
  isWarmingUp: boolean;
  isReady: boolean;
  elapsedSeconds: number;
  estimatedProgress: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const COLD_START_ESTIMATE_SECONDS = 45;

export const useServerWarmup = (): ServerWarmupState => {
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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
    let delayTimer: NodeJS.Timeout;

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
```

### 3.2 Modal Component: `client/src/components/common/ServerWarmupModal.tsx`

Styled according to the WhatsApp dark navy/electric blue palette (`#13141d` base, `#171824` cards, `#0066ff` accents).

```tsx
import React from "react";
import { Server, Loader2, Zap } from "lucide-react";

interface ServerWarmupModalProps {
  isVisible: boolean;
  elapsedSeconds: number;
  progressPercent: number;
}

export const ServerWarmupModal: React.FC<ServerWarmupModalProps> = ({
  isVisible,
  elapsedSeconds,
  progressPercent,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13141d]/80 backdrop-blur-md px-4 transition-all duration-300">
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#171824] p-6 text-center shadow-2xl shadow-black/60">
        
        {/* Glow & Status Icon */}
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0066ff]/10 border border-[#0066ff]/20">
          <Server className="h-7 w-7 text-[#0066ff]" />
          <Loader2 className="absolute -inset-1.5 h-[76px] w-[76px] animate-spin text-[#0066ff]/30 pointer-events-none" />
        </div>

        {/* Header */}
        <h3 className="text-lg font-semibold tracking-wide text-white">
          Waking Up Cloud Server
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Backend is hosted on a free cloud instance. After inactivity, the service needs approximately 30–50 seconds to boot up.
        </p>

        {/* Progress Bar Container */}
        <div className="mt-6 w-full overflow-hidden rounded-full bg-[#13141d] p-1 border border-white/[0.04]">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[#0066ff] to-[#00d2ff] transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Telemetry Footers */}
        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>Elapsed: {elapsedSeconds}s</span>
          <span>Status: Booting runtime... {progressPercent}%</span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[#0066ff]">
          <Zap size={14} className="animate-pulse" />
          <span>Sockets and API will connect automatically</span>
        </div>
      </div>
    </div>
  );
};
```

### 3.3 Root App Integration: `client/src/App.tsx`

```tsx
import { useServerWarmup } from "./hooks/useServerWarmup";
import { ServerWarmupModal } from "./components/common/ServerWarmupModal";

export default function App() {
  const { isWarmingUp, elapsedSeconds, estimatedProgress } = useServerWarmup();

  return (
    <>
      <ServerWarmupModal
        isVisible={isWarmingUp}
        elapsedSeconds={elapsedSeconds}
        progressPercent={estimatedProgress}
      />
      {/* Existing application routing and layout */}
    </>
  );
}
```

---

## 4. Scheduled Keep-Alive Setup (Cron-Job.org / UptimeRobot)

To prevent cold starts during evaluation sessions without exhausting monthly allocations:

### 4.1 Plan Constraints Calculation
* Render Free Quota: **750 hours/month**
* 24/7 Execution = 744 hours (Consumes 99.2% of allowance, risking account-wide suspension if multiple services run)
* **Target Schedule (9 AM - 6 PM Weekdays):** 9 hours/day × ~22 days = **198 hours/month** (~26% utilization)

### 4.2 Configuration Parameters

| Parameter | Value |
|---|---|
| **Target URL** | `https://<YOUR-RENDER-SLUG>.onrender.com/api/health` |
| **HTTP Method** | `GET` |
| **Interval** | Every **14 minutes** (Render sleeps at minute 15) |
| **Schedule Type** | Specific hours (Mon–Fri 09:00–18:00) OR Paused by default |
| **Notification Settings** | Alert only if down for > 3 consecutive checks |

### 4.3 Setup Steps on Cron-Job.org
1. Sign up at [cron-job.org](https://cron-job.org).
2. Go to **Cronjobs** -> **Create Cronjob**.
3. **Title:** `Echo Chat Render Keepalive`.
4. **URL:** `https://your-service.onrender.com/api/health`.
5. **Execution Schedule:**
   * Select **User-defined schedule** -> Run every 14 minutes.
   * Restrict active hours to your testing timezone if desired.
6. Toggle **Job enabled** to `OFF` by default when not in active demo periods; toggle to `ON` 10 minutes before viva or project showcases.

---

## 5. Agent Verification Checklist

- [ ] `/api/health` route is mounted directly on Express without Mongoose queries or auth middleware.
- [ ] Direct `curl https://<backend>/api/health` returns `{ status: "healthy" }` with HTTP 200.
- [ ] `useServerWarmup.ts` hook initiates pre-flight ping immediately on mount.
- [ ] Fast responses (<2.5s) render the main app immediately with zero modal flashing.
- [ ] Delayed responses (>2.5s) trigger `ServerWarmupModal` with active seconds and progress bar animations.
- [ ] Once `/api/health` returns HTTP 200, the modal dismisses automatically.
- [ ] External cron ping URL points to `/api/health` on a 14-minute interval with a manual toggle or office-hours schedule.