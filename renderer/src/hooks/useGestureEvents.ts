import { useState, useEffect, useRef, useCallback } from "react";
import type { GestureEvent } from "../types";

const MAX_BUFFER = 50;

export function useGestureEvents() {
  const [events, setEvents] = useState<GestureEvent[]>([]);
  const bufferRef = useRef<GestureEvent[]>([]);

  const handleEvent = useCallback((data: GestureEvent) => {
    bufferRef.current = [data, ...bufferRef.current].slice(0, MAX_BUFFER);
    setEvents([...bufferRef.current]);
  }, []);

  useEffect(() => {
    window.electronAPI.onGestureEvent(handleEvent);
    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, [handleEvent]);

  return events;
}
