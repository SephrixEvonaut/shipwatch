export interface EngineStatus {
  running: boolean;
  backend: string;
  activeProfile: string;
  uptime: number;
  gesturesDetected: number;
  sequencesExecuted: number;
  activeExecutions: number;
  queueDepth: number;
}

export interface Profile {
  name: string;
  keys: number;
  gestures: number;
  active: boolean;
  backend: string;
}

export interface CalibrationData {
  key: string;
  samples: number[];
  mean: number;
  stdDev: number;
  threshold: number;
  confidence: number;
  calibratedAt: number;
}

export interface TimingStats {
  totalSamples: number;
  tiers: Record<
    string,
    { mean: number; stdDev: number; min: number; max: number; samples: number }
  >;
}

export interface ConflictMap {
  activeConflicts: number;
  rules: Array<{ keys: string[]; type: string; description: string }>;
}

export interface QueueStatus {
  pending: number;
  inFlight: number;
  maxConcurrent: number;
  totalProcessed: number;
  averageLatency: number;
  pressure: string;
}

export interface BackendInfo {
  name: string;
  connected: boolean;
  port: string;
  firmware: string;
  latency: number;
  capabilities: string[];
}

export interface ExecutionInfo {
  id: string;
  gesture: string;
  key: string;
  step: number;
  totalSteps: number;
  startedAt: number;
}

export interface KeyEvent {
  key: string;
  type: "down" | "up";
  timestamp: number;
}

export interface GestureEvent {
  key: string;
  gesture: string;
  timestamp: number;
}

export interface ElectronAPI {
  startEngine(profileKey: string): Promise<{ status: string }>;
  stopEngine(): Promise<{ status: string }>;
  getEngineStatus(): Promise<EngineStatus>;
  onKeyEvent(callback: (data: KeyEvent) => void): void;
  onGestureEvent(callback: (data: GestureEvent) => void): void;
  onExecutionEvent(callback: (data: ExecutionInfo) => void): void;
  onTrafficEvent(callback: (data: unknown) => void): void;
  getProfiles(): Promise<Profile[]>;
  getActiveProfile(): Promise<Profile>;
  createProfile(profile: Partial<Profile>): Promise<void>;
  deleteProfile(name: string): Promise<void>;
  setActiveProfile(name: string): Promise<void>;
  getThresholds(): Promise<Record<string, number>>;
  getCalibrationData(key: string): Promise<CalibrationData>;
  startCalibration(keys: string[]): Promise<void>;
  generateTimingSamples(tier: string, count: number): Promise<number[]>;
  getTimingStats(): Promise<TimingStats>;
  getConflictMap(): Promise<ConflictMap>;
  getQueueStatus(): Promise<QueueStatus>;
  getBackendInfo(): Promise<BackendInfo>;
  getActiveExecutions(): Promise<ExecutionInfo[]>;
  removeAllListeners(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
