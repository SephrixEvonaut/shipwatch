import { useState, useEffect, useRef, useCallback } from "react";
import type { KeyEvent } from "../types";

const MAX_BUFFER = 100;

export function useKeyEvents() {
  const [events, setEvents] = useState<KeyEvent[]>([]);
  const bufferRef = useRef<KeyEvent[]>([]);

  const handleEvent = useCallback((data: KeyEvent) => {
    bufferRef.current = [data, ...bufferRef.current].slice(0, MAX_BUFFER);
    setEvents([...bufferRef.current]);
  }, []);

  useEffect(() => {
    window.electronAPI.onKeyEvent(handleEvent);
    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, [handleEvent]);

  return events;
}
