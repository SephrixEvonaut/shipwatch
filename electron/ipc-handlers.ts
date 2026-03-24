import type { IpcMain, BrowserWindow } from "electron";

const mockData = {
  engineStatus: {
    running: false,
    backend: "teensy",
    activeProfile: "Default",
    uptime: 0,
    gesturesDetected: 0,
    sequencesExecuted: 0,
    activeExecutions: 0,
    queueDepth: 0,
  },

  profiles: [
    { name: "Default", keys: 6, gestures: 12, active: true, backend: "teensy" },
    { name: "Gaming", keys: 8, gestures: 24, active: false, backend: "teensy" },
    {
      name: "Productivity",
      keys: 4,
      gestures: 8,
      active: false,
      backend: "robotjs",
    },
  ],

  thresholds: {
    "1": 180,
    "2": 175,
    "3": 190,
    "4": 185,
    "5": 170,
    "6": 195,
    A: 200,
    S: 210,
  } as Record<string, number>,

  calibrationData: {
    key: "1",
    samples: [178, 182, 175, 190, 180, 177, 185, 183, 179, 181],
    mean: 181,
    stdDev: 4.2,
    threshold: 180,
    confidence: 0.95,
    calibratedAt: Date.now(),
  },

  timingStats: {
    totalSamples: 500,
    tiers: {
      low: { mean: 32, stdDev: 8, min: 18, max: 50, samples: 200 },
      medium: { mean: 65, stdDev: 12, min: 40, max: 95, samples: 200 },
      high: { mean: 110, stdDev: 20, min: 70, max: 160, samples: 100 },
    },
  },

  conflictMap: {
    activeConflicts: 0,
    rules: [
      {
        keys: ["1", "2"],
        type: "mutex",
        description: "Keys 1 and 2 share a cooldown group",
      },
      {
        keys: ["A", "S"],
        type: "priority",
        description: "Key A takes priority over key S",
      },
    ],
  },

  queueStatus: {
    pending: 0,
    inFlight: 0,
    maxConcurrent: 3,
    totalProcessed: 0,
    averageLatency: 0,
    pressure: "none" as const,
  },

  backendInfo: {
    name: "teensy",
    connected: true,
    port: "COM3",
    firmware: "1.0.0",
    latency: 1.2,
    capabilities: ["keyDown", "keyUp", "modifiers", "media"],
  },

  activeExecutions: [] as Array<{
    id: string;
    gesture: string;
    key: string;
    step: number;
    totalSteps: number;
    startedAt: number;
  }>,
};

export function registerIpcHandlers(
  ipcMain: IpcMain,
  getWindow: () => BrowserWindow | null,
) {
  // Engine control
  ipcMain.handle("engine:start", async (_event, _profileKey: string) => {
    mockData.engineStatus.running = true;
    mockData.engineStatus.uptime = Date.now();
    return { status: "started" };
  });

  ipcMain.handle("engine:stop", async () => {
    mockData.engineStatus.running = false;
    mockData.engineStatus.uptime = 0;
    return { status: "stopped" };
  });

  ipcMain.handle("engine:status", async () => {
    return { ...mockData.engineStatus };
  });

  // Profiles
  ipcMain.handle("profiles:list", async () => {
    return [...mockData.profiles];
  });

  ipcMain.handle("profiles:active", async () => {
    return mockData.profiles.find((p) => p.active) ?? mockData.profiles[0];
  });

  ipcMain.handle(
    "profiles:create",
    async (_event, profile: { name: string }) => {
      mockData.profiles.push({
        name: profile.name,
        keys: 0,
        gestures: 0,
        active: false,
        backend: "teensy",
      });
    },
  );

  ipcMain.handle("profiles:delete", async (_event, name: string) => {
    const idx = mockData.profiles.findIndex((p) => p.name === name);
    if (idx !== -1) mockData.profiles.splice(idx, 1);
  });

  ipcMain.handle("profiles:setActive", async (_event, name: string) => {
    for (const p of mockData.profiles) {
      p.active = p.name === name;
    }
  });

  // Calibration
  ipcMain.handle("calibration:thresholds", async () => {
    return { ...mockData.thresholds };
  });

  ipcMain.handle("calibration:data", async (_event, _key: string) => {
    return { ...mockData.calibrationData };
  });

  ipcMain.handle("calibration:start", async (_event, _keys: string[]) => {
    return { status: "calibration_started" };
  });

  // Timing
  ipcMain.handle(
    "timing:samples",
    async (_event, tier: string, count: number) => {
      const base = tier === "low" ? 32 : tier === "medium" ? 65 : 110;
      const spread = tier === "low" ? 8 : tier === "medium" ? 12 : 20;
      return Array.from({ length: count }, () =>
        Math.round(base + (Math.random() - 0.5) * 2 * spread),
      );
    },
  );

  ipcMain.handle("timing:stats", async () => {
    return { ...mockData.timingStats };
  });

  // Traffic
  ipcMain.handle("traffic:conflicts", async () => {
    return { ...mockData.conflictMap };
  });

  ipcMain.handle("traffic:queue", async () => {
    return { ...mockData.queueStatus };
  });

  // System
  ipcMain.handle("system:backend", async () => {
    return { ...mockData.backendInfo };
  });

  ipcMain.handle("system:executions", async () => {
    return [...mockData.activeExecutions];
  });
}
