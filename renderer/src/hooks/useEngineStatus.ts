import { useState, useEffect, useRef } from "react";
import type { EngineStatus } from "../types";

export function useEngineStatus(intervalMs = 1000) {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const poll = async () => {
      try {
        const result = await window.electronAPI.getEngineStatus();
        setStatus(result);
      } catch {
        // Engine not available
      }
    };

    poll();
    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [intervalMs]);

  return status;
}
