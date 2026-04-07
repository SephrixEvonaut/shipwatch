import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  startEngine: (profileKey: string) =>
    ipcRenderer.invoke("engine:start", profileKey),
  stopEngine: () => ipcRenderer.invoke("engine:stop"),
  getEngineStatus: () => ipcRenderer.invoke("engine:status"),

  onKeyEvent: (callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("event:key", wrapped as any);
    return () => { ipcRenderer.removeListener("event:key", wrapped as any); };
  },
  onGestureEvent: (callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("event:gesture", wrapped as any);
    return () => { ipcRenderer.removeListener("event:gesture", wrapped as any); };
  },
  onExecutionEvent: (callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("event:execution", wrapped as any);
    return () => { ipcRenderer.removeListener("event:execution", wrapped as any); };
  },
  onTrafficEvent: (callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("event:traffic", wrapped as any);
    return () => { ipcRenderer.removeListener("event:traffic", wrapped as any); };
  },

  getProfiles: () => ipcRenderer.invoke("profiles:list"),
  getActiveProfile: () => ipcRenderer.invoke("profiles:active"),
  createProfile: (profile: unknown) =>
    ipcRenderer.invoke("profiles:create", profile),
  deleteProfile: (name: string) => ipcRenderer.invoke("profiles:delete", name),
  setActiveProfile: (name: string) =>
    ipcRenderer.invoke("profiles:setActive", name),

  listGuiProfiles: () => ipcRenderer.invoke("gui-profiles:list"),
  saveGuiProfile: (profile: unknown) =>
    ipcRenderer.invoke("gui-profiles:save", profile),
  deleteGuiProfile: (id: string) =>
    ipcRenderer.invoke("gui-profiles:delete", id),

  // Gesture definitions
  listGestureDefinitions: () => ipcRenderer.invoke("gestures:list"),
  saveGestureDefinitions: (defs: unknown) => ipcRenderer.invoke("gestures:save", defs),

  getThresholds: () => ipcRenderer.invoke("calibration:thresholds"),
  getCalibrationData: (key: string) =>
    ipcRenderer.invoke("calibration:data", key),
  startCalibration: (keys: string[]) =>
    ipcRenderer.invoke("calibration:start", keys),

  // GUI calibration wizard
  calibrationSessionStart: (keys: string[], profileId: string) =>
    ipcRenderer.invoke("calibration:session-start", keys, profileId),
  calibrationCollect: (key: string, step: string, samplesNeeded: number) =>
    ipcRenderer.invoke("calibration:collect", key, step, samplesNeeded),
  calibrationAnalyze: (key: string) =>
    ipcRenderer.invoke("calibration:analyze", key),
  calibrationSave: (profileId: string, calibration: Record<string, unknown>) =>
    ipcRenderer.invoke("calibration:save", profileId, calibration),
  calibrationStop: () => ipcRenderer.invoke("calibration:stop"),
  getProfileCalibration: () => ipcRenderer.invoke("calibration:profile-data"),
  onCalibrationSample: (callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on("event:calibration-sample", wrapped as any);
    return () => {
      ipcRenderer.removeListener("event:calibration-sample", wrapped as any);
    };
  },

  generateTimingSamples: (tier: string, count: number) =>
    ipcRenderer.invoke("timing:samples", tier, count),
  getTimingStats: () => ipcRenderer.invoke("timing:stats"),

  getConflictMap: () => ipcRenderer.invoke("traffic:conflicts"),
  getQueueStatus: () => ipcRenderer.invoke("traffic:queue"),

  getBackendInfo: () => ipcRenderer.invoke("system:backend"),
  getActiveExecutions: () => ipcRenderer.invoke("system:executions"),

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners("event:key");
    ipcRenderer.removeAllListeners("event:gesture");
    ipcRenderer.removeAllListeners("event:execution");
    ipcRenderer.removeAllListeners("event:traffic");
    ipcRenderer.removeAllListeners("event:calibration-sample");
  },
});
