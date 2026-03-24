import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  startEngine: (profileKey: string) =>
    ipcRenderer.invoke("engine:start", profileKey),
  stopEngine: () => ipcRenderer.invoke("engine:stop"),
  getEngineStatus: () => ipcRenderer.invoke("engine:status"),

  onKeyEvent: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on("event:key", (_event, data) => callback(data)),
  onGestureEvent: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on("event:gesture", (_event, data) => callback(data)),
  onExecutionEvent: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on("event:execution", (_event, data) => callback(data)),
  onTrafficEvent: (callback: (...args: unknown[]) => void) =>
    ipcRenderer.on("event:traffic", (_event, data) => callback(data)),

  getProfiles: () => ipcRenderer.invoke("profiles:list"),
  getActiveProfile: () => ipcRenderer.invoke("profiles:active"),
  createProfile: (profile: unknown) =>
    ipcRenderer.invoke("profiles:create", profile),
  deleteProfile: (name: string) => ipcRenderer.invoke("profiles:delete", name),
  setActiveProfile: (name: string) =>
    ipcRenderer.invoke("profiles:setActive", name),

  getThresholds: () => ipcRenderer.invoke("calibration:thresholds"),
  getCalibrationData: (key: string) =>
    ipcRenderer.invoke("calibration:data", key),
  startCalibration: (keys: string[]) =>
    ipcRenderer.invoke("calibration:start", keys),

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
  },
});
