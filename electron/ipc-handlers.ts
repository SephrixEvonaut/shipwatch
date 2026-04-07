import type { IpcMain, BrowserWindow } from "electron";
import { EngineBridge } from "./engine-bridge.js";

const bridge = new EngineBridge();

export async function registerIpcHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
) {
  // Initialize bridge — forwards events to renderer via webContents.send
  await bridge.init((channel, data) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  });

  // Engine control
  ipcMain.handle("engine:start", async (_event, profileKey: string) => {
    return bridge.start(profileKey);
  });

  ipcMain.handle("engine:stop", async () => {
    return bridge.stop();
  });

  ipcMain.handle("engine:status", async () => {
    return bridge.getStatus();
  });

  // Profiles
  ipcMain.handle("profiles:list", async () => {
    const result = bridge.listProfiles();
    return result.data;
  });

  ipcMain.handle("profiles:active", async () => {
    return bridge.getActiveProfile();
  });

  ipcMain.handle(
    "profiles:create",
    async (_event, profile: { name: string }) => {
      bridge.createProfile(profile);
    },
  );

  ipcMain.handle("profiles:delete", async (_event, name: string) => {
    bridge.deleteProfile(name);
  });

  ipcMain.handle("profiles:setActive", async (_event, name: string) => {
    bridge.setActiveProfile(name);
  });

  // GUI Profiles (persisted to disk)
  ipcMain.handle("gui-profiles:list", async () => {
    return bridge.listGuiProfiles();
  });

  ipcMain.handle("gui-profiles:save", async (_event, profile: unknown) => {
    bridge.saveGuiProfile(profile as any);
  });

  ipcMain.handle("gui-profiles:delete", async (_event, id: string) => {
    bridge.deleteGuiProfile(id);
  });

  // Gesture definitions
  ipcMain.handle("gestures:list", async () => {
    return bridge.listGestureDefinitions();
  });

  ipcMain.handle("gestures:save", async (_event, defs: unknown) => {
    bridge.saveGestureDefinitions(defs as any);
  });

  // Calibration
  ipcMain.handle("calibration:thresholds", async () => {
    const result = bridge.getThresholds();
    return result.data;
  });

  ipcMain.handle("calibration:data", async (_event, key: string) => {
    const result = bridge.getCalibrationData(key);
    return result.data;
  });

  ipcMain.handle("calibration:start", async (_event, keys: string[]) => {
    return bridge.startCalibration(keys);
  });

  ipcMain.handle(
    "calibration:session-start",
    async (_event, keys: string[], profileId: string) => {
      return bridge.calibrationStart(keys, profileId);
    },
  );

  ipcMain.handle(
    "calibration:collect",
    async (_event, key: string, step: string, samplesNeeded: number) => {
      return bridge.calibrationCollect(key, step, samplesNeeded);
    },
  );

  ipcMain.handle("calibration:analyze", async (_event, key: string) => {
    return bridge.calibrationAnalyze(key);
  });

  ipcMain.handle(
    "calibration:save",
    async (_event, profileId: string, calibration: Record<string, any>) => {
      bridge.calibrationSave(profileId, calibration);
    },
  );

  ipcMain.handle("calibration:stop", async () => {
    bridge.calibrationStop();
  });

  ipcMain.handle("calibration:profile-data", async () => {
    return bridge.getProfileCalibration();
  });

  // Timing
  ipcMain.handle(
    "timing:samples",
    async (_event, tier: string, count: number) => {
      return bridge.generateTimingSamples(tier, count);
    },
  );

  ipcMain.handle("timing:stats", async () => {
    const result = bridge.getTimingStats();
    return result.data;
  });

  // Traffic
  ipcMain.handle("traffic:conflicts", async () => {
    const result = bridge.getConflictMap();
    return result.data;
  });

  ipcMain.handle("traffic:queue", async () => {
    const result = bridge.getQueueStatus();
    return result.data;
  });

  // System
  ipcMain.handle("system:backend", async () => {
    const result = await bridge.getBackendInfo();
    return result.data;
  });

  ipcMain.handle("system:executions", async () => {
    const result = bridge.getActiveExecutions();
    return result.data;
  });
}
