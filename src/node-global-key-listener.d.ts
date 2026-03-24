// Type declarations for optional dependencies

// node-global-key-listener is an optional dependency
// This declaration allows dynamic imports without TypeScript errors
declare module "node-global-key-listener" {
  export interface KeyEvent {
    name: string;
    state: "DOWN" | "UP";
    rawKey?: { name: string; _nameRaw: string };
    scanCode?: number;
  }

  export type KeyEventCallback = (
    event: KeyEvent,
    isDown: Record<string, boolean>
  ) => void;

  export class GlobalKeyboardListener {
    constructor();
    addListener(callback: KeyEventCallback): void;
    removeListener(callback: KeyEventCallback): void;
    kill(): void;
  }
}
